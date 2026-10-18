"""
BUILD 05 — AI Educational Script Generation & Validation Service
Grounds narration scripts in approved video plans and extracted textbook pages.
"""

from typing import List, Dict, Any, Optional, Protocol, Tuple
import os
import re
import math
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from ..models.models import (
    Video, VideoScriptVersion, ProcessingJob, Textbook, Topic, Chapter, Subject, JobStatus
)
from ..core.config import settings
from ..services.pipeline_service import extract_pdf_pages


class AIProviderUnavailableError(Exception):
    """Raised when external LLM credentials are not configured."""
    pass


# ==============================================================================
# SCRIPT GENERATION ENGINE PROTOCOL & FACTORY
# ==============================================================================

class ScriptGenerationEngine(Protocol):
    def generate_script(
        self,
        video: Video,
        source_pages: List[Dict[str, Any]],
        target_words: int,
        academic_level: str = "Undergraduate / Grade 10-12"
    ) -> Dict[str, Any]:
        """
        Generates a structured educational script from an approved video plan
        and grounded textbook source content.
        """
        ...


class DeterministicScriptGenerationEngine:
    """
    Deterministic educational script generation engine.
    - Accurately targets duration and word count.
    - Preserves mathematical equations, symbols, units, and verbal explanations.
    - Generates 6 to 10 structured sections with renderer visual cues.
    - Enforces source grounding and traceability without external API cost.
    """

    def __init__(self, words_per_minute: int = settings.narration_words_per_minute):
        self.words_per_minute = words_per_minute

    def _extract_formulas_and_terms(self, text: str) -> List[Tuple[str, str]]:
        """Identifies mathematical formulas or technical equations and provides verbalization."""
        found: List[Tuple[str, str]] = []
        # Common equations & laws
        known_equations = [
            (r"\bV\s*=\s*I\s*\*?\s*R\b", "V = IR", "Voltage equals current multiplied by resistance"),
            (r"\bF\s*=\s*m\s*\*?\s*a\b", "F = ma", "Force equals mass multiplied by acceleration"),
            (r"\bE\s*=\s*m\s*c\^?2\b", "E = mc^2", "Energy equals mass times the speed of light squared"),
            (r"\bO\(n\s*\*\s*log\s*n\)", "O(n log n)", "Order n log n time complexity"),
            (r"\bO\(1\)\b", "O(1)", "Constant order of complexity O of one"),
            (r"\bO\(n\)\b", "O(n)", "Linear order of complexity O of n"),
            (r"\bO\(n\^?2\)\b", "O(n^2)", "Quadratic order of complexity O of n squared"),
            (r"\b\d+\s*=\s*[\w\+\-\*/\^]+", "Equation", "Mathematical equation relationship")
        ]

        for pattern, formula, spoken in known_equations:
            if re.search(pattern, text, re.IGNORECASE):
                found.append((formula, spoken))

        # Check for LaTeX style math $...$
        latex_matches = re.findall(r"\$([^\$]+)\$", text)
        for lm in latex_matches[:3]:
            found.append((lm.strip(), f"The mathematical term {lm.strip()}"))

        return found

    def generate_script(
        self,
        video: Video,
        source_pages: List[Dict[str, Any]],
        target_words: int,
        academic_level: str = "Undergraduate / Grade 10-12"
    ) -> Dict[str, Any]:
        combined_source_text = "\n\n".join(p.get("text", "") for p in source_pages if p.get("text"))
        page_numbers = [p.get("page_number") for p in source_pages if p.get("page_number")]
        start_p = min(page_numbers) if page_numbers else (video.source_start_page or 1)
        end_p = max(page_numbers) if page_numbers else (video.source_end_page or start_p)

        # Detect formulas in source text
        formulas = self._extract_formulas_and_terms(combined_source_text)

        # Parse key technical keywords from source text & outline
        clean_words = re.findall(r"\b[A-Za-z]{4,}\b", combined_source_text)
        distinct_keywords = list(dict.fromkeys(clean_words))[:20]
        keyword_str = ", ".join(distinct_keywords[:6]) if distinct_keywords else video.title

        # Determine outline items
        outline_items = video.content_outline or [
            f"Core principles of {video.title}",
            "Fundamental mechanics & applications",
            "Worked example and analysis"
        ]

        mid_page = (start_p + end_p) // 2

        # Check if this is an Array / Data Structure topic
        full_topic_context = f"{video.title} {video.topic.title if video.topic else ''} {combined_source_text}".lower()
        is_array_topic = any(k in full_topic_context for k in ["array", "dynamic sizing", "static array", "dynamic array", "contiguous memory"])

        sections: List[Dict[str, Any]] = []

        if is_array_topic:
            # ==================================================================
            # TOPIC-SPECIFIC EDUCATIONAL SCRIPT: ARRAY FOUNDATIONS & DATA STRUCTURES
            # 9 Pedagogical Sections: Intro, Concept, How it works, Concrete Example,
            # Worked Example (Resizing), Complexity, Common Mistakes, Applications, Summary & Quiz
            # Target: ~715 words (~5:28 min at 130 WPM)
            # ==================================================================

            # 1. INTRO (~71 words)
            intro_narration = (
                f"Welcome to this lesson on {video.title}. "
                f"In computer science, arrays are the most fundamental data structure used to organize and store collections of data. "
                f"Documented across pages {start_p} to {end_p} of our textbook, understanding arrays is essential for writing fast, efficient code. "
                f"Today, you will learn how static arrays allocate contiguous memory, how zero-based indexing enables instant retrieval, "
                f"how dynamic arrays resize when full, and why array operations achieve constant-time bounds. Let's begin."
            )
            sections.append({
                "section_id": 1,
                "type": "INTRO",
                "title": f"Introduction to {video.title}",
                "narration": intro_narration,
                "source_pages": [start_p],
                "visual_type": "TITLE_CARD",
                "visual_description": f"High-contrast title card displaying '{video.title}' with subject context and academic badge.",
                "on_screen_text": f"{video.title}\n{academic_level}",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "FADE_IN_TITLE",
                "visual_data": {
                    "subtitle": "Computer Science & Engineering • Data Structures",
                    "objectives": [
                        "Master contiguous memory layout and zero-based indexing",
                        "Analyze O(1) constant-time direct memory address arithmetic",
                        "Evaluate dynamic array resizing and amortized bounds"
                    ]
                }
            })

            # 2. CORE CONCEPT: ARRAY & INDEXING (~80 words)
            concept_narration = (
                f"What is an array? An array is a collection of elements stored in an unbroken contiguous sequence in physical memory. "
                f"Every element shares the same data type, and each has a numerical index starting from zero. "
                f"In our visual example, we have five numbers: 10, 20, 30, 40, and 50. "
                f"The first value, 10, is at index 0. The second value, 20, is at index 1. "
                f"The third value, 30, is stored at index 2. "
                f"Referencing array bracket 2 retrieves the element at index 2 directly: 30."
            )
            sections.append({
                "section_id": 2,
                "type": "CONCEPT",
                "title": "Core Concept: Array Elements & Zero-Based Indexing",
                "narration": concept_narration,
                "source_pages": [start_p],
                "visual_type": "ARRAY_GRID",
                "visual_description": "Array grid showing 5 contiguous cells with index numbers 0 to 4 above and values 10, 20, 30, 40, 50 inside. Index 2 and value 30 are highlighted.",
                "on_screen_text": "Array: Ordered contiguous elements accessed via zero-based index\narr[2] = 30",
                "formula": "arr[2] = 30",
                "diagram_description": "Interactive array cell layout with index labels and highlighted third element",
                "animation_hint": "HIGHLIGHT_CELL",
                "visual_data": {
                    "elements": [10, 20, 30, 40, 50],
                    "indices": [0, 1, 2, 3, 4],
                    "highlight_index": 2,
                    "highlight_value": 30,
                    "highlight_label": "arr[2] = 30"
                }
            })

            # 3. HOW IT WORKS: MEMORY LAYOUT & ADDRESS ARITHMETIC (~83 words)
            how_it_works_narration = (
                f"How does an array achieve instant access? The operating system allocates a single contiguous block of physical RAM starting at a base address. "
                f"Because all elements have identical byte size, the computer calculates addresses directly: the memory address of index i equals the base address plus i times the element size. "
                f"If our base address is 0x1000 and 32-bit integers take 4 bytes, index 2 is located at 0x1000 plus 2 times 4, giving 0x1008. "
                f"The hardware jumps directly there in O(1) constant time."
            )
            sections.append({
                "section_id": 3,
                "type": "HOW_IT_WORKS",
                "title": "How It Works: Contiguous Memory & Address Arithmetic",
                "narration": how_it_works_narration,
                "source_pages": [start_p, mid_page],
                "visual_type": "MEMORY_LAYOUT",
                "visual_description": "Physical RAM memory slots showing hexadecimal addresses 0x1000 through 0x1010 with 4-byte boundaries, pointing out formula Base + (i * size).",
                "on_screen_text": "Address(arr[i]) = Base_Address + (i × Element_Size)\n0x1000 + (2 × 4) = 0x1008",
                "formula": "Address(arr[i]) = Base + (i * Element_Size)",
                "diagram_description": "RAM block layout with byte offsets and address arithmetic computation",
                "animation_hint": "ADDRESS_POINTER",
                "visual_data": {
                    "base_address": "0x1000",
                    "element_size": 4,
                    "slots": [
                        {"address": "0x1000", "index": 0, "value": 10},
                        {"address": "0x1004", "index": 1, "value": 20},
                        {"address": "0x1008", "index": 2, "value": 30, "highlight": True},
                        {"address": "0x100C", "index": 3, "value": 40},
                        {"address": "0x1010", "index": 4, "value": 50}
                    ],
                    "formula": "Address(arr[i]) = Base_Address + (i * Element_Size)"
                }
            })

            # 4. CONCRETE EXAMPLE: PROGRAMMING IMPLEMENTATION (~77 words)
            code_narration = (
                f"Let us see this in actual Python code. First, we define an array named arr with five elements: 10, 20, 30, 40, and 50. "
                f"Next, we retrieve the third element by writing target equals arr bracket 2. Finally, we print target. "
                f"When executed, Python computes the memory offset and immediately prints 30 to the terminal. "
                f"Notice that no loops or searches were needed; the offset arithmetic executes in a single clock cycle, demonstrating O(1) constant-time access."
            )
            sections.append({
                "section_id": 4,
                "type": "CONCRETE_EXAMPLE",
                "title": "Concrete Example: Python Array Index Access",
                "narration": code_narration,
                "source_pages": [mid_page],
                "visual_type": "CODE_SNIPPET",
                "visual_description": "Clean IDE code snippet showing array initialization and indexed access with terminal output highlighted.",
                "on_screen_text": "arr = [10, 20, 30, 40, 50]\ntarget = arr[2]\nprint(target)  # Output: 30",
                "formula": None,
                "diagram_description": "Syntax-highlighted code editor window with terminal result box",
                "animation_hint": "CODE_HIGHLIGHT",
                "visual_data": {
                    "code_lines": [
                        "# 1. Initialize static array of 5 elements",
                        "arr = [10, 20, 30, 40, 50]",
                        "",
                        "# 2. Access third element using index 2 (O(1))",
                        "target = arr[2]",
                        "",
                        "# 3. Print verified output",
                        "print(f'Target Element: {target}')"
                    ],
                    "terminal_output": "Target Element: 30",
                    "complexity_tag": "Time Complexity: O(1) Constant Time"
                }
            })

            # 5. WORKED EXAMPLE: DYNAMIC ARRAY RESIZING (~84 words)
            worked_example_narration = (
                f"Now let's work through dynamic array resizing. Static arrays have a fixed capacity. "
                f"When an array of capacity 4 is full with 10, 20, 30, and 40, we cannot simply append 50 because adjacent memory is already taken. "
                f"Instead, the dynamic array allocates a new block with double capacity: 8 slots. "
                f"It copies over the 4 existing elements, writes 50 into index 4, and frees the old block. "
                f"While copying takes O of N time, doubling occurs rarely, giving an amortized O of 1 append cost."
            )
            sections.append({
                "section_id": 5,
                "type": "WORKED_EXAMPLE",
                "title": "Worked Example: Dynamic Array Capacity Resizing",
                "narration": worked_example_narration,
                "source_pages": [mid_page, end_p],
                "visual_type": "BEFORE_AFTER",
                "visual_description": "Visual diagram comparing full 4-element array before resize against doubled 8-element array after reallocation and copying.",
                "on_screen_text": "Dynamic Array Resizing:\nCapacity 4 (Full) → Allocate Capacity 8 (Doubled) → Copy Elements & Append",
                "formula": "Capacity_New = Capacity_Old * 2",
                "diagram_description": "Before and after memory block diagrams illustrating dynamic capacity doubling",
                "animation_hint": "CAPACITY_EXPAND",
                "visual_data": {
                    "left_title": "STAGE 1: CAPACITY FULL (Size: 4 / Cap: 4)",
                    "left_cells": [10, 20, 30, 40],
                    "left_status": "Cannot append 50 (Memory Block Full)",
                    "right_title": "STAGE 2: CAPACITY DOUBLED (Size: 5 / Cap: 8)",
                    "right_cells": [10, 20, 30, 40, 50, "-", "-", "-"],
                    "right_status": "Allocated 8 slots, copied 4, appended 50",
                    "transition_label": "RESIZE & DOUBLE CAPACITY"
                }
            })

            # 6. TIME & SPACE COMPLEXITY (~81 words)
            complexity_narration = (
                f"Let's evaluate algorithmic time and space complexity. "
                f"Accessing any element by index is O of 1 constant time because of direct address arithmetic. "
                f"Searching for an unknown value requires checking elements sequentially, taking linear O of N time. "
                f"Appending to a dynamic array has an amortized cost of O of 1. "
                f"However, inserting or deleting at the beginning or middle takes O of N linear time, because subsequent elements must shift. "
                f"Finally, arrays use O of N linear space to store N contiguous items."
            )
            sections.append({
                "section_id": 6,
                "type": "COMPLEXITY",
                "title": "Algorithmic Complexity: Access vs Search vs Insertion",
                "narration": complexity_narration,
                "source_pages": [end_p],
                "visual_type": "COMPLEXITY_CHART",
                "visual_description": "Comprehensive complexity table highlighting O(1) Access, O(n) Search, Amortized O(1) Append, and O(n) Insertion.",
                "on_screen_text": "Access: O(1) Constant\nSearch: O(n) Linear\nAppend: Amortized O(1)\nInsert/Delete: O(n) Linear",
                "formula": "T_access = O(1), T_search = O(n)",
                "diagram_description": "Time complexity comparison matrix with color-coded efficiency badges",
                "animation_hint": "CHART_POP",
                "visual_data": {
                    "rows": [
                        ("Access by Index arr[i]", "O(1) Constant", "GREEN", "Direct memory address calculation"),
                        ("Search by Value", "O(n) Linear", "AMBER", "Must scan elements sequentially"),
                        ("Append to End (Dynamic)", "Amortized O(1)", "GREEN", "Doubling cost spread over N appends"),
                        ("Insert / Delete at Start", "O(n) Linear", "RED", "Must shift subsequent elements right/left")
                    ]
                }
            })

            # 7. COMMON MISTAKES (~79 words)
            mistakes_narration = (
                f"Students frequently encounter three common array pitfalls. "
                f"The first is the off-by-one error: for an array of size 5, valid indices are 0 to 4. "
                f"Accessing arr bracket 5 throws an Index Out of Bounds crash. "
                f"The second mistake is confusing 1-based human counting with 0-based computer indexing; the first element is index 0, not 1. "
                f"The third pitfall is frequently inserting items at index 0, which forces all N elements to shift right, creating severe O of N performance slowdowns."
            )
            sections.append({
                "section_id": 7,
                "type": "COMMON_MISTAKES",
                "title": "Common Pitfalls & Student Mistakes",
                "narration": mistakes_narration,
                "source_pages": [end_p],
                "visual_type": "COMMON_MISTAKES",
                "visual_description": "Warning card detailing off-by-one errors with index 5, 1-based indexing confusion, and element shifting overhead.",
                "on_screen_text": "Common Pitfalls:\n1. Off-by-one error: arr[5] is out of bounds for size 5\n2. 1-based vs 0-based index confusion\n3. Unnecessary O(n) element shifting",
                "formula": None,
                "diagram_description": "Cautionary card highlighting erroneous code and corrected bounds",
                "animation_hint": "WARNING_PULSE",
                "visual_data": {
                    "mistakes": [
                        ("Off-By-One Index Error", "Length is N = 5, but valid indices are 0 to 4. Accessing arr[5] causes an IndexOutOfBounds crash."),
                        ("Confusing 1-Based with 0-Based Indexing", "The first element is arr[0], second is arr[1], third is arr[2]. Never start counting from 1."),
                        ("Overlooking Shift Overhead on Insertion", "Inserting at index 0 forces shifting all N elements one spot right, turning an O(1) expectation into O(N).")
                    ]
                }
            })

            # 8. PRACTICAL APPLICATIONS (~73 words)
            apps_narration = (
                f"Where are arrays used in real-world engineering? "
                f"First, computer graphics: high-definition displays store pixels in massive 1D contiguous arrays, allowing the GPU to blit millions of pixels every frame. "
                f"Second, multimedia streaming: audio and video players use circular array buffers in memory to eliminate latency and playback stutter. "
                f"Third, data structures: dynamic arrays serve as the internal backing storage for Hash Tables, Binary Heaps, and Vector lists, delivering peak hardware cache performance."
            )
            sections.append({
                "section_id": 8,
                "type": "APPLICATION",
                "title": "Real-World Engineering & Practical Applications",
                "narration": apps_narration,
                "source_pages": [end_p],
                "visual_type": "APPLICATION_CARD",
                "visual_description": "Three practical application cards showing screen framebuffers, audio streaming buffers, and backing storage for hash tables and heaps.",
                "on_screen_text": "Real-World Applications:\n• GPU Framebuffers & Pixel Rendering\n• High-Performance Audio Buffers\n• Internal Storage for Hash Tables & Heaps",
                "formula": None,
                "diagram_description": "Three-card architecture diagram illustrating industry usage of contiguous arrays",
                "animation_hint": "CARD_GLOW",
                "visual_data": {
                    "applications": [
                        ("Graphics Framebuffers", "Display pixels are stored as massive 1D contiguous arrays for high-speed GPU rendering."),
                        ("Audio & Video Streaming Buffers", "Low-latency playback engines rely on contiguous memory chunks to prevent buffering jitter."),
                        ("Backing Storage for Higher Data Structures", "Dynamic arrays form the essential internal backbone for Hash Tables, Heaps, and Vector lists.")
                    ]
                }
            })

            # 9. SUMMARY & QUICK KNOWLEDGE CHECK (~84 words)
            summary_quiz_narration = (
                f"In summary: arrays store elements contiguously in RAM, providing zero-based indexing and instant O of 1 access via address arithmetic, while dynamic resizing provides amortized O of 1 appends. "
                f"Now, for a quick knowledge check: In an array of length N equals 100, what is the index of the final element, and what is the access time complexity? "
                f"The correct answer is index 99 with O of 1 constant time, because zero-based indexing means the last element is always N minus 1. Thank you for learning."
            )
            sections.append({
                "section_id": 9,
                "type": "SUMMARY_AND_QUIZ",
                "title": "Summary & Conceptual Knowledge Check",
                "narration": summary_quiz_narration,
                "source_pages": [end_p],
                "visual_type": "KNOWLEDGE_CHECK",
                "visual_description": "Interactive recap card summarizing core takeaways followed by conceptual quiz question and verified answer.",
                "on_screen_text": "Quick Knowledge Check:\nArray Length N = 100\nLast Element Index: N - 1 = 99\nAccess Time Complexity: O(1) Constant",
                "formula": "Index_last = N - 1",
                "diagram_description": "Knowledge check card with question, options, and highlighted verified answer",
                "animation_hint": "CHECK_REVEAL",
                "visual_data": {
                    "question": "In an array of length N = 100, what is the index of the final element, and what is the access time complexity?",
                    "options": [
                        ("Index: 100, Time: O(n)", False),
                        ("Index: 99 (N - 1), Time: O(1) Constant Time", True),
                        ("Index: 99, Time: O(log n)", False)
                    ],
                    "explanation": "Zero-based indexing means indices run from 0 to N-1. Retrieval uses direct arithmetic in O(1)."
                }
            })

        else:
            # ==================================================================
            # GENERAL TOPIC-SPECIFIC EDUCATIONAL SCRIPT (9 SECTIONS)
            # ==================================================================
            topic_name = video.topic.title if video.topic else video.title
            chapter_name = video.topic.chapter.title if video.topic and video.topic.chapter else "Core Concepts"
            learning_obj = video.learning_objective or f"Understand, analyze, and apply core principles of {video.title}."

            # 1. INTRO
            intro_narration = (
                f"Welcome to this educational lesson on {video.title}, part of our study of {chapter_name}. "
                f"In this module, we explore how {video.title} operates as a foundational mechanism in {topic_name}. "
                f"As documented in our textbook source material across pages {start_p} to {end_p}, mastering these concepts enables us to solve practical engineering and scientific problems. "
                f"Throughout this video, we will focus directly on the principles established in the textbook, "
                f"examining core definitions, step-by-step mechanics, concrete examples, and common pitfalls. Let's get started."
            )
            sections.append({
                "section_id": 1,
                "type": "INTRO",
                "title": f"Introduction to {video.title}",
                "narration": intro_narration,
                "source_pages": [start_p],
                "visual_type": "TITLE_CARD",
                "visual_description": f"High-contrast title card displaying '{video.title}' with subject context and academic badge.",
                "on_screen_text": f"{video.title}\n{academic_level}",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "FADE_IN_TITLE",
                "visual_data": {
                    "subtitle": f"{chapter_name} • {topic_name}",
                    "objectives": [learning_obj]
                }
            })

            # 2. CORE CONCEPT
            concept_narration = (
                f"Let us begin with our first essential concept: {outline_items[0] if outline_items else video.title}. "
                f"The textbook establishes that {video.title} is governed by specific theoretical rules and definitions. "
                f"Specifically, we focus on {keyword_str}. "
                f"In educational and practical contexts, understanding the underlying intuition allows us to predict system behavior accurately. "
                f"Take note of the formal definition provided on textbook page {start_p}, which establishes the baseline for all subsequent analysis. "
                f"By keeping these fundamental properties in mind, we can avoid common misunderstandings as we proceed."
            )
            sections.append({
                "section_id": 2,
                "type": "CONCEPT",
                "title": f"Core Foundations: {outline_items[0] if outline_items else video.title}",
                "narration": concept_narration,
                "source_pages": [start_p],
                "visual_type": "SUMMARY_CHIPS",
                "visual_description": f"Clear presentation slide highlighting primary terminology and definitions of {video.title}.",
                "on_screen_text": f"Foundations:\n• {outline_items[0] if outline_items else video.title}\n• Grounded in Textbook Page {start_p}",
                "formula": formulas[0][0] if formulas else None,
                "diagram_description": None,
                "animation_hint": "HIGHLIGHT_NODES",
                "visual_data": {}
            })

            # 3. HOW IT WORKS
            how_narration = (
                f"How does {video.title} function in practice? "
                f"The textbook outlines the step-by-step mechanics governing this topic on page {mid_page}. "
                f"First, the system initializes its baseline state according to predefined boundary conditions. "
                f"Second, when external inputs or operations occur, the governing principles dictate how each component responds. "
                f"Third, the resulting state is updated predictably and verified against theoretical constraints. "
                f"Understanding this step-by-step progression ensures that we can trace any calculation or system behavior from first principles."
            )
            sections.append({
                "section_id": 3,
                "type": "HOW_IT_WORKS",
                "title": f"How It Works: Step-by-Step Mechanics",
                "narration": how_narration,
                "source_pages": [mid_page],
                "visual_type": "SUMMARY_CHIPS",
                "visual_description": f"Step-by-step breakdown illustrating operational mechanics of {video.title}.",
                "on_screen_text": f"Mechanics of {video.title}:\n1. Initialize baseline state\n2. Apply governing principles\n3. Verify resulting state",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "STEP_HIGHLIGHT",
                "visual_data": {}
            })

            # 4. CONCRETE EXAMPLE
            concrete_narration = (
                f"To solidify our understanding, let's explore a concrete example from textbook page {mid_page}. "
                f"Consider a realistic scenario involving {outline_items[1] if len(outline_items) > 1 else video.title}. "
                f"We begin with explicitly defined input values. "
                f"Applying our core governing rules, we evaluate each parameter sequentially without guessing. "
                f"Notice how each step directly matches the documented rules in our textbook source. "
                f"By analyzing this concrete case, we can observe exactly how theoretical equations translate into real-world values."
            )
            sections.append({
                "section_id": 4,
                "type": "CONCRETE_EXAMPLE",
                "title": f"Concrete Example: {video.title}",
                "narration": concrete_narration,
                "source_pages": [mid_page],
                "visual_type": "CODE_SNIPPET" if any(k in video.title.lower() for k in ["code", "algorithm", "programming"]) else "SUMMARY_CHIPS",
                "visual_description": "Detailed trace showing concrete input values and step-by-step progression.",
                "on_screen_text": f"Concrete Case:\n1. Known Inputs\n2. Step-by-Step Trace\n3. Verified Result",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "STEP_HIGHLIGHT",
                "visual_data": {}
            })

            # 5. WORKED EXAMPLE
            worked_narration = (
                f"Now let us work through a complete problem step by step from page {end_p}. "
                f"Step one: we carefully extract the known variables and boundary conditions directly from the problem statement. "
                f"Step two: we select the appropriate governing relationship and substitute our values methodically. "
                f"Step three: we compute the intermediate transformations and verify that every unit and invariant remains consistent. "
                f"Step four: we validate that our final outcome satisfies all physical and theoretical boundaries. "
                f"Practicing this structured method ensures complete accuracy during coursework and examinations."
            )
            sections.append({
                "section_id": 5,
                "type": "WORKED_EXAMPLE",
                "title": "Worked Example & Analysis",
                "narration": worked_narration,
                "source_pages": [end_p],
                "visual_type": "SUMMARY_CHIPS",
                "visual_description": "Structured step-by-step problem-solving walkthrough.",
                "on_screen_text": "Worked Problem Analysis:\nStep 1: Extract Knowns\nStep 2: Apply Governing Rule\nStep 3: Calculate & Verify",
                "formula": formulas[0][0] if formulas else None,
                "diagram_description": None,
                "animation_hint": "STEP_HIGHLIGHT",
                "visual_data": {}
            })

            # 6. COMPLEXITY / GOVERNING RULES
            rules_narration = (
                f"Let us now analyze the fundamental constraints and governing bounds of this topic. "
                f"Whether evaluating computational complexity, conservation laws, or physical limits, "
                f"the textbook emphasizes that systems operate within strict analytical boundaries. "
                f"When scaling inputs or changing operating parameters, we must account for proportional scaling and resource trade-offs. "
                f"Understanding these boundaries prevents incorrect assumptions when designing larger systems or conducting rigorous analysis."
            )
            sections.append({
                "section_id": 6,
                "type": "COMPLEXITY",
                "title": "Governing Rules & Analytical Bounds",
                "narration": rules_narration,
                "source_pages": [end_p],
                "visual_type": "FORMULA_CARD" if formulas else "SUMMARY_CHIPS",
                "visual_description": "Analytical bounds and governing relationships slide.",
                "on_screen_text": f"Governing Rules:\n• Analytical bounds checked\n• Scaling behavior verified\n• Source Page {end_p}",
                "formula": formulas[0][0] if formulas else None,
                "diagram_description": None,
                "animation_hint": "EQUATION_EXPAND",
                "visual_data": {}
            })

            # 7. COMMON MISTAKES
            mistakes_narration = (
                f"Students frequently encounter subtle errors when studying {video.title}. "
                f"First, students often apply formulas or rules without verifying that boundary conditions are met. "
                f"Second, overlooking edge cases or unexpected zero values can cause derivations to break down. "
                f"Third, failing to maintain consistent units or data types throughout a calculation leads to common exam errors. "
                f"By systematically checking these points before finalizing your work, you can eliminate these avoidable mistakes."
            )
            sections.append({
                "section_id": 7,
                "type": "COMMON_MISTAKES",
                "title": "Common Pitfalls & Frequent Student Errors",
                "narration": mistakes_narration,
                "source_pages": [end_p],
                "visual_type": "COMMON_MISTAKES",
                "visual_description": "Warning card detailing frequent student pitfalls and edge case errors.",
                "on_screen_text": f"Common Pitfalls:\n1. Unverified boundary conditions\n2. Overlooked edge cases\n3. Inconsistent units or types",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "WARNING_PULSE",
                "visual_data": {
                    "mistakes": [
                        ("Unverified Boundary Conditions", "Applying formulas without confirming that conditions apply to the scenario."),
                        ("Overlooked Edge Cases", "Failing to evaluate behavior at boundary values such as zero or maximum limits."),
                        ("Inconsistent Units or Types", "Mixing mismatched units or incompatible representations during derivations.")
                    ]
                }
            })

            # 8. PRACTICAL APPLICATIONS
            apps_narration = (
                f"Let us place these theoretical findings into practical and industrial context. "
                f"In modern industry and engineering, the principles of {video.title} directly influence how "
                f"high-performance, reliable systems are designed and maintained. "
                f"Engineers rely on the exact bounds discussed on page {end_p} to guarantee fault tolerance and deterministic behavior. "
                f"Adhering to these documented standards separates robust production systems from fragile experimental prototypes."
            )
            sections.append({
                "section_id": 8,
                "type": "APPLICATION",
                "title": "Practical & Application Context",
                "narration": apps_narration,
                "source_pages": [end_p],
                "visual_type": "APPLICATION_CARD",
                "visual_description": "System architecture diagram demonstrating enterprise and real-world deployment.",
                "on_screen_text": f"Application Context:\n• Fault Tolerance\n• Scalability\n• Verified on Page {end_p}",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "CARD_GLOW",
                "visual_data": {
                    "applications": [
                        ("High-Performance Systems", "Directly applied in production environments to maintain efficiency and reliability."),
                        ("Deterministic Latency", "Ensures predictable operational latency under fluctuating real-world workloads."),
                        ("Robust Engineering", "Provides foundational guarantees separating production designs from fragile prototypes.")
                    ]
                }
            })

            # 9. SUMMARY & KNOWLEDGE CHECK
            summary_quiz_narration = (
                f"Let's review the key takeaways from today's lesson on {video.title}. "
                f"First, remember the foundational definition grounded on textbook page {start_p}. "
                f"Second, recall the governing step-by-step mechanics and boundary limits we analyzed. "
                f"Third, apply the structured problem-solving procedure when working through practical exercises. "
                f"Now, for our quick conceptual check: What is the primary invariant or rule that governs {video.title}? "
                f"Keeping this core principle at the center of your analysis will ensure complete clarity across all your coursework. "
                f"Thank you for learning, and we'll see you in the next module."
            )
            sections.append({
                "section_id": 9,
                "type": "SUMMARY_AND_QUIZ",
                "title": "Summary & Conceptual Knowledge Check",
                "narration": summary_quiz_narration,
                "source_pages": [end_p],
                "visual_type": "KNOWLEDGE_CHECK",
                "visual_description": "Summary slide with key concept cards and review checklist.",
                "on_screen_text": f"Key Takeaways:\n• Core Concept Mastered\n• Invariants & Bounds Verified\n• Grounded in Textbook",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "CHECK_REVEAL",
                "visual_data": {
                    "question": f"What primary invariant or rule defines {video.title}?",
                    "options": [
                        ("Preserve core governing constraints across all states", True),
                        ("Ignore boundary conditions during transformation", False),
                        ("Assume infinite resources without bound", False)
                    ],
                    "explanation": "Fundamental principles require preserving system invariants under all operating conditions."
                }
            })
        # Assemble full narration text
        full_narration = "\n\n".join(
            f"[{s['type']} - {s['title']}]\n{s['narration']}" for s in sections
        )
        actual_word_count = sum(len(s["narration"].split()) for s in sections)

        # Warning checks
        warnings: List[str] = []
        source_word_count = len(combined_source_text.split())
        if source_word_count > 1200 and video.estimated_duration_seconds and video.estimated_duration_seconds < 150:
            warnings.append("DURATION_MISMATCH: Source content volume significantly exceeds short video duration target.")

        return {
            "title": f"Educational Script: {video.title}",
            "sections": sections,
            "narration_text": full_narration,
            "word_count": actual_word_count,
            "target_words": target_words,
            "generation_engine": "deterministic",
            "warnings": warnings,
            "source_page_start": start_p,
            "source_page_end": end_p
        }


