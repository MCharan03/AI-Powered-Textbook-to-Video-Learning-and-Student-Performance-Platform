import os
import json
import re
import time
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ValidationError

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIProviderUnavailableError(Exception):
    """Raised when external AI credentials or providers are missing or unavailable."""
    pass


class GeminiGenerationError(Exception):
    """Raised when Gemini content generation fails or output fails schema validation."""
    pass


# ==============================================================================
# STRUCTURED SCRIPT SCHEMA FOR GEMINI
# ==============================================================================

class GeminiSceneDefinition(BaseModel):
    scene_number: int = Field(description="1-based scene sequence number")
    section_type: str = Field(
        default="CONCEPT",
        description="Educational section type: INTRO, OBJECTIVE, CONCEPT, DEFINITIONS, FORMULA, DETAILED_EXPLANATION, EXAMPLE, APPLICATION, SUMMARY, CLOSING"
    )
    title: str = Field(description="Concise, engaging title for this scene")
    narration: str = Field(description="Full spoken text for this scene")
    speaker: str = Field(default="Teacher", description="Speaker identity: 'Teacher' or 'Student'")
    visual_type: str = Field(
        default="DIAGRAM",
        description="Visual card type: TITLE_CARD, DIAGRAM, FORMULA_CARD, CODE_SNIPPET, BEFORE_AFTER, COMPLEXITY_CHART, SUMMARY_CHIPS, TEXT, APPLICATION_CARD, KNOWLEDGE_CHECK"
    )
    visual_description: str = Field(description="Detailed visual instructions for the renderer")
    on_screen_text: str = Field(description="Text displayed on the slide")
    formula: Optional[str] = Field(default=None, description="Mathematical equation or formula, if applicable")
    diagram_description: Optional[str] = Field(default=None, description="Detailed diagram specification")
    animation_hint: Optional[str] = Field(default=None, description="Animation or transition hint")
    source_pages: List[int] = Field(default_factory=list, description="Source textbook page numbers supporting this scene. MUST be empty [] for generative analogies/applications.")
    example_origin: Optional[str] = Field(
        default=None,
        description="Origin of example or scenario: 'textbook_direct' (directly from textbook text/problems), 'generative_analogy' (creative pedagogical analogy), or 'generative_application' (newly created real-world application). Null for non-example sections."
    )


class GeminiLessonScript(BaseModel):
    title: str = Field(description="Lesson title")
    narration_style: str = Field(default="teacher", description="'teacher' or 'conversation'")
    learning_objective: str = Field(description="Target learning objective")
    target_words: int = Field(description="Calculated target word budget")
    sections: List[GeminiSceneDefinition] = Field(description="Ordered list of 6-10 scenes comprising the video script")
    pedagogical_summary: Optional[str] = Field(default=None, description="Summary of how concepts were explained and grounded")


# ==============================================================================
# GOOGLE AI CLIENT WRAPPER
# ==============================================================================

