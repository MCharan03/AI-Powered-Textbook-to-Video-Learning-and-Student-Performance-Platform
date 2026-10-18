import os
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Protocol
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.models import (
    Topic, Subtopic, Chapter, Textbook, Video, ProcessingJob,
    JobStatus, VideoStatus
)
from ..services.pipeline_service import extract_pdf_pages


class AIProviderUnavailableError(Exception):
    """Raised when external AI LLM provider credentials are not configured."""
    pass


# ==============================================================================
# SEGMENTATION ENGINE PROTOCOL & FACTORY
# ==============================================================================

class VideoSegmentationEngine(Protocol):
    def segment_topic(
        self,
        topic: Topic,
        subtopics: List[Subtopic],
        pages_content: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Receives an approved topic, its subtopics, and optional page text.
        Returns a list of video plan dictionaries with estimated duration,
        semantic boundaries, learning objectives, and content outlines.
        """
        ...


class DeterministicVideoSegmentationEngine:
    """
    Deterministic educational segmentation engine.
    Applies pedagogical coherence rules, duration estimation, and semantic grouping:
    - Target duration: 300–360 seconds (approx. 5.5 min, 330s).
    - Respects semantic units (subtopics, concepts, procedures, worked examples).
    - Small topics -> 1 concise video without meaningless padding.
    - Medium topics -> 2 videos.
    - Large topics / large subtopics -> dynamically split across 3+ videos.
    """

    def __init__(
        self,
        target_min_seconds: int = settings.video_target_min_seconds,
        target_max_seconds: int = settings.video_target_max_seconds,
        target_seconds: int = settings.video_target_seconds,
        words_per_minute: int = settings.narration_words_per_minute,
        narration_words_per_minute: Optional[int] = None
    ):
        self.target_min_seconds = target_min_seconds
        self.target_max_seconds = target_max_seconds
        self.target_seconds = target_seconds
        self.words_per_minute = narration_words_per_minute or words_per_minute

    def estimate_duration(self, word_count: int) -> int:
        """Converts word count to spoken duration in seconds at educational pace."""
        words_per_second = self.words_per_minute / 60.0
        duration = int(math.ceil(word_count / words_per_second))
        return max(1, duration)

    def _estimate_duration(self, word_count: int) -> int:
        return self.estimate_duration(word_count)

    def _get_subtopic_text(
        self,
        sub: Subtopic,
        pages_content: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """Collects educational text for a subtopic from source page boundaries or fallback."""
        text_parts = [sub.title]
        if sub.description:
            text_parts.append(sub.description)

        if pages_content and sub.source_start_page:
            end_page = sub.source_end_page or sub.source_start_page
            for p in pages_content:
                p_num = p.get("page_number", 0)
                if sub.source_start_page <= p_num <= end_page:
                    t = p.get("text", "")
                    if t:
                        text_parts.append(t)

        return "\n".join(text_parts)

    def segment_topic(
        self,
        topic: Topic,
        subtopics: List[Subtopic],
        pages_content: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        # Sort subtopics by sequence number / order_idx
        sorted_subs = sorted(subtopics, key=lambda s: (s.sequence_number or 0, s.order_idx or 0))

        # Build semantic units from subtopics
        semantic_units: List[Dict[str, Any]] = []

        for sub in sorted_subs:
            text = self._get_subtopic_text(sub, pages_content)
            word_count = len(text.split())

            # Only fallback to synthetic baseline if subtopic has essentially zero content
            if word_count < 10 and not sub.description:
                word_count = 120 + (len(sub.title.split()) * 15)

            duration = self._estimate_duration(word_count)

            # Check if this single subtopic is VERY LARGE (e.g. > target_max_seconds * 1.5)
            # If so, break this subtopic into distinct conceptual parts
            if duration > (self.target_max_seconds * 1.3):
                num_parts = int(math.ceil(duration / self.target_seconds))
                part_duration = int(duration / num_parts)
                for part_idx in range(1, num_parts + 1):
                    semantic_units.append({
                        "subtopic_id": sub.id,
                        "subtopic_title": sub.title,
                        "unit_title": f"{sub.title} (Part {part_idx}: Fundamentals & Core Concepts)" if part_idx == 1 else f"{sub.title} (Part {part_idx}: Advanced Applications)",
                        "duration": part_duration,
                        "source_start_page": sub.source_start_page or topic.source_start_page or 1,
                        "source_end_page": sub.source_end_page or topic.source_end_page or (sub.source_start_page or 1),
                        "outline_items": [
                            f"Conceptual Core of {sub.title} (Part {part_idx})",
                            "Mathematical Formulations & Theoretical Grounding",
                            "Worked Examples & Problem-Solving Strategies",
                            "Real-World Engineering Context"
                        ]
                    })
            else:
                semantic_units.append({
                    "subtopic_id": sub.id,
                    "subtopic_title": sub.title,
                    "unit_title": sub.title,
                    "duration": duration,
                    "source_start_page": sub.source_start_page or topic.source_start_page or 1,
                    "source_end_page": sub.source_end_page or topic.source_end_page or (sub.source_start_page or 1),
                    "outline_items": [
                        f"Introduction to {sub.title}",
                        "Key Theoretical Insights & Definitions",
                        "Practical Illustrations & Analysis"
                    ]
                })

        # If no subtopics exist under topic, create a single baseline unit from topic metadata
        if not semantic_units:
            desc_words = len((topic.description or "").split())
            word_count = max(200, desc_words * 4)
            semantic_units.append({
                "subtopic_id": None,
                "subtopic_title": topic.title,
                "unit_title": topic.title,
                "duration": self._estimate_duration(word_count),
                "source_start_page": topic.source_start_page or 1,
                "source_end_page": topic.source_end_page or topic.source_start_page or 1,
                "outline_items": [
                    f"Comprehensive Overview of {topic.title}",
                    "Foundational Concepts and Terminology",
                    "Summary and Learning Objectives"
                ]
            })

        # Calculate total topic educational duration
        total_duration = sum(u["duration"] for u in semantic_units)

        # RULE 1: SMALL TOPIC (< target_max_seconds)
        # Create exactly 1 concise video without artificial padding!
        if total_duration <= self.target_max_seconds or len(semantic_units) == 1:
            all_outlines: List[str] = []
            for u in semantic_units:
                all_outlines.extend(u["outline_items"])

            start_page = min((u["source_start_page"] for u in semantic_units if u["source_start_page"]), default=topic.source_start_page or 1)
            end_page = max((u["source_end_page"] for u in semantic_units if u["source_end_page"]), default=topic.source_end_page or start_page)

            # Keep natural concise duration, capped reasonably
            estimated_sec = min(total_duration, self.target_seconds)

            single_title = semantic_units[0]["unit_title"]
            if not single_title or single_title == topic.title:
                single_title = f"{topic.title}: Fundamentals"

            return [{
                "title": single_title,
                "description": f"Comprehensive educational lesson covering core concepts of {topic.title}.",
                "sequence_number": 1,
                "estimated_duration_seconds": estimated_sec,
                "source_start_page": start_page,
                "source_end_page": end_page,
                "learning_objective": f"Understand and apply the foundational principles of {topic.title}.",
                "content_outline": all_outlines[:5],
                "subtopic_id": semantic_units[0]["subtopic_id"]
            }]

        # RULE 2: MEDIUM & LARGE TOPICS
        # Combine compatible semantic units so each video approaches ~300-360 seconds (target ~330s)
        video_plans: List[Dict[str, Any]] = []
        current_cluster: List[Dict[str, Any]] = []
        current_cluster_duration = 0

        for unit in semantic_units:
            # If adding this unit keeps us <= target_max_seconds, add it to the cluster
            if (current_cluster_duration + unit["duration"]) <= (self.target_max_seconds + 30):
                current_cluster.append(unit)
                current_cluster_duration += unit["duration"]
            else:
                # If current cluster already has content, emit a video plan
                if current_cluster:
                    plan = self._create_video_plan_from_cluster(
                        topic=topic,
                        cluster=current_cluster,
                        duration=current_cluster_duration,
                        seq_num=len(video_plans) + 1
                    )
                    video_plans.append(plan)

                # Start new cluster with current unit
                current_cluster = [unit]
                current_cluster_duration = unit["duration"]

        # Flush any remaining units in current cluster
        if current_cluster:
            plan = self._create_video_plan_from_cluster(
                topic=topic,
                cluster=current_cluster,
                duration=current_cluster_duration,
                seq_num=len(video_plans) + 1
            )
            video_plans.append(plan)

        return video_plans

    def _create_video_plan_from_cluster(
        self,
        topic: Topic,
        cluster: List[Dict[str, Any]],
        duration: int,
        seq_num: int
    ) -> Dict[str, Any]:
        """Creates a coherent video plan item from a cluster of semantic units."""
        start_page = min((u["source_start_page"] for u in cluster if u["source_start_page"]), default=topic.source_start_page or 1)
        end_page = max((u["source_end_page"] for u in cluster if u["source_end_page"]), default=topic.source_end_page or start_page)

        # Formulate title from subtopics in cluster
        titles = [u["unit_title"] for u in cluster]
        if len(titles) == 1:
            title = titles[0]
        elif len(titles) == 2:
            title = f"{titles[0]} & {titles[1]}"
        else:
            title = f"{titles[0]} and Related Concepts"

        # Formulate merged outline
        outline: List[str] = []
        for u in cluster:
            outline.extend(u["outline_items"])

        # Normalize duration within ~300-360 range if it's close, or retain estimated duration
        normalized_duration = max(180, min(duration, self.target_max_seconds))

        # Pedagogical learning objective
        objective = f"Understand, analyze, and apply concepts related to {', '.join(titles[:2])} within {topic.title}."

        return {
            "title": title,
            "description": f"Targeted educational lesson on {title} exploring theoretical mechanisms, definitions, and worked examples.",
            "sequence_number": seq_num,
            "estimated_duration_seconds": normalized_duration,
            "source_start_page": start_page,
            "source_end_page": end_page,
            "learning_objective": objective,
            "content_outline": outline[:6],
            "subtopic_id": cluster[0]["subtopic_id"]
        }


class LLMVideoSegmentationEngine:
    """Future LLM-based segmentation engine."""
    def segment_topic(
        self,
        topic: Topic,
        subtopics: List[Subtopic],
        pages_content: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise AIProviderUnavailableError("External LLM API credentials not configured. Use deterministic engine.")
        # Fallback to deterministic
        return DeterministicVideoSegmentationEngine().segment_topic(topic, subtopics, pages_content)


def get_video_segmentation_engine() -> VideoSegmentationEngine:
    """Factory returning the active video segmentation engine."""
    provider = os.environ.get("VIDEO_SEGMENTATION_ENGINE", "deterministic").lower()
    if provider == "llm":
        try:
            return LLMVideoSegmentationEngine()
        except AIProviderUnavailableError:
            return DeterministicVideoSegmentationEngine()
    return DeterministicVideoSegmentationEngine()


# ==============================================================================
# VIDEO SEGMENTATION SERVICE FUNCTIONS
# ==============================================================================

class VideoSegmentationService:
    """High-level orchestration service for intelligent video plan generation."""

    @staticmethod
    def _validate_approved_curriculum(entity: Any, entity_name: str):
        """Quality Rule: No video generated from unapproved curriculum."""
        status = getattr(entity, "status", None)
        if status and status.upper() not in ["APPROVED", "PUBLISHED"]:
            raise ValueError(
                f"Cannot generate video plans for unapproved curriculum: {entity_name} #{entity.id} is in status '{status}'"
            )

    @classmethod
    def generate_video_plan_for_topic(
        cls,
        db: Session,
        topic_id: int,
        job_id: Optional[int] = None,
        force_regenerate: bool = False
    ) -> List[Video]:
        topic = db.get(Topic, topic_id)
        if not topic:
            raise ValueError(f"Topic {topic_id} not found")

        # Setup or get ProcessingJob
        job = None
        if job_id:
            job = db.get(ProcessingJob, job_id)
        if not job:
            job = ProcessingJob(
                topic_id=topic.id,
                chapter_id=topic.chapter_id,
                textbook_id=topic.chapter.textbook_id if topic.chapter else None,
                job_type="VIDEO_PLAN_GENERATION",
                status="PROCESSING",
                progress=0.0,
                current_stage="VALIDATION",
                started_at=datetime.now(timezone.utc)
            )
            db.add(job)
            db.commit()

        try:
            # Validate curriculum approval
            cls._validate_approved_curriculum(topic, f"Topic '{topic.title}'")
            if topic.chapter:
                cls._validate_approved_curriculum(topic.chapter, f"Chapter '{topic.chapter.title}'")

            job.current_stage = "CONTENT_ANALYSIS"
            job.progress = 15.0
            db.commit()

            # Check for existing video plans
            existing_videos = db.query(Video).filter(Video.topic_id == topic.id).order_by(Video.sequence_number.asc()).all()
            if existing_videos and not force_regenerate:
                # Idempotency / No duplicate video plans without explicit regeneration
                job.status = "COMPLETED"
                job.progress = 100.0
                job.current_stage = "COMPLETED"
                job.completed_at = datetime.now(timezone.utc)
                db.commit()
                return existing_videos

            # Step 1: Content Analysis (30%)
            job.current_stage = "CONTENT_ANALYSIS"
            job.progress = 30.0
            db.commit()

            # Retrieve approved subtopics
            subtopics = [
                s for s in topic.subtopics
                if getattr(s, "status", "APPROVED") in ["APPROVED", "PUBLISHED", None]
            ]

            # Collect source page content if available
            pages_content = None
            if topic.chapter and topic.chapter.textbook:
                tb = topic.chapter.textbook
                file_path = tb.file_path
                if file_path:
                    pages_content = extract_pdf_pages(file_path, default_title=tb.title)

            # Step 2: Intelligent Segmentation (60%)
            job.current_stage = "INTELLIGENT_SEGMENTATION"
            job.progress = 60.0
            db.commit()

            engine = get_video_segmentation_engine()
            plan_items = engine.segment_topic(topic, subtopics, pages_content)

            # Step 3: Video Plan Persistence (90%)
            job.current_stage = "PLAN_PERSISTENCE"
            job.progress = 90.0
            db.commit()

            # If force_regenerate, clear previous plans
            if force_regenerate and existing_videos:
                for v in existing_videos:
                    db.delete(v)
                db.flush()

            created_videos: List[Video] = []
            for item in plan_items:
                # Validation Quality Rules
                if not item.get("title"):
                    raise ValueError("Generated video plan missing required title")
                if not item.get("content_outline"):
                    raise ValueError("Generated video plan missing required content outline")
                if item.get("estimated_duration_seconds", 0) <= 0:
                    raise ValueError("Generated video plan cannot have negative or zero duration")

                video = Video(
                    topic_id=topic.id,
                    subtopic_id=item.get("subtopic_id"),
                    textbook_id=topic.chapter.textbook_id if topic.chapter else None,
                    title=item["title"],
                    description=item.get("description"),
                    sequence_number=item["sequence_number"],
                    duration_seconds=item["estimated_duration_seconds"],
                    estimated_duration_seconds=item["estimated_duration_seconds"],
                    source_start_page=item.get("source_start_page"),
                    source_end_page=item.get("source_end_page"),
                    learning_objective=item.get("learning_objective"),
                    content_outline=item.get("content_outline"),
                    status="REVIEW"
                )
                db.add(video)
                db.flush()
                created_videos.append(video)

            # Step 4: Complete Job (100%)
            job.status = "COMPLETED"
            job.progress = 100.0
            job.current_stage = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return created_videos

        except Exception as e:
            db.rollback()
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise e

    @classmethod
    def generate_video_plans_for_chapter(
        cls,
        db: Session,
        chapter_id: int,
        job_id: Optional[int] = None,
        force_regenerate: bool = False
    ) -> List[Video]:
        chapter = db.get(Chapter, chapter_id)
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

        cls._validate_approved_curriculum(chapter, f"Chapter '{chapter.title}'")

        all_videos: List[Video] = []
        approved_topics = [t for t in chapter.topics if getattr(t, "status", "APPROVED") in ["APPROVED", "PUBLISHED"]]

        if not approved_topics:
            raise ValueError(f"Chapter '{chapter.title}' has no approved topics to segment")

        for topic in approved_topics:
            v_list = cls.generate_video_plan_for_topic(db, topic.id, force_regenerate=force_regenerate)
            all_videos.extend(v_list)

        return all_videos

    @classmethod
    def generate_video_plans_for_textbook(
        cls,
        db: Session,
        textbook_id: int,
        job_id: Optional[int] = None,
        force_regenerate: bool = False
    ) -> List[Video]:
        textbook = db.get(Textbook, textbook_id)
        if not textbook:
            raise ValueError(f"Textbook {textbook_id} not found")

        tb_status = textbook.status.value if hasattr(textbook.status, "value") else str(textbook.status)
        if tb_status.upper() not in ["APPROVED", "PUBLISHED"]:
            raise ValueError(f"Cannot generate video plans: Textbook #{textbook_id} is in status '{tb_status}'")

        all_videos: List[Video] = []
        approved_chapters = [c for c in textbook.chapters if getattr(c, "status", "APPROVED") in ["APPROVED", "PUBLISHED"]]

        if not approved_chapters:
            raise ValueError(f"Textbook '{textbook.title}' has no approved chapters to segment")

        for ch in approved_chapters:
            v_list = cls.generate_video_plans_for_chapter(db, ch.id, force_regenerate=force_regenerate)
            all_videos.extend(v_list)

        return all_videos

    @classmethod
    def regenerate_video_plan_preview(
        cls,
        db: Session,
        topic_id: int
    ) -> Dict[str, Any]:
        """
        Safe regeneration preview:
        Generates candidate video plans in memory without overwriting active plans,
        returning a side-by-side comparison for Admin confirmation.
        """
        topic = db.get(Topic, topic_id)
        if not topic:
            raise ValueError(f"Topic {topic_id} not found")

        cls._validate_approved_curriculum(topic, f"Topic '{topic.title}'")

        existing_videos = db.query(Video).filter(Video.topic_id == topic.id).order_by(Video.sequence_number.asc()).all()
        current_plans = [
            {
                "id": v.id,
                "title": v.title,
                "sequence_number": v.sequence_number,
                "estimated_duration_seconds": v.estimated_duration_seconds or v.duration_seconds,
                "source_start_page": v.source_start_page,
                "source_end_page": v.source_end_page,
                "learning_objective": v.learning_objective,
                "status": v.status
            }
            for v in existing_videos
        ]

        subtopics = [
            s for s in topic.subtopics
            if getattr(s, "status", "APPROVED") in ["APPROVED", "PUBLISHED", None]
        ]

        pages_content = None
        if topic.chapter and topic.chapter.textbook and topic.chapter.textbook.file_path:
            pages_content = extract_pdf_pages(topic.chapter.textbook.file_path, default_title=topic.chapter.textbook.title)

        engine = get_video_segmentation_engine()
        candidate_plans = engine.segment_topic(topic, subtopics, pages_content)

        return {
            "topic_id": topic.id,
            "topic_title": topic.title,
            "has_existing_plans": len(current_plans) > 0,
            "current_plans": current_plans,
            "new_plans": candidate_plans,
            "comparison": {
                "current_count": len(current_plans),
                "new_count": len(candidate_plans),
                "current_total_duration": sum(p["estimated_duration_seconds"] for p in current_plans),
                "new_total_duration": sum(p["estimated_duration_seconds"] for p in candidate_plans),
            },
            "message": "Candidate plan generated safely. Existing approved/canonical plans were NOT modified."
        }
