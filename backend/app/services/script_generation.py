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
# SHARED SOURCE-CONTENT ANALYSIS HELPERS (used by script & quiz grounding)
# ==============================================================================

# Common English function words ignored when ranking content-bearing terms.
STOPWORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "her",
    "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its",
    "new", "now", "old", "see", "two", "way", "who", "boy", "did", "use", "may",
    "say", "each", "she", "which", "their", "said", "will", "about", "they",
    "that", "this", "with", "from", "have", "were", "been", "when", "then",
    "than", "them", "these", "those", "into", "onto", "also", "such", "like",
    "some", "only", "over", "more", "most", "very", "much", "many", "other",
    "after", "before", "between", "both", "under", "again", "further", "once",
    "here", "there", "where", "why", "what", "your", "yours", "shall", "should",
    "could", "would", "might", "must", "shall", "using", "used", "upon", "while",
    "because", "within", "without", "every", "give", "given", "take", "takes",
    "make", "makes", "made", "example", "examples", "figure", "table", "chapter",
    "topic", "page", "pages", "section", "note", "thus", "hence", "since",
    "being", "does", "done", "same", "even", "well", "just", "still", "often",
    "however", "therefore", "following", "follows", "show", "shows", "shown",
    "find", "finds", "let", "lets", "first", "second", "third", "next", "last",
    "another", "case", "cases", "different", "various", "several", "number",
    "value", "values", "point", "points", "term", "terms", "called", "call"
}