class GoogleAIClient:
    """
    Client wrapper for Google Gemini API via official Google GenAI SDK.
    Supports API Key and Vertex AI authentication, structured outputs,
    and automatic retries with configurable timeouts.
    """

    _mock_client: Optional[Any] = None

    def __init__(
        self,
        api_key: Optional[str] = None,
        project: Optional[str] = None,
        location: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        max_retries: Optional[int] = None,
    ):
        self.api_key = api_key or settings.gemini_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        self.project = project or settings.google_cloud_project or os.environ.get("GOOGLE_CLOUD_PROJECT")
        self.location = location or settings.google_cloud_location
        self.model_name = model_name or settings.gemini_script_model
        self.timeout_seconds = timeout_seconds or settings.gemini_timeout_seconds
        self.max_retries = max_retries or settings.gemini_max_retries

    @classmethod
    def set_mock_client(cls, mock_client: Any) -> None:
        """Injects a mock client for testing without network/API calls."""
        cls._mock_client = mock_client

    @classmethod
    def reset_mock_client(cls) -> None:
        """Clears any mock client."""
        cls._mock_client = None

    def get_client(self) -> genai.Client:
        """Initializes and returns the official GenAI Client instance."""
        if self._mock_client is not None:
            return self._mock_client

        if self.api_key:
            return genai.Client(api_key=self.api_key)
        elif self.project:
            return genai.Client(vertexai=True, project=self.project, location=self.location)
        else:
            raise AIProviderUnavailableError(
                "Google Gemini API credentials not configured. Please set GEMINI_API_KEY or GOOGLE_API_KEY in the environment or configuration."
            )

    def generate_lesson_script(
        self,
        video: Any,
        source_pages: List[Dict[str, Any]],
        target_words: int,
        academic_level: str = "Undergraduate / Grade 10-12",
        narration_style: str = "teacher",
        regeneration_feedback: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates a validated educational script using Google Gemini grounded
        in the provided textbook source pages.
        """
        if not source_pages or all(len(p.get("text", "").strip()) == 0 for p in source_pages):
            raise ValueError(
                f"Source textbook content is required for script generation but no text was found."
            )

        client = self.get_client()

        # Build textbook source context with page annotations
        formatted_pages = []
        all_page_numbers = []
        for p in source_pages:
            p_num = p.get("page_number", 1)
            all_page_numbers.append(p_num)
            formatted_pages.append(f"--- TEXTBOOK PAGE {p_num} ---\n{p.get('text', '').strip()}")

        textbook_context = "\n\n".join(formatted_pages)
        start_p = min(all_page_numbers) if all_page_numbers else 1
        end_p = max(all_page_numbers) if all_page_numbers else 1

        # Check source material density
        total_source_words = len(textbook_context.split())
        warnings: List[str] = []
        if total_source_words < 120 and target_words > 400:
            warnings.append(
                f"SOURCE_MATERIAL_SPARSE: Textbook page content is brief ({total_source_words} words). "
                "Script focuses carefully on available definitions without extrapolating beyond source scope."
            )

        # Style prompt instructions
        is_conversation = (narration_style or "").lower() == "conversation"
        if is_conversation:
            style_instruction = """
STYLE: TEACHER–STUDENT CONVERSATION MODE
- You must write this lesson script as an authentic, engaging educational dialogue between:
  • 'Teacher': An encouraging, knowledgeable educator who explains concepts, derivations, and analogies clearly.
  • 'Student': A curious, relatable student who asks thoughtful clarifying questions, expresses common misconceptions or doubts, and connects ideas.
- Each scene must specify the active `speaker` ('Teacher' or 'Student') and natural conversational narration that advances understanding.
- Address common student stumbling blocks authentically.
"""
        else:
            style_instruction = """
STYLE: TEACHER NARRATION MODE
- You must write this lesson script from the perspective of an expert, warm, and highly engaging classroom teacher.
- Tone: Relatable, crystal clear, didactic, and supportive.
- Use natural pedagogical hooks, intuitive real-world examples, step-by-step formula explanations, and short recap checks.
- Every scene has `speaker`: 'Teacher'.
"""

        # Revision feedback instruction
        feedback_instruction = ""
        effective_feedback = regeneration_feedback or getattr(video, "regeneration_feedback", None)
        if effective_feedback and effective_feedback.strip():
            feedback_instruction = f"""
ADMINISTRATOR REVISION FEEDBACK:
The administrator reviewed the previous version and explicitly requested:
'''{effective_feedback.strip()}'''
You MUST directly incorporate and satisfy this revision request in the generated script.
"""

        # Complete prompt construction
        system_instruction = f"""You are a master educational scriptwriter for VeyoraLabs.
Your mission is to generate an exceptional, textbook-grounded educational video lesson script for the topic: '{video.title}'.

CRITICAL GROUNDING AND ATTRIBUTION REQUIREMENTS:
1. Ground every single explanation, concept, definition, and formula strictly in the provided textbook pages.
2. DO NOT invent ungrounded external facts, alternate laws, or unverified scientific claims.
3. Preserve mathematical formulas, variables, units (SI), equations, and technical terminology exactly as written in the textbook.
4. EXAMPLE ATTRIBUTION AND GROUNDING RULES:
   - For every scene, distinguish carefully between material originating directly in the textbook versus newly generated teaching analogies or applications:
     • 'textbook_direct': When an example, exercise, calculation, or scenario is taken directly from the textbook text, set `example_origin: "textbook_direct"` and cite the exact textbook page numbers in `source_pages`.
     • 'generative_analogy': When you generate a creative analogy to make an abstract concept intuitive (e.g., comparing data structures to kitchen shelves, or electric current to water flow), set `example_origin: "generative_analogy"` and set `source_pages: []` (empty array). You MUST NOT assign textbook page references to newly generated analogies.
     • 'generative_application': When you generate a modern real-world application or engineering scenario not explicitly detailed in the textbook, set `example_origin: "generative_application"` and set `source_pages: []` (empty array). You MUST NOT assign textbook page references to newly generated applications.
     • For core non-example scenes (INTRO, OBJECTIVE, CONCEPT, DEFINITIONS, FORMULA, SUMMARY, CLOSING), set `example_origin: null` (or `"textbook_direct"` if directly citing a textbook example), and cite the source pages where the content is found in the textbook.
5. Target approximately {target_words} total spoken words across 6 to 10 structured scenes (optimal educational pacing of ~135–150 words per minute).

{style_instruction}
{feedback_instruction}
"""

        user_content = f"""TOPIC: {video.title}
ACADEMIC LEVEL: {academic_level}
TARGET WORD BUDGET: ~{target_words} words
TARGET DURATION: {video.estimated_duration_seconds or video.duration_seconds or 330} seconds
LEARNING OBJECTIVE: {video.learning_objective or f'Understand and apply core concepts of {video.title}'}
CONTENT OUTLINE: {', '.join(video.content_outline or [video.title])}

TEXTBOOK SOURCE MATERIAL:
{textbook_context}

Generate the complete structured lesson script conforming strictly to the requested JSON schema.
"""

        # Execute Gemini generation with retries
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                config = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeminiLessonScript,
                    temperature=0.2,
                )

                response = client.models.generate_content(
                    model=self.model_name,
                    contents=user_content,
                    config=config,
                )

                raw_text = response.text or ""
                # Strip optional markdown code fences if present
                clean_json = raw_text.strip()
                if clean_json.startswith("```"):
                    clean_json = re.sub(r"^```(?:json)?\n?", "", clean_json)
                    clean_json = re.sub(r"\n?```$", "", clean_json).strip()

                parsed = GeminiLessonScript.model_validate_json(clean_json)
                break
            except ValidationError as ve:
                last_error = GeminiGenerationError(f"Gemini output schema validation failed on attempt {attempt}: {str(ve)}")
                logger.warning("Gemini output validation error: %s", ve)
                time.sleep(0.5 * attempt)
            except Exception as e:
                last_error = e
                logger.warning("Gemini generation attempt %d failed: %s", attempt, e)
                time.sleep(0.5 * attempt)
        else:
            raise GeminiGenerationError(f"Gemini script generation failed after {self.max_retries} attempts: {str(last_error)}")

        # Post-process into canonical ScriptService sections format
        sections: List[Dict[str, Any]] = []
        total_words = 0
        all_narrations: List[str] = []

        for idx, sc in enumerate(parsed.sections, start=1):
            narr = sc.narration.strip()
            word_count = len(narr.split())
            total_words += word_count
            all_narrations.append(f"[{sc.section_type} - {sc.title}]\n({sc.speaker}) {narr}" if is_conversation else f"[{sc.section_type} - {sc.title}]\n{narr}")

            # Validate example attribution and textbook page grounding
            origin = sc.example_origin
            if origin in ["generative_analogy", "generative_application"]:
                # Generative examples must never cite textbook page numbers
                sc_pages: List[int] = []
            elif origin == "textbook_direct" or sc.section_type.upper() in ["EXAMPLE", "WORKED_EXAMPLE", "CONCRETE_EXAMPLE"]:
                # Textbook-derived examples must have valid source pages from all_page_numbers
                valid_pages = [p for p in (sc.source_pages or []) if p in all_page_numbers]
                if not valid_pages and origin == "textbook_direct":
                    warnings.append(f"Scene {idx} ({sc.title}): 'textbook_direct' example lacks valid textbook source pages.")
                sc_pages = valid_pages
            else:
                # General section: retain valid source pages that exist in all_page_numbers (no unsafe [start_p] fallback)
                sc_pages = [p for p in (sc.source_pages or []) if p in all_page_numbers]

            sections.append({
                "scene_number": idx,
                "section_id": idx,
                "section_type": sc.section_type.upper(),
                "type": sc.section_type.upper(),
                "title": sc.title,
                "narration": narr,
                "narration_text": narr,
                "speaker": sc.speaker or ("Student" if is_conversation and idx % 2 == 0 else "Teacher"),
                "visual_type": sc.visual_type.upper(),
                "visual_description": sc.visual_description,
                "on_screen_text": sc.on_screen_text,
                "formula": sc.formula,
                "diagram_description": sc.diagram_description,
                "animation_hint": sc.animation_hint or "FADE_IN",
                "source_pages": sc_pages,
                "example_origin": origin,
                "visual_data": {}
            })

        full_narration = "\n\n".join(all_narrations)

        return {
            "title": f"Educational Script: {video.title}",
            "sections": sections,
            "narration_text": full_narration,
            "word_count": total_words,
            "target_words": target_words,
            "generation_engine": "gemini",
            "narration_style": narration_style,
            "warnings": warnings,
            "source_page_start": start_p,
            "source_page_end": end_p,
            "regeneration_feedback": effective_feedback,
            "pedagogical_summary": parsed.pedagogical_summary
        }