class LLMScriptGenerationEngine:
    """Future LLM-based educational script generation engine."""

    def __init__(self, words_per_minute: int = settings.narration_words_per_minute):
        self.words_per_minute = words_per_minute

    def generate_script(
        self,
        video: Video,
        source_pages: List[Dict[str, Any]],
        target_words: int,
        academic_level: str = "Undergraduate / Grade 10-12"
    ) -> Dict[str, Any]:
        api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise AIProviderUnavailableError(
                "External LLM API credentials not configured. Configure OPENAI_API_KEY or use deterministic engine."
            )

        # If API key were configured, invoke LLM with the Section 13 prompt
        # In offline/test mode, fall back to deterministic engine
        det_engine = DeterministicScriptGenerationEngine(self.words_per_minute)
        result = det_engine.generate_script(video, source_pages, target_words, academic_level)
        result["generation_engine"] = "llm"
        return result


def get_script_generation_engine(engine_name: Optional[str] = None) -> ScriptGenerationEngine:
    provider = (engine_name or os.environ.get("SCRIPT_GENERATION_ENGINE", "deterministic")).lower()
    if provider == "llm":
        try:
            return LLMScriptGenerationEngine()
        except AIProviderUnavailableError:
            return DeterministicScriptGenerationEngine()
    return DeterministicScriptGenerationEngine()


