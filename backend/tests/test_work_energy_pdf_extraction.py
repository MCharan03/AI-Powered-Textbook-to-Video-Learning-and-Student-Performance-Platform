import os
import pytest
from app.services.pipeline_service import extract_pdf_pages
from app.services.ai_extractor import DeterministicCurriculumExtractor

POSSIBLE_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "uploads", "Work_Energy_Vdo_test.pdf"),
    "/Users/pushkarbhuyar/Downloads/Work_Energy_Vdo_test.pdf",
    os.path.join(os.path.dirname(__file__), "..", "uploads", "0c15d06bb062401684b1793b939c0456_Work_Energy_Vdo_test.pdf"),
]
PDF_PATH = next((p for p in POSSIBLE_PATHS if os.path.exists(p)), None)


@pytest.mark.skipif(not PDF_PATH or not os.path.exists(PDF_PATH), reason="Test PDF not found")
def test_work_energy_textbook_extraction():
    # 1. Page-by-page extraction
    pages = extract_pdf_pages(PDF_PATH)
    assert len(pages) == 24
    assert pages[0]["page_number"] == 1
    assert "Work, Energy, and" in pages[0]["text"]
    assert "Chapter" in pages[0]["text"]

    extractor = DeterministicCurriculumExtractor()

    # 2. Chapter detection
    chapters = extractor.extract_chapters(pages, "Work, Energy, and Simple Machines")
    assert len(chapters) == 1
    ch = chapters[0]
    assert ch["chapter_number"] == 7
    assert "Work, Energy, and Simple Machines" in ch["title"]
    assert ch["source_start_page"] == 1
    assert ch["source_end_page"] == 24
    assert ch["confidence_score"] >= 0.95

    # 3. Topic detection
    ch_pages_slice = [p for p in pages if ch["source_start_page"] <= p["page_number"] <= ch["source_end_page"]]
    ch_text = "\n".join([p["text"] for p in ch_pages_slice])
    topics = extractor.extract_topics(
        chapter_title=ch["title"],
        chapter_text=ch_text,
        start_page=ch["source_start_page"],
        end_page=ch["source_end_page"],
        pages=ch_pages_slice
    )

    expected_topics = [
        ("7.1", "7.1 Work Done by a Constant Force", 2, 4),
        ("7.2", "7.2 The Work-Energy Theorem", 5, 5),
        ("7.3", "7.3 Forms of Energy", 6, 6),
        ("7.4", "7.4 Mechanical Energy", 6, 13),
        ("7.5", "7.5 Power", 14, 14),
        ("7.6", "7.6 Simple Machines", 15, 24),
    ]

    assert len(topics) == 6
    for idx, (expected_num, expected_title, expected_start, expected_end) in enumerate(expected_topics):
        t = topics[idx]
        assert expected_num in t["title"]
        assert expected_title == t["title"]
        assert t["source_start_page"] == expected_start
        assert t["source_end_page"] == expected_end
        assert t["source_start_page"] <= t["source_end_page"]

    # 4. Subtopic detection
    expected_subtopics_by_topic = {
        "7.1": [
            ("When is work done equal to zero?", 3, 3),
            ("Positive and negative work done", 3, 4),
        ],
        "7.2": [
            ("The Work-Energy Theorem", 5, 5),
        ],
        "7.3": [
            ("Forms of Energy", 6, 6),
        ],
        "7.4": [
            ("Kinetic energy", 6, 7),
            ("Potential energy", 8, 10),
            ("Conservation of mechanical energy", 11, 13),
        ],
        "7.5": [
            ("Power", 14, 14),
        ],
        "7.6": [
            ("Pulley", 15, 15),
            ("Inclined plane", 16, 17),
            ("Lever", 18, 24),
        ]
    }

    for t in topics:
        top_pages_slice = [p for p in pages if t["source_start_page"] <= p["page_number"] <= t["source_end_page"]]
        top_text = "\n".join([p["text"] for p in top_pages_slice])
        subtopics = extractor.extract_subtopics(
            topic_title=t["title"],
            topic_text=top_text,
            start_page=t["source_start_page"],
            end_page=t["source_end_page"],
            pages=top_pages_slice
        )
        t_key = t["title"].split()[0]
        expected_subs = expected_subtopics_by_topic[t_key]
        assert len(subtopics) == len(expected_subs)
        for s_idx, (exp_title, exp_start, exp_end) in enumerate(expected_subs):
            sub = subtopics[s_idx]
            assert exp_title in sub["title"]
            assert sub["source_start_page"] == exp_start
            assert sub["source_end_page"] == exp_end
            assert sub["source_start_page"] <= sub["source_end_page"]

    # Verify no invented generic boilerplate exists in titles
    all_titles = [ch["title"]] + [t["title"] for t in topics]
    for t in topics:
        top_pages_slice = [p for p in pages if t["source_start_page"] <= p["page_number"] <= t["source_end_page"]]
        top_text = "\n".join([p["text"] for p in top_pages_slice])
        subs = extractor.extract_subtopics(t["title"], top_text, t["source_start_page"], t["source_end_page"], pages=top_pages_slice)
        all_titles.extend([s["title"] for s in subs])

    for title in all_titles:
        assert "Core Principles" not in title
        assert "Methodologies & Applications" not in title
        assert "Overview:" not in title
        assert "Mechanisms & Analysis" not in title
        assert not title.startswith("Fig.")
        assert not title.startswith("Figure")
        assert not title.startswith("Activity")
        assert not title.startswith("Example")
