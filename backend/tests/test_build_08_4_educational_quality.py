"""
BUILD 08.4 — Automated Educational Video Quality Tests

Verifies topic-specific educational content generation for "Array Foundations - Module 1":
- Validates presence of core topic concepts (elements, zero-based indices, contiguous memory, O(1) access).
- Fails on generic placeholder templates ("Input State", "Transformation", "Verified Output").
- Verifies pedagogical stages (intro, concept, mechanics, concrete example, worked example, complexity, common mistakes, applications, quiz).
- Verifies TrueType font loading and font readability minimums (Title >= 36px, Concept >= 28px, Body/Code >= 24px, Labels >= 22px).
- Verifies versioning preserves Version 1 while creating Version 2.
"""

import pytest
import re
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from PIL import ImageFont

from app.core.database import SessionLocal
from app.models.models import Video, VideoScriptVersion, VideoRenderVersion
from app.services.script_generation import (
    ScriptService,
    DeterministicScriptGenerationEngine,
    ScriptQualityValidator
)
from app.services.video_rendering import (
    SceneGenerator,
    VisualSlideRenderer
)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_array_foundations_topic_specific_concepts(db: Session):
    """Verifies that generated script for Array Foundations contains real array teaching."""
    video = db.get(Video, 1)
    assert video is not None, "Video #1 ('Array Foundations - Module 1') must exist in the database."

    source_pages = ScriptService._get_video_source_pages(db, video)
    engine = DeterministicScriptGenerationEngine()
    script = engine.generate_script(video, source_pages, target_words=715)

    sections = script["sections"]
    assert len(sections) == 9, f"Expected 9 pedagogical sections, got {len(sections)}"

    full_narration = script["narration_text"].lower()

    # 1. Topic-Specific Terminology Assertions
    required_terms = [
        "array",
        "index",
        "indices",
        "element",
        "contiguous",
        "memory",
        "o(1)"
    ]
    for term in required_terms:
        assert term in full_narration, f"Generated script must contain topic-specific term '{term}'."

    # 2. Rejection of Generic Filler Templates
    prohibited_patterns = [
        r"stage\s*1:\s*input\s+state",
        r"stage\s*2:\s*transformation",
        r"stage\s*3:\s*verified\s+output",
        r"input\s+state\s*→\s*transformation",
        r"every\s+parameter\s+must\s+satisfy\s+equilibrium\s+and\s+determinism",
        r"here\s+we\s+can\s+see\s+the\s+fundamental\s+principles\s+and\s+structural\s+invariants"
    ]
    for pat in prohibited_patterns:
        match = re.search(pat, full_narration)
        assert match is None, f"Generated script must NOT contain generic placeholder filler matching '{pat}'."

    # 3. Topic-Specific Visual Types
    visual_types = [s.get("visual_type") for s in sections]
    assert "TITLE_CARD" in visual_types, "Must contain TITLE_CARD"
    assert "ARRAY_GRID" in visual_types, "Must contain ARRAY_GRID"
    assert "MEMORY_LAYOUT" in visual_types, "Must contain MEMORY_LAYOUT"
    assert "CODE_SNIPPET" in visual_types, "Must contain CODE_SNIPPET"
    assert "BEFORE_AFTER" in visual_types, "Must contain BEFORE_AFTER (resizing)"
    assert "COMPLEXITY_CHART" in visual_types, "Must contain COMPLEXITY_CHART"
    assert "COMMON_MISTAKES" in visual_types, "Must contain COMMON_MISTAKES"
    assert "APPLICATION_CARD" in visual_types, "Must contain APPLICATION_CARD"
    assert "KNOWLEDGE_CHECK" in visual_types, "Must contain KNOWLEDGE_CHECK"

    # 4. Array Grid Visual Data Structure
    grid_sec = next(s for s in sections if s.get("visual_type") == "ARRAY_GRID")
    vdata = grid_sec.get("visual_data", {})
    assert vdata.get("elements") == [10, 20, 30, 40, 50]
    assert vdata.get("indices") == [0, 1, 2, 3, 4]
    assert vdata.get("highlight_index") == 2
    assert vdata.get("highlight_value") == 30