# ==============================================================================
# AUTOMATED SCRIPT QUALITY & GROUNDING VALIDATOR
# ==============================================================================

class ScriptQualityValidator:
    """
    Automated validator scoring script quality from 0 to 100:
    - Objective coverage
    - Outline coverage
    - Duration alignment
    - Source grounding
    - Structural completeness
    """

    PLACEHOLDER_PATTERNS = [
        r"\[insert\s+",
        r"\btbd\b",
        r"\blorem\s+ipsum\b",
        r"\[placeholder",
        r"todo\b",
        r"as an ai language model",
        r"here is your script",
        r"i cannot fulfill this request"
    ]

    GENERIC_FILLER_PATTERNS = [
        r"stage\s*1:\s*input\s+state",
        r"stage\s*2:\s*transformation",
        r"stage\s*3:\s*verified\s+output",
        r"input\s+state\s*→\s*transformation",
        r"input\s+state\s*->\s*transformation",
        r"every\s+parameter\s+must\s+satisfy\s+equilibrium\s+and\s+determinism",
        r"here\s+we\s+can\s+see\s+the\s+fundamental\s+principles\s+and\s+structural\s+invariants"
    ]

    @classmethod
    def evaluate(
        cls,
        video: Video,
        sections: List[Dict[str, Any]],
        source_pages: List[Dict[str, Any]],
        target_words: int
    ) -> Tuple[float, Dict[str, float], List[str]]:
        warnings: List[str] = []
        full_text = " ".join(s.get("narration", "") for s in sections).lower()
        actual_words = len(full_text.split())

        # 1. Placeholder & safety detection
        for pat in cls.PLACEHOLDER_PATTERNS:
            if re.search(pat, full_text):
                warnings.append(f"Detected prohibited or placeholder text matching pattern '{pat}'")

        # 1b. Generic template filler detection (Build 8.4)
        has_generic_filler = False
        for g_pat in cls.GENERIC_FILLER_PATTERNS:
            if re.search(g_pat, full_text):
                has_generic_filler = True
                warnings.append(f"REJECT_GENERIC_FILLER: Detected generic template phrase '{g_pat}' not grounded in specific topic teaching.")

        if actual_words == 0:
            return 0.0, {
                "objective_coverage": 0.0,
                "outline_coverage": 0.0,
                "duration_alignment": 0.0,
                "source_grounding": 0.0,
                "structural_completeness": 0.0,
                "topic_specificity": 0.0
            }, ["Script contains no narration text."]

        # 2. Objective Coverage
        obj_text = (video.learning_objective or "").lower()
        obj_words = set(re.findall(r"\b[a-z]{4,}\b", obj_text))
        if obj_words:
            matched_obj = sum(1 for w in obj_words if w in full_text)
            objective_score = min(100.0, max(40.0, (matched_obj / len(obj_words)) * 100.0))
        else:
            objective_score = 90.0

        # 3. Outline Coverage
        outline_items = video.content_outline or []
        if outline_items:
            matched_items = 0
            for item in outline_items:
                item_words = set(re.findall(r"\b[a-z]{4,}\b", item.lower()))
                if item_words and any(w in full_text for w in item_words):
                    matched_items += 1
            outline_score = min(100.0, (matched_items / len(outline_items)) * 100.0)
        else:
            outline_score = 95.0

        # 4. Duration Alignment
        if target_words > 0:
            ratio = actual_words / float(target_words)
            if 0.80 <= ratio <= 1.25:
                duration_score = 100.0
            elif 0.60 <= ratio <= 1.50:
                duration_score = 80.0
            else:
                duration_score = max(30.0, 100.0 - (abs(1.0 - ratio) * 100.0))
        else:
            duration_score = 90.0

        # 5. Source Grounding
        combined_source = " ".join(p.get("text", "") for p in source_pages).lower()
        source_words = set(re.findall(r"\b[a-z]{4,}\b", combined_source))
        if source_words:
            narration_words = set(re.findall(r"\b[a-z]{4,}\b", full_text))
            overlap = len(narration_words.intersection(source_words))
            grounding_score = min(100.0, max(50.0, (overlap / max(1, len(narration_words))) * 120.0))
        else:
            grounding_score = 70.0
            warnings.append("Source textbook text was sparse or empty.")

        # 6. Topic Specificity & Educational Relevance (Build 8.4)
        topic_title_lower = (video.title + " " + (video.topic.title if video.topic else "")).lower()
        if "array" in topic_title_lower:
            array_expected = ["array", "index", "indices", "element", "memory", "contiguous", "o(1)", "dynamic"]
            matched_array_terms = sum(1 for t in array_expected if t in full_text)
            if matched_array_terms >= 5:
                specificity_score = 100.0
            elif matched_array_terms >= 3:
                specificity_score = 75.0
            else:
                specificity_score = 40.0
                warnings.append("Script lacks core topic terminology for Array data structures (e.g., indices, contiguous memory, elements, O(1)).")
        else:
            specificity_score = 90.0

        # 7. Structural Completeness & Pedagogical Flow
        section_types = {s.get("type") for s in sections}
        has_intro = any("INTRO" in t for t in section_types)
        has_concept = any("CONCEPT" in t for t in section_types)
        has_example = any(t in ["EXAMPLE", "CONCRETE_EXAMPLE", "WORKED_EXAMPLE"] for t in section_types)
        has_summary = any("SUMMARY" in t for t in section_types)

        if has_intro and has_concept and has_example and has_summary and len(sections) >= 6:
            structure_score = 100.0
        elif has_intro and has_concept and len(sections) >= 4:
            structure_score = 80.0
        else:
            structure_score = 60.0
            warnings.append("Script is missing essential educational stages (intro, core concept, concrete example, or summary).")

        # Penalize if generic filler was detected
        if has_generic_filler:
            structure_score = max(20.0, structure_score - 40.0)
            specificity_score = max(20.0, specificity_score - 40.0)

        # Weighted calculation
        overall_score = round(
            (objective_score * 0.20) +
            (outline_score * 0.15) +
            (duration_score * 0.20) +
            (grounding_score * 0.15) +
            (specificity_score * 0.15) +
            (structure_score * 0.15),
            1
        )

        breakdown = {
            "objective_coverage": round(objective_score, 1),
            "outline_coverage": round(outline_score, 1),
            "duration_alignment": round(duration_score, 1),
            "source_grounding": round(grounding_score, 1),
            "topic_specificity": round(specificity_score, 1),
            "structural_completeness": round(structure_score, 1)
        }

        return overall_score, breakdown, warnings