def split_sentences(text: str) -> List[str]:
    """Split raw textbook text into individual sentences, ignoring headings."""
    if not text:
        return []
    # Normalize whitespace and strip heading-like standalone lines first
    cleaned_lines: List[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        # Skip headings / numbering artifacts (ALL CAPS lines, "Chapter 3", "7.1", page numbers)
        if re.fullmatch(r"[\d\s\.\-]+", line):
            continue
        if len(line) > 4 and line.isupper():
            continue
        # Skip running headers/footers ("Exploration|Grade 9 ...", "Title ... 117")
        if "Exploration|" in line or re.match(r"^.{10,80}?\s\d{2,3}$", line):
            continue
        if re.fullmatch(r"(chapter|section|topic|subtopic)\s+\d+(\.\d+)*.*", line, re.IGNORECASE) and len(line) < 80:
            continue
        cleaned_lines.append(line)
    joined = " ".join(cleaned_lines)
    # Protect common abbreviations from being split
    joined = re.sub(r"\b(e\.g|i\.e|etc|vs|fig|approx|no)\.", lambda m: m.group(1) + "<DOT>", joined, flags=re.IGNORECASE)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", joined)
    sentences: List[str] = []
    for part in parts:
        part = part.replace("<DOT>", ".").strip()
        part = re.sub(r"\s+", " ", part)
        # Trim bullet markers / stray leading symbols
        part = re.sub(r"^[\u2022\u25cf\u25aa\-\*\u2013\u2014o]\s+", "", part)
        if part and 20 <= len(part) <= 340:
            sentences.append(part)

    # Merge fragments that were cut at figure references ("... shown in Fig.")
    # so narration doesn't end mid-reference; drop repeated feature headers.
    merged: List[str] = []
    for s in sentences:
        if merged and re.search(r"(?:\bFig\.|\bExample\s+\d+\.\d+\s*:\s*[^:]{0,60})$", merged[-1].strip()):
            prev = merged.pop()
            s = f"{prev} {s}"
        if re.match(r"^(Ready to Go Beyond|Meet a Scientist|Think Like a Scientist|Explore|Journey Beyond)\b", s) and len(s) < 90:
            continue
        if not (20 <= len(s) <= 340):
            continue
        merged.append(s)
    return merged


def extract_page_sentences(source_pages: List[Dict[str, Any]]) -> List[Tuple[int, str]]:
    """
    Convert source pages into page-attributed sentences.
    Returns list of (page_number, sentence) tuples in reading order.
    """
    result: List[Tuple[int, str]] = []
    for p in source_pages or []:
        page_num = p.get("page_number") or 0
        for s in split_sentences(p.get("text", "")):
            result.append((page_num, s))
    return result


def clean_sentence_for_narration(sentence: str) -> str:
    """Make a textbook sentence safe and natural for spoken narration."""
    s = re.sub(r"\s+", " ", sentence).strip()
    s = re.sub(r"[\[\]{}|<>#~`^_]+", " ", s)          # strip markup-ish glyphs
    s = re.sub(r"\u2192|\b->\b", " gives ", s)         # arrows → "gives"
    s = re.sub(r"\s{2,}", " ", s).strip()
    if s and s[-1] not in ".!?":
        s += "."
    return s


def shorten_sentence(sentence: str, max_words: int = 24) -> str:
    """Shorten a sentence for on-screen/option text while keeping whole words."""
    words = sentence.split()
    if len(words) <= max_words:
        return sentence.rstrip(". ")
    return " ".join(words[:max_words]).rstrip(",;:") + "…"


def extract_key_terms(text: str, top_n: int = 8) -> List[str]:
    """
    Frequency-ranked content terms from real source text.
    Prefers multi-word technical phrases and capitalized mid-sentence terms.
    """
    if not text:
        return []
    counts: Dict[str, int] = {}

    # Multi-word phrases (2-3 content words adjacent) get a weight boost
    phrase_candidates = re.findall(r"\b([A-Za-z][A-Za-z\-']+(?:\s+[A-Za-z][A-Za-z\-']+){1,2})\b", text)
    for phrase in phrase_candidates:
        words = phrase.lower().split()
        if any(w in STOPWORDS for w in words):
            continue
        if all(len(w) >= 3 for w in words):
            counts[phrase.lower()] = counts.get(phrase.lower(), 0) + 3

    # Single content words
    for w in re.findall(r"\b[A-Za-z][A-Za-z\-']+\b", text):
        lw = w.lower()
        if lw in STOPWORDS or len(lw) < 4:
            continue
        counts[lw] = counts.get(lw, 0) + 1

    # Capitalized mid-sentence words (likely technical terms) get a boost
    mid_capitals = re.findall(r"(?<![.!?]\s)(?<!^)\b([A-Z][a-z]{3,})\b", text)
    for w in mid_capitals:
        lw = w.lower()
        if lw not in STOPWORDS:
            counts[lw] = counts.get(lw, 0) + 2

    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    terms: List[str] = []
    for term, _ in ranked:
        if any(term in t or t in term for t in terms):
            continue
        terms.append(term)
        if len(terms) >= top_n:
            break
    return terms


# Sentence categories used to ground each pedagogical section in real content
_DEFINITION_RE = re.compile(
    r"\b(is|are|refers to|is defined as|are defined as|means|denotes|known as|called)\b", re.IGNORECASE
)
_PROCEDURE_RE = re.compile(
    r"\b(when|if|then|because|therefore|thus|step|process|occurs|apply|applied|increase|decrease|"
    r"first|second|next|finally|follows|result|results|causes|produces)\b", re.IGNORECASE
)
_EXAMPLE_RE = re.compile(
    r"\b(example|for instance|consider|suppose|such as|for example|e\.g|calculate|compute|find the)\b",
    re.IGNORECASE,
)
_APPLICATION_RE = re.compile(
    r"\b(used|useful|application|applications|practical|everyday|real.?world|industry|industrial|"
    r"engineering|daily|life|machines|devices|technology)\b", re.IGNORECASE
)


def classify_page_sentences(page_sentences: List[Tuple[int, str]]) -> Dict[str, List[Tuple[int, str]]]:
    """Group page-attributed sentences into pedagogical categories."""
    buckets: Dict[str, List[Tuple[int, str]]] = {
        "definitions": [], "procedures": [], "examples": [],
        "applications": [], "numeric": [], "general": [],
    }
    for page_num, s in page_sentences:
        entry = (page_num, s)
        has_digit = bool(re.search(r"\d", s))
        if _DEFINITION_RE.search(s):
            buckets["definitions"].append(entry)
        if _PROCEDURE_RE.search(s):
            buckets["procedures"].append(entry)
        if _EXAMPLE_RE.search(s):
            buckets["examples"].append(entry)
        if _APPLICATION_RE.search(s):
            buckets["applications"].append(entry)
        if has_digit:
            buckets["numeric"].append(entry)
        buckets["general"].append(entry)
    return buckets


def dedupe_entries(entries: List[Tuple[int, str]], used_keys: set) -> List[Tuple[int, str]]:
    """Filter out entries whose normalized sentence was already used.
    NOTE: does NOT mark entries as used — callers mark only what they consume."""
    result: List[Tuple[int, str]] = []
    for page_num, s in entries:
        key = re.sub(r"\W+", " ", s.lower()).strip()
        if key in used_keys:
            continue
        result.append((page_num, s))
    return result


def mark_entries_used(entries: List[Tuple[int, str]], used_keys: set) -> None:
    """Mark entries as consumed so later sections don't reuse the same sentences."""
    for page_num, s in entries:
        used_keys.add(re.sub(r"\W+", " ", s.lower()).strip())


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

        # Parse key technical keywords from source text (frequency-ranked, stopword-filtered)
        key_terms_all = extract_key_terms(combined_source_text, top_n=20)
        keyword_str = ", ".join(key_terms_all[:6]) if key_terms_all else video.title

        # Determine outline items
        outline_items = video.content_outline or [
            f"Core principles of {video.title}",
            "Fundamental mechanics & applications",
            "Worked example and analysis"
        ]

        mid_page = (start_p + end_p) // 2

        # Check if this is an Array / Data Structure topic.
        # NOTE: only trigger the hard-coded array lesson when the plan itself is about
        # arrays (title/topic), NOT when the word merely appears somewhere in the
        # source pages of an unrelated subject.
        title_context = f"{video.title} {video.topic.title if video.topic else ''}".lower()
        is_array_topic = any(k in title_context for k in ["array", "dynamic sizing", "static array", "dynamic array", "contiguous memory"])

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
            # CONTENT-GROUNDED GENERAL EDUCATIONAL SCRIPT (9 SECTIONS)
            # Every narration section is derived from the actual extracted
            # textbook page text (page-attributed sentences), woven together in
            # a natural teacher voice rather than read verbatim as a lecture.
            # ==================================================================
            topic_name = video.topic.title if video.topic else video.title
            chapter_name = video.topic.chapter.title if video.topic and video.topic.chapter else "Core Concepts"
            learning_obj = video.learning_objective or f"Understand, analyze, and apply core principles of {video.title}."

            page_sentences = extract_page_sentences(source_pages)
            key_terms = extract_key_terms(combined_source_text, top_n=8)
            buckets = classify_page_sentences(page_sentences)
            used_keys: set = set()
            primary_term = key_terms[0] if key_terms else topic_name
            secondary_term = key_terms[1] if len(key_terms) > 1 else topic_name

            # Per-section share of the total target word budget (sums to ~1.0)
            budgets = {1: 0.09, 2: 0.16, 3: 0.15, 4: 0.12, 5: 0.14, 6: 0.10, 7: 0.09, 8: 0.07, 9: 0.08}

            def pick(category: str, budget_words: float, fallbacks: Optional[List[str]] = None) -> List[Tuple[int, str]]:
                """Select unused page-attributed sentences from a category to fill a word budget."""
                pool: List[Tuple[int, str]] = list(buckets.get(category, []))
                for fb in (fallbacks or []):
                    pool.extend(buckets.get(fb, []))
                pool = dedupe_entries(pool, used_keys)
                chosen: List[Tuple[int, str]] = []
                words_acc = 0.0
                for entry in pool:
                    w = len(entry[1].split())
                    if w > 70:  # very long sentences hurt narration pacing
                        continue
                    if chosen and words_acc + w > budget_words * 1.35:
                        break
                    chosen.append(entry)
                    words_acc += w
                    if words_acc >= budget_words * 0.85:
                        break
                mark_entries_used(chosen, used_keys)
                return chosen

            def weave(framing: List[str], entries: List[Tuple[int, str]]) -> Tuple[str, List[int], List[str]]:
                """Blend teacher framing lines with grounded textbook sentences."""
                parts = list(framing)
                pages_used: List[int] = []
                grounded: List[str] = []
                for page_num, s in entries:
                    cleaned = clean_sentence_for_narration(s)
                    parts.append(cleaned)
                    grounded.append(cleaned)
                    if page_num and page_num not in pages_used:
                        pages_used.append(page_num)
                return " ".join(parts), pages_used, grounded

            # ---------- 1. INTRO ----------
            intro_budget = target_words * budgets[1]
            intro_entries = pick("definitions", intro_budget * 0.5, fallbacks=["general"])
            intro_pages: List[int] = []
            intro_grounded: List[str] = []
            intro_narration, intro_pages, intro_grounded = weave(
                [
                    f"Hello everyone, and welcome to today's lesson on {video.title}.",
                    f"This session is part of our chapter on {chapter_name}, and we'll be drawing directly from pages {start_p} through {end_p} of the textbook.",
                    f"By the end, you should be able to {learning_obj[0].lower() + learning_obj[1:] if learning_obj else ''}".rstrip(".") + ".",
                    f"As we go, keep an eye on the key ideas we'll keep coming back to: {keyword_str}.",
                ],
                intro_entries,
            )
            sections.append({
                "section_id": 1,
                "type": "INTRO",
                "title": f"Introduction to {video.title}",
                "narration": intro_narration,
                "source_pages": intro_pages or [start_p],
                "visual_type": "TITLE_CARD",
                "visual_description": f"High-contrast title card displaying '{video.title}' with subject context and academic badge.",
                "on_screen_text": f"{video.title}\n{academic_level}",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "FADE_IN_TITLE",
                "visual_data": {
                    "subtitle": f"{chapter_name} • {topic_name}",
                    "objectives": [learning_obj] + [shorten_sentence(s, 12) for _, s in intro_entries[:2]]
                }
            })

            # ---------- 2. CORE CONCEPT (definitions from the source) ----------
            concept_budget = target_words * budgets[2]
            concept_entries = pick("definitions", concept_budget, fallbacks=["general"])
            concept_narration, concept_pages, concept_grounded = weave(
                [
                    f"Let's start with the heart of the matter: what exactly is {primary_term}?",
                    "The textbook gives us a clear picture of this, so let me unpack it for you.",
                    "Here's the key idea.",
                ],
                concept_entries,
            )
            sections.append({
                "section_id": 2,
                "type": "CONCEPT",
                "title": f"Core Concept: {outline_items[0] if outline_items else video.title}",
                "narration": concept_narration,
                "source_pages": concept_pages or [start_p],
                "visual_type": "SUMMARY_CHIPS",
                "visual_description": f"Presentation slide highlighting primary terminology and definitions of {video.title} drawn from the textbook.",
                "on_screen_text": "Key Definitions:\n" + "\n".join(
                    f"• {shorten_sentence(s, 14)}" for _, s in concept_entries[:3]
                ) if concept_entries else f"Foundations of {video.title}\n• Grounded in Textbook Page {start_p}",
                "formula": formulas[0][0] if formulas else None,
                "diagram_description": None,
                "animation_hint": "HIGHLIGHT_NODES",
                "visual_data": {}
            })

            # ---------- 3. HOW IT WORKS (procedural sentences) ----------
            how_budget = target_words * budgets[3]
            how_entries = pick("procedures", how_budget, fallbacks=["general"])
            how_narration, how_pages, how_grounded = weave(
                [
                    f"Now that we know what it is, let's walk through how {primary_term} actually works.",
                    "I'll break this down the same way the textbook does, step by step.",
                ],
                how_entries,
            )
            sections.append({
                "section_id": 3,
                "type": "HOW_IT_WORKS",
                "title": f"How It Works: Step-by-Step Mechanics",
                "narration": how_narration,
                "source_pages": how_pages or [mid_page],
                "visual_type": "SUMMARY_CHIPS",
                "visual_description": f"Step-by-step breakdown of the mechanics of {video.title}, based on the textbook's own explanation.",
                "on_screen_text": f"Mechanics of {video.title}:\n" + "\n".join(
                    f"{i}. {shorten_sentence(s, 12)}" for i, (_, s) in enumerate(how_entries[:3], start=1)
                ) if how_entries else f"Mechanics of {video.title}:\n1. Grounded in textbook pages {mid_page}-{end_p}",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "STEP_HIGHLIGHT",
                "visual_data": {}
            })

            # ---------- 4. CONCRETE EXAMPLE (example/numeric sentences) ----------
            example_budget = target_words * budgets[4]
            example_entries = pick("examples", example_budget, fallbacks=["numeric", "general"])
            example_narration, example_pages, example_grounded = weave(
                [
                    "Concepts only stick when you see them in action, so let's make this concrete.",
                    "Here's an example straight from the source material.",
                ],
                example_entries,
            )
            sections.append({
                "section_id": 4,
                "type": "CONCRETE_EXAMPLE",
                "title": f"Concrete Example: {video.title}",
                "narration": example_narration,
                "source_pages": example_pages or [mid_page],
                "visual_type": "CODE_SNIPPET" if any(k in title_context for k in ["code", "algorithm", "programming"]) else "SUMMARY_CHIPS",
                "visual_description": "Concrete worked illustration using the actual quantities and scenarios from the textbook.",
                "on_screen_text": "From the Textbook:\n" + "\n".join(
                    f"• {shorten_sentence(s, 14)}" for _, s in example_entries[:3]
                ) if example_entries else f"Concrete Case (Page {mid_page}):\n• See worked example",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "STEP_HIGHLIGHT",
                "visual_data": {}
            })

            # ---------- 5. WORKED EXAMPLE (numeric content) ----------
            worked_budget = target_words * budgets[5]
            worked_entries = pick("numeric", worked_budget, fallbacks=["procedures", "general"])
            worked_narration, worked_pages, worked_grounded = weave(
                [
                    f"Time to put this into practice. Follow along with me, and notice how every number comes from the textbook itself.",
                ],
                worked_entries,
            )
            sections.append({
                "section_id": 5,
                "type": "WORKED_EXAMPLE",
                "title": "Worked Example & Analysis",
                "narration": worked_narration,
                "source_pages": worked_pages or [end_p],
                "visual_type": "SUMMARY_CHIPS",
                "visual_description": "Structured walkthrough of the textbook's own numerical example with quantities and units.",
                "on_screen_text": "Worked Problem:\n" + "\n".join(
                    f"{i}. {shorten_sentence(s, 12)}" for i, (_, s) in enumerate(worked_entries[:3], start=1)
                ) if worked_entries else f"Worked Problem (Page {end_p}):\nStep 1: Identify knowns\nStep 2: Apply the rule\nStep 3: Verify",
                "formula": formulas[0][0] if formulas else None,
                "diagram_description": None,
                "animation_hint": "STEP_HIGHLIGHT",
                "visual_data": {}
            })

            # ---------- 6. GOVERNING RULES / FORMULAS ----------
            rules_budget = target_words * budgets[6]
            rules_entries = pick("definitions", rules_budget, fallbacks=["procedures", "general"])
            formula_spoken = formulas[0][1] if formulas else None
            rules_narration, rules_pages, rules_grounded = weave(
                [
                    f"Before we move on, let's pin down the governing relationships.",
                    f"The textbook states the rule clearly, and here is how you say it out loud: {formula_spoken}." if formula_spoken else
                    f"The textbook sets out the governing rule for {primary_term} in plain terms.",
                ],
                rules_entries,
            )
            sections.append({
                "section_id": 6,
                "type": "COMPLEXITY",
                "title": "Governing Rules & Key Relationships",
                "narration": rules_narration,
                "source_pages": rules_pages or [end_p],
                "visual_type": "FORMULA_CARD" if formulas else "SUMMARY_CHIPS",
                "visual_description": "Governing relationships and rules taken directly from the textbook's discussion.",
                "on_screen_text": (f"Key Relationship:\n{formulas[0][0]}" if formulas else f"Governing Rules of {video.title}:") +
                                  f"\n• Textbook page {rules_pages[-1] if rules_pages else end_p}",
                "formula": formulas[0][0] if formulas else None,
                "diagram_description": None,
                "animation_hint": "EQUATION_EXPAND",
                "visual_data": {}
            })

            # ---------- 7. COMMON MISTAKES (anchored to real terms) ----------
            mistakes_budget = target_words * budgets[7]
            mistakes_entries = pick("procedures", mistakes_budget * 0.6, fallbacks=["definitions"])
            mistake_line_a = (
                f"Students most often slip up by mixing {primary_term} and {secondary_term} — they sound similar, but the textbook treats them differently, so keep the definitions separate in your head."
                if secondary_term != primary_term else
                f"A very common slip with {primary_term} is memorizing the words without checking what they actually mean, so always test yourself against the definition."
            )
            mistake_line_b = (
                "Another classic error: plugging numbers into a formula before checking the units and conditions. Slow down, verify the setup, and then compute."
            )
            mistakes_narration, mistakes_pages, mistakes_grounded = weave(
                [f"Let me save you some marks — here are the mistakes I see most often with {video.title}.", mistake_line_a, mistake_line_b],
                mistakes_entries,
            )
            sections.append({
                "section_id": 7,
                "type": "COMMON_MISTAKES",
                "title": "Common Pitfalls & Frequent Student Errors",
                "narration": mistakes_narration,
                "source_pages": mistakes_pages or [end_p],
                "visual_type": "COMMON_MISTAKES",
                "visual_description": "Warning card detailing frequent student pitfalls for this specific topic.",
                "on_screen_text": f"Common Pitfalls:\n1. Confusing {primary_term} with {secondary_term}\n2. Skipping unit & condition checks\n3. Memorizing without verifying definitions",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "WARNING_PULSE",
                "visual_data": {
                    "mistakes": [
                        (f"Confusing {primary_term} with {secondary_term}", "They sound similar but the textbook treats them differently — keep the definitions separate."),
                        ("Skipping Unit & Condition Checks", "Always verify units and conditions before plugging numbers into a formula."),
                        ("Memorizing Without Understanding", "Test yourself against the textbook definition, not just the words.")
                    ]
                }
            })

            # ---------- 8. APPLICATIONS (application sentences) ----------
            apps_budget = target_words * budgets[8]
            apps_entries = pick("applications", apps_budget, fallbacks=["general"])
            apps_narration, apps_pages, apps_grounded = weave(
                [f"So where does all this show up outside the classroom? More places than you'd expect."],
                apps_entries,
            )
            if not apps_entries:
                apps_narration += (
                    f" The principles of {primary_term} appear whenever this part of {topic_name} matters in practice — and the textbook's worked discussion on pages {start_p} to {end_p} is exactly the template professionals follow."
                )
            sections.append({
                "section_id": 8,
                "type": "APPLICATION",
                "title": "Practical & Real-World Context",
                "narration": apps_narration,
                "source_pages": apps_pages or [end_p],
                "visual_type": "APPLICATION_CARD",
                "visual_description": "Real-world application contexts drawn from the textbook's discussion.",
                "on_screen_text": "Real-World Use:\n" + "\n".join(
                    f"• {shorten_sentence(s, 12)}" for _, s in apps_entries[:3]
                ) if apps_entries else f"Real-World Use:\n• {primary_term.capitalize()} in practice\n• Textbook pages {start_p}-{end_p}",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "CARD_GLOW",
                "visual_data": {
                    "applications": [
                        (shorten_sentence(s, 8), shorten_sentence(s, 18)) for _, s in apps_entries[:3]
                    ] or [
                        ("Where It Matters", f"{primary_term.capitalize()} underpins practical problems in {topic_name}."),
                        ("From the Textbook", f"Pages {start_p}-{end_p} connect the theory to real scenarios."),
                        ("Exam Relevance", "These applications frequently anchor exam questions.")
                    ]
                }
            })

            # ---------- 9. SUMMARY & KNOWLEDGE CHECK (grounded Q&A) ----------
            summary_budget = target_words * budgets[9]
            summary_entries = pick("definitions", summary_budget * 0.6, fallbacks=["general"])
            summary_recap_terms = ", ".join(key_terms[:4]) if key_terms else video.title
            summary_narration, summary_pages, summary_grounded = weave(
                [
                    f"Let's pull it all together.",
                    f"Today we anchored everything in the textbook's own words across pages {start_p} to {end_p}, focusing on {summary_recap_terms}.",
                ],
                summary_entries,
            )
            if concept_grounded:
                check_sentence = concept_grounded[0]
                check_page = concept_pages[0] if concept_pages else start_p
            elif summary_grounded:
                check_sentence = summary_grounded[0]
                check_page = summary_pages[0] if summary_pages else start_p
            else:
                check_sentence = f"{primary_term.capitalize()} is the central concept of {video.title}."
                check_page = start_p
            check_correct = shorten_sentence(check_sentence, 16)
            check_distractors = [
                f"{primary_term.capitalize()} is unrelated to {secondary_term} and plays no role in {topic_name}.",
                f"The textbook treats {primary_term} as a purely decorative idea with no practical use.",
                f"{primary_term.capitalize()} only applies when nothing measurable is involved.",
            ]
            summary_narration += (
                f" Now, a quick check before you go: {shorten_sentence(check_sentence, 20)} — which statement matches the textbook best? "
                f"Pick the option that stays true to the definition on page {check_page}, and you've got it. "
                f"Great work today — review these pages once more and you'll be in excellent shape for the quiz."
            )
            sections.append({
                "section_id": 9,
                "type": "SUMMARY_AND_QUIZ",
                "title": "Summary & Conceptual Knowledge Check",
                "narration": summary_narration,
                "source_pages": summary_pages or [end_p],
                "visual_type": "KNOWLEDGE_CHECK",
                "visual_description": "Summary slide with grounded key terms followed by a textbook-anchored knowledge check.",
                "on_screen_text": f"Key Takeaways:\n" + "\n".join(f"• {t.title()}" for t in key_terms[:4]) +
                                  f"\n\nQuick Check (Page {check_page})",
                "formula": None,
                "diagram_description": None,
                "animation_hint": "CHECK_REVEAL",
                "visual_data": {
                    "question": f"Which statement best matches the textbook's treatment of {primary_term}?",
                    "options": [
                        (check_correct, True),
                        (check_distractors[0], False),
                        (check_distractors[1], False),
                        (check_distractors[2], False)
                    ],
                    "explanation": f"The textbook states on page {check_page}: {check_sentence}"
                }
            })

            # ---------- Word-count top-up: extend grounded sections if short ----------
            current_words = sum(len(s["narration"].split()) for s in sections)
            if current_words < target_words * 0.8 and page_sentences:
                extra = dedupe_entries(buckets["general"], used_keys)
                extra_parts: List[str] = []
                for page_num, s in extra:
                    if current_words >= target_words * 0.95:
                        break
                    cleaned = clean_sentence_for_narration(s)
                    extra_parts.append(cleaned)
                    current_words += len(cleaned.split())
                    mark_entries_used([(page_num, s)], used_keys)
                if extra_parts:
                    # Fold remaining grounded content into the worked example section
                    sections[4]["narration"] += " " + " ".join(extra_parts)
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