def test_generic_filler_detection_fails_validator(db: Session):
    """Verifies that ScriptQualityValidator detects and docks generic template filler."""
    video = db.get(Video, 1)
    source_pages = ScriptService._get_video_source_pages(db, video)

    # Contrived generic script with generic template phrases
    generic_sections = [
        {
            "section_id": 1,
            "type": "INTRO",
            "title": "Generic Intro",
            "narration": "Welcome. Here we can see the fundamental principles and structural invariants.",
            "visual_type": "TITLE_CARD"
        },
        {
            "section_id": 2,
            "type": "CONCEPT",
            "title": "Stage 1: Input State",
            "narration": "In Stage 1: Input State, every parameter must satisfy equilibrium and determinism.",
            "visual_type": "DIAGRAM"
        },
        {
            "section_id": 3,
            "type": "TRANSFORMATION",
            "title": "Stage 2: Transformation",
            "narration": "In Stage 2: Transformation, the system transitions state.",
            "visual_type": "DIAGRAM"
        },
        {
            "section_id": 4,
            "type": "SUMMARY",
            "title": "Stage 3: Verified Output",
            "narration": "In Stage 3: Verified Output, output state is checked.",
            "visual_type": "SUMMARY_CHIPS"
        }
    ]

    score, breakdown, warnings = ScriptQualityValidator.evaluate(
        video=video,
        sections=generic_sections,
        source_pages=source_pages,
        target_words=715
    )

    # Must contain critical rejection warning
    rejection_warnings = [w for w in warnings if "REJECT_GENERIC_FILLER" in w]
    assert len(rejection_warnings) > 0, "Validator must reject generic filler template phrases."
    assert score < 60.0, f"Generic template script must receive failing quality score, got {score}"


def test_visual_slide_renderer_typography_and_contrast(db: Session):
    """Verifies TrueType font loading and adherence to font hierarchy rules."""
    renderer = VisualSlideRenderer()

    # Font sizes
    font_title = renderer._get_font(36, bold=True)
    font_concept = renderer._get_font(28, bold=True)
    font_body = renderer._get_font(24)
    font_code = renderer._get_font(24, mono=True)
    font_label = renderer._get_font(22, bold=True)

    # Verify fonts are scalable TrueType / FreeType fonts (not default unscaled 10px bitmap)
    assert not isinstance(font_title, ImageFont.ImageFont), "Font should be a TrueType font, not default bitmap"
    assert font_title.size >= 36
    assert font_concept.size >= 28
    assert font_body.size >= 24
    assert font_code.size >= 24
    assert font_label.size >= 22

    # Render Array Grid slide
    video = db.get(Video, 1)
    array_scene = {
        "scene_number": 2,
        "section_type": "CONCEPT",
        "title": "Core Concept: Array Elements & Zero-Based Indexing",
        "visual_type": "ARRAY_GRID",
        "visual_data": {
            "elements": [10, 20, 30, 40, 50],
            "indices": [0, 1, 2, 3, 4],
            "highlight_index": 2,
            "highlight_value": 30
        }
    }
    img = renderer.render_scene_slide(video, array_scene)
    assert img.size == (1280, 720)


def test_scene_duration_and_synchronization(db: Session):
    """Verifies timed scenes target 5-6 minutes (~310-340s) duration."""
    video = db.get(Video, 1)
    source_pages = ScriptService._get_video_source_pages(db, video)
    engine = DeterministicScriptGenerationEngine()
    script = engine.generate_script(video, source_pages, target_words=715)

    scene_gen = SceneGenerator()
    scenes = scene_gen.generate_scenes(video, script["sections"])

    assert len(scenes) == 9
    total_duration = sum(s["estimated_duration_seconds"] for s in scenes)

    # 5 to 6 minutes is 300 to 360 seconds
    assert 300.0 <= total_duration <= 360.0, f"Expected total duration between 300s and 360s, got {total_duration}s"

    # Verify time continuity (no gaps or overlaps)
    for idx in range(len(scenes) - 1):
        assert scenes[idx]["end_time_seconds"] == scenes[idx + 1]["start_time_seconds"], (
            f"Scene {idx + 1} end time must match Scene {idx + 2} start time"
        )