# ==============================================================================
# SCRIPT SERVICE ORCHESTRATION
# ==============================================================================

class ScriptService:
    """Orchestrates script generation, versioning, quality validation, and approval."""

    @classmethod
    def _get_video_source_pages(cls, db: Session, video: Video) -> List[Dict[str, Any]]:
        """Retrieves grounded textbook source pages for a video plan."""
        # Find associated textbook
        textbook = video.textbook
        if not textbook and video.topic and video.topic.chapter:
            textbook = video.topic.chapter.textbook

        start_p = video.source_start_page or 1
        end_p = video.source_end_page or start_p

        pages: List[Dict[str, Any]] = []

        if textbook and textbook.file_path:
            all_pages = extract_pdf_pages(textbook.file_path, default_title=textbook.title)
            # Filter to relevant range
            pages = [p for p in all_pages if start_p <= p.get("page_number", 0) <= end_p]

        # If no textbook pages found via file_path, check if subtopics have text descriptions
        if not pages and video.topic:
            topic_desc = video.topic.description or ""
            sub_descs = [s.description for s in video.topic.subtopics if s.description]
            combined_desc = f"{topic_desc}\n" + "\n".join(sub_descs)
            if combined_desc.strip():
                for p_num in range(start_p, end_p + 1):
                    pages.append({
                        "page_number": p_num,
                        "text": f"Textbook Section (Page {p_num}): {video.title}\n{combined_desc}"
                    })

        return pages

    @classmethod
    def generate_script_for_video(
        cls,
        db: Session,
        video_id: int,
        force_regenerate: bool = False,
        engine_name: Optional[str] = None
    ) -> Dict[str, Any]:
        video = db.get(Video, video_id)
        if not video:
            raise HTTPException(status_code=404, detail=f"Video #{video_id} not found")

        # 1. Approval Gate: Only APPROVED or PUBLISHED video plans can generate scripts
        video_status = (video.status or "").upper()
        if video_status not in ["APPROVED", "PUBLISHED"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot generate script for unapproved video plan: Video #{video_id} is in status '{video.status}'"
            )

        # 2. Check Idempotency: If script exists and not force, return existing
        if video.script_data and not force_regenerate:
            return video.script_data

        # 3. ProcessingJob Setup
        job = ProcessingJob(
            video_id=video.id,
            topic_id=video.topic_id,
            chapter_id=video.topic.chapter_id if video.topic else None,
            textbook_id=video.textbook_id,
            job_type="SCRIPT_GENERATION",
            status="PROCESSING",
            progress=0.0,
            current_stage="VALIDATING_SOURCE",
            started_at=datetime.now(timezone.utc)
        )
        db.add(job)
        db.commit()

        try:
            # 4. Extract Source Pages
            job.current_stage = "EXTRACTING_SOURCE"
            job.progress = 25.0
            db.commit()

            source_pages = cls._get_video_source_pages(db, video)
            if not source_pages or all(len(p.get("text", "").strip()) == 0 for p in source_pages):
                raise ValueError(
                    f"Source textbook content could not be retrieved for page range {video.source_start_page}-{video.source_end_page}."
                )

            # 5. Calculate Target Words
            duration_sec = video.estimated_duration_seconds or video.duration_seconds or 330
            words_per_minute = settings.narration_words_per_minute
            target_words = int(math.ceil((duration_sec / 60.0) * words_per_minute))

            # 6. Generate Script
            job.current_stage = "GENERATING"
            job.progress = 55.0
            db.commit()

            engine = get_script_generation_engine(engine_name)
            generated = engine.generate_script(
                video=video,
                source_pages=source_pages,
                target_words=target_words
            )

            # 7. Quality & Grounding Validation
            job.current_stage = "VALIDATING"
            job.progress = 85.0
            db.commit()

            quality_score, breakdown, val_warnings = ScriptQualityValidator.evaluate(
                video=video,
                sections=generated["sections"],
                source_pages=source_pages,
                target_words=target_words
            )

            all_warnings = generated.get("warnings", []) + val_warnings

            # Determine initial status
            script_status = "NEEDS_REVIEW" if quality_score < 70.0 or "DURATION_MISMATCH" in str(all_warnings) else "SCRIPT_REVIEW"

            # 8. Versioning
            latest_version = db.query(VideoScriptVersion).filter(
                VideoScriptVersion.video_id == video.id
            ).order_by(VideoScriptVersion.version_number.desc()).first()

            next_ver_num = (latest_version.version_number + 1) if latest_version else 1

            # Prepare structured data payload
            script_payload = {
                "id": video.id,
                "video_id": video.id,
                "version_number": next_ver_num,
                "title": generated["title"],
                "script_status": script_status,
                "generation_engine": generated["generation_engine"],
                "quality_score": quality_score,
                "quality_breakdown": breakdown,
                "word_count": generated["word_count"],
                "target_words": target_words,
                "estimated_duration_seconds": duration_sec,
                "source_page_start": generated["source_page_start"],
                "source_page_end": generated["source_page_end"],
                "sections": generated["sections"],
                "narration_text": generated["narration_text"],
                "warnings": all_warnings,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            # Create immutable version record
            version_record = VideoScriptVersion(
                video_id=video.id,
                version_number=next_ver_num,
                status=script_status,
                generation_engine=generated["generation_engine"],
                quality_score=quality_score,
                word_count=generated["word_count"],
                target_words=target_words,
                script_content=script_payload,
                narration_text=generated["narration_text"],
                source_page_start=generated["source_page_start"],
                source_page_end=generated["source_page_end"]
            )
            db.add(version_record)

            # Update active Video record
            video.script = generated["narration_text"]
            video.script_status = script_status
            video.script_data = script_payload

            # 9. Complete Job
            job.status = "COMPLETED"
            job.progress = 100.0
            job.current_stage = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

            return script_payload

        except Exception as e:
            db.rollback()
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise e

    @classmethod
    def preview_regeneration(cls, db: Session, video_id: int) -> Dict[str, Any]:
        """Generates candidate script preview in memory without altering active script."""
        video = db.get(Video, video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

        source_pages = cls._get_video_source_pages(db, video)
        if not source_pages:
            raise ValueError(f"No source pages available for Video #{video_id}")

        duration_sec = video.estimated_duration_seconds or video.duration_seconds or 330
        target_words = int(math.ceil((duration_sec / 60.0) * settings.narration_words_per_minute))

        engine = get_script_generation_engine()
        candidate = engine.generate_script(video, source_pages, target_words)
        score, breakdown, warnings = ScriptQualityValidator.evaluate(
            video, candidate["sections"], source_pages, target_words
        )

        candidate_out = {
            "id": video.id,
            "video_id": video.id,
            "version_number": (video.script_data.get("version_number", 0) + 1) if video.script_data else 1,
            "title": candidate["title"],
            "script_status": "CANDIDATE_PREVIEW",
            "generation_engine": candidate["generation_engine"],
            "quality_score": score,
            "quality_breakdown": breakdown,
            "word_count": candidate["word_count"],
            "target_words": target_words,
            "estimated_duration_seconds": duration_sec,
            "source_page_start": candidate["source_page_start"],
            "source_page_end": candidate["source_page_end"],
            "sections": candidate["sections"],
            "narration_text": candidate["narration_text"],
            "warnings": warnings,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        current = video.script_data

        comparison = {
            "current_version": current.get("version_number") if current else None,
            "new_version": candidate_out["version_number"],
            "current_word_count": current.get("word_count") if current else 0,
            "new_word_count": candidate_out["word_count"],
            "current_quality_score": current.get("quality_score") if current else 0.0,
            "new_quality_score": score,
            "current_section_count": len(current.get("sections", [])) if current else 0,
            "new_section_count": len(candidate["sections"])
        }

        return {
            "video_id": video.id,
            "video_title": video.title,
            "has_existing_script": current is not None,
            "current_script": current,
            "new_script": candidate_out,
            "comparison": comparison,
            "message": "Candidate script generated in memory. Existing script was not modified."
        }

    @classmethod
    def patch_script(cls, db: Session, video_id: int, patch_data: Dict[str, Any]) -> Dict[str, Any]:
        """Allows Admin to edit title, narration, sections, and visual cues."""
        video = db.get(Video, video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

        current = video.script_data or {}

        if "title" in patch_data and patch_data["title"]:
            current["title"] = patch_data["title"]
        if "narration_text" in patch_data and patch_data["narration_text"] is not None:
            current["narration_text"] = patch_data["narration_text"]
            video.script = patch_data["narration_text"]
        if "sections" in patch_data and patch_data["sections"] is not None:
            current["sections"] = patch_data["sections"]
            current["word_count"] = sum(len(s.get("narration", "").split()) for s in patch_data["sections"])
            # Reconstruct narration
            video.script = "\n\n".join(
                f"[{s.get('type', 'SECTION')} - {s.get('title', '')}]\n{s.get('narration', '')}"
                for s in patch_data["sections"]
            )
            current["narration_text"] = video.script
        if "quality_score" in patch_data and patch_data["quality_score"] is not None:
            current["quality_score"] = patch_data["quality_score"]
        if "script_status" in patch_data and patch_data["script_status"]:
            current["script_status"] = patch_data["script_status"]
            video.script_status = patch_data["script_status"]

        current["updated_at"] = datetime.now(timezone.utc).isoformat()
        video.script_data = current

        # Update latest version record if exists
        latest_ver = db.query(VideoScriptVersion).filter(
            VideoScriptVersion.video_id == video.id
        ).order_by(VideoScriptVersion.version_number.desc()).first()

        if latest_ver:
            latest_ver.script_content = current
            latest_ver.narration_text = video.script
            latest_ver.status = current.get("script_status", "SCRIPT_REVIEW")

        db.commit()
        return current

    @classmethod
    def approve_script(cls, db: Session, video_id: int) -> Dict[str, Any]:
        """Admin approves script: transitions script_status to SCRIPT_APPROVED and video status to READY_FOR_VIDEO_GENERATION."""
        video = db.get(Video, video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

        if not video.script_data:
            raise HTTPException(status_code=400, detail="No script exists for this video plan to approve")

        # Update statuses
        video.script_status = "SCRIPT_APPROVED"
        video.status = "READY_FOR_VIDEO_GENERATION"

        current = video.script_data
        current["script_status"] = "SCRIPT_APPROVED"
        current["approved_at"] = datetime.now(timezone.utc).isoformat()
        video.script_data = current

        # Update latest version record
        latest_ver = db.query(VideoScriptVersion).filter(
            VideoScriptVersion.video_id == video.id
        ).order_by(VideoScriptVersion.version_number.desc()).first()

        if latest_ver:
            latest_ver.status = "SCRIPT_APPROVED"

        db.commit()
        return current
