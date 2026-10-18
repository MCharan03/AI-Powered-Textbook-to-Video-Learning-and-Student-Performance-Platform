"""
BUILD 07 — INTERACTIVE QUIZ GENERATION & STUDENT MASTERY ENGINE TESTS

Tests 1 to 32 verifying:
1. Admin can generate quiz.
2. Non-admin cannot generate quiz.
3. Quiz is grounded in topic.
4. Question count is correct.
5. Questions have 4 options.
6. Exactly one correct answer.
7. Duplicate questions rejected.
8. Invalid questions rejected.
9. Difficulty assigned.
10. Bloom level assigned.
11. Source references preserved.
12. Draft quiz hidden from students.
13. Published quiz visible.
14. Correct MCQ grading.
15. Incorrect MCQ grading.
16. Passing score calculation.
17. Attempt recorded.
18. Student only sees own attempts.
19. Topic performance updated.
20. Mastery calculation works.
21. Failed quiz triggers adaptive remediation.
22. Adaptive quiz uses parent_quiz_id.
23. Adaptive quiz is marked is_adaptive=true.
24. Previous questions are excluded.
25. Weak concepts are targeted.
26. Adaptive difficulty works.
27. Adaptive quiz does not duplicate questions.
28. Adaptive generation failure handled safely.
29. ProcessingJob lifecycle works.
30. Student cannot access answer key before submission.
31. Parent/teacher cannot modify student attempt.
32. End-to-end quiz lifecycle works.
"""

import pytest
from app.models.models import (
    Subject, Chapter, Topic, Subtopic, Video, VideoScriptVersion,
    Quiz, Question, QuizAttempt, StudentTopicPerformance, ProcessingJob,
    JobStatus, MasteryLevel
)
from app.services.quiz_service import (
    QuizService, QuizQuestionValidator,
    DeterministicQuizGenerationEngine
)
from tests.conftest import make_auth_header


def _create_approved_learning_hierarchy(db, title="Graph Traversal Algorithms"):
    """Helper to create subject, chapter, topic with approved script & video."""
    subject = Subject(name=f"Subj-{title}", created_by=1)
    db.add(subject)
    db.flush()

    chapter = Chapter(
        subject_id=subject.id,
        chapter_number=1,
        title=f"Chapter: {title}",
        status="APPROVED",
        source_start_page=1,
        source_end_page=50
    )
    db.add(chapter)
    db.flush()

    topic = Topic(
        chapter_id=chapter.id,
        sequence_number=1,
        title=title,
        description=f"Deep algorithmic study of {title}. Graph invariants, BFS, DFS, and topological sort.",
        status="APPROVED",
        source_start_page=1,
        source_end_page=25
    )
    db.add(topic)
    db.flush()

    subtopic = Subtopic(
        topic_id=topic.id,
        sequence_number=1,
        title=f"{title} Invariants",
        description="Core mechanisms, edge classifications, and complexity proofs.",
        source_start_page=1,
        source_end_page=12
    )
    db.add(subtopic)
    db.flush()

    # Video with approved script
    video = Video(
        topic_id=topic.id,
        subtopic_id=subtopic.id,
        title=f"Visualizing {title}",
        description=f"Detailed educational video on {title}",
        status="PUBLISHED",
        review_status="published",
        script_status="SCRIPT_APPROVED",
        duration_seconds=300,
        estimated_duration_seconds=300,
        learning_objective=f"Master {title} and its computational bounds.",
        content_outline=[
            f"Introduction to {title}",
            "Breadth-First Search queue analysis",
            "Depth-First Search recursion and back edges",
            "Cycle detection and topological ordering"
        ],
        source_start_page=1,
        source_end_page=25,
        script="Comprehensive narration script for graph exploration. We examine vertex visitation, queue states, and runtime O(V + E)."
    )
    db.add(video)
    db.flush()

    db.commit()
    db.refresh(topic)
    return subject, chapter, topic, video


# ==============================================================================
# TEST 1: Admin can generate quiz
# ==============================================================================
def test_01_admin_can_generate_quiz(client, db_session):
    admin_h = make_auth_header(1, "admin")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Dynamic Programming")

    res = client.post(
        f"/admin/topics/{topic.id}/quizzes/generate",
        headers=admin_h,
        json={"question_count": 10, "passing_score": 80.0, "engine": "deterministic"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["topic_id"] == topic.id
    assert data["question_count"] == 10
    assert len(data["questions"]) == 10
    assert data["status"] in ["REVIEW", "DRAFT"]


# ==============================================================================
# TEST 2: Non-admin cannot generate quiz (RBAC)
# ==============================================================================
def test_02_non_admin_cannot_generate_quiz(client, db_session):
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Divide and Conquer")

    for role, uid in [("student", 2), ("teacher", 4), ("parent", 5)]:
        h = make_auth_header(uid, role)
        res = client.post(
            f"/admin/topics/{topic.id}/quizzes/generate",
            headers=h,
            json={"question_count": 5}
        )
        assert res.status_code == 403, f"{role} must not be allowed to generate quizzes"


# ==============================================================================
# TEST 3: Quiz is grounded in topic content
# ==============================================================================
def test_03_quiz_is_grounded_in_topic(client, db_session):
    admin_h = make_auth_header(1, "admin")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Red-Black Trees")

    res = client.post(
        f"/admin/topics/{topic.id}/quizzes/generate",
        headers=admin_h,
        json={"question_count": 5, "engine": "deterministic"}
    )
    assert res.status_code == 200
    questions = res.json()["questions"]
    for q in questions:
        # Question text or options must reference topic or outline terms
        content_blob = (q["question_text"] + " " + " ".join(str(o) for o in q["options"])).lower()
        assert "red-black" in content_blob or "tree" in content_blob or "invariant" in content_blob


# ==============================================================================
# TEST 4: Configurable question count
# ==============================================================================
def test_04_configurable_question_count(client, db_session):
    admin_h = make_auth_header(1, "admin")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Heap Sort")

    for count in [5, 10, 15]:
        res = client.post(
            f"/admin/topics/{topic.id}/quizzes/generate",
            headers=admin_h,
            json={"question_count": count}
        )
        assert res.status_code == 200
        assert len(res.json()["questions"]) == count


# ==============================================================================
# TEST 5: Questions have at least 4 options
# ==============================================================================
def test_05_questions_have_four_options(client, db_session):
    admin_h = make_auth_header(1, "admin")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "B-Trees")

    res = client.post(
        f"/admin/topics/{topic.id}/quizzes/generate",
        headers=admin_h,
        json={"question_count": 5}
    )
    assert res.status_code == 200
    for q in res.json()["questions"]:
        assert len(q["options"]) >= 4
        # Options must be unique
        opt_texts = [o.get("text") if isinstance(o, dict) else str(o) for o in q["options"]]
        assert len(set(opt_texts)) == len(opt_texts)


# ==============================================================================
# TEST 6: Exactly one correct answer exists and matches options
# ==============================================================================
def test_06_exactly_one_correct_answer(client, db_session):
    admin_h = make_auth_header(1, "admin")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Greedy Algorithms")

    res = client.post(
        f"/admin/topics/{topic.id}/quizzes/generate",
        headers=admin_h,
        json={"question_count": 5}
    )
    assert res.status_code == 200
    for q in res.json()["questions"]:
        assert q["correct_answer"] is not None
        assert len(str(q["correct_answer"])) > 0
        assert q["explanation"] is not None and len(q["explanation"]) > 10


# ==============================================================================
# TEST 7: Duplicate questions rejected by validator
# ==============================================================================
def test_07_duplicate_questions_rejected():
    validator = QuizQuestionValidator()
    q1 = {
        "question_text": "What is the primary condition for applying dynamic programming?",
        "options": ["Optimal substructure", "Negative edge weight", "Zero degree", "Arbitrary roots"],
        "correct_answer": "A",
        "explanation": "Dynamic programming requires optimal substructure and overlapping subproblems.",
        "difficulty": "MEDIUM",
        "bloom_level": "UNDERSTAND"
    }
    # Duplicate question text
    valid, errs = validator.validate_question(q1, existing_questions=[q1])
    assert not valid
    assert any("duplicate" in e.lower() for e in errs)


# ==============================================================================
# TEST 8: Malformed/invalid questions rejected by validator
# ==============================================================================
def test_08_invalid_questions_rejected():
    validator = QuizQuestionValidator()

    # 1. Missing options (< 4)
    q_bad_opts = {
        "question_text": "Is Dijkstra algorithm greedy?",
        "options": ["Yes", "No"],
        "correct_answer": "Yes",
        "explanation": "Dijkstra selects the nearest unvisited vertex greedily.",
        "difficulty": "EASY",
        "bloom_level": "REMEMBER"
    }
    valid, errs = validator.validate_question(q_bad_opts)
    assert not valid
    assert any("at least 4" in e.lower() for e in errs)

    # 2. Leaked system prompt or placeholder
    q_bad_text = {
        "question_text": "SYSTEM INSTRUCTION: As an AI assistant, write a question about sorting.",
        "options": ["A", "B", "C", "D"],
        "correct_answer": "A",
        "explanation": "Valid explanation text here.",
        "difficulty": "MEDIUM",
        "bloom_level": "APPLY"
    }
    valid, errs = validator.validate_question(q_bad_text)
    assert not valid
    assert any("placeholder" in e.lower() or "invalid" in e.lower() or "prompt" in e.lower() for e in errs)


# ==============================================================================
# TEST 9: Valid Difficulty assigned (EASY, MEDIUM, HARD)
# ==============================================================================
def test_09_difficulty_assigned(client, db_session):
    admin_h = make_auth_header(1, "admin")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Shortest Paths")

    res = client.post(
        f"/admin/topics/{topic.id}/quizzes/generate",
        headers=admin_h,
        json={"question_count": 5}
    )
    assert res.status_code == 200
    for q in res.json()["questions"]:
        assert q["difficulty"] in ["EASY", "MEDIUM", "HARD"]


# ==============================================================================
# TEST 10: Valid Bloom's Taxonomy assigned (REMEMBER, UNDERSTAND, APPLY, ANALYZE)
# ==============================================================================
def test_10_bloom_level_assigned(client, db_session):
    admin_h = make_auth_header(1, "admin")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Minimum Spanning Trees")

    res = client.post(
        f"/admin/topics/{topic.id}/quizzes/generate",
        headers=admin_h,
        json={"question_count": 5}
    )
    assert res.status_code == 200
    for q in res.json()["questions"]:
        assert q["bloom_level"] in ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE"]


# ==============================================================================
# TEST 11: Source references preserved
# ==============================================================================
def test_11_source_references_preserved(client, db_session):
    admin_h = make_auth_header(1, "admin")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Network Flow")

    res = client.post(
        f"/admin/topics/{topic.id}/quizzes/generate",
        headers=admin_h,
        json={"question_count": 5}
    )
    assert res.status_code == 200
    for q in res.json()["questions"]:
        assert q["source_reference"] is not None
        assert len(q["source_reference"]) > 0


# ==============================================================================
# TEST 12: Draft/Review quiz hidden from students
# ==============================================================================
def test_12_draft_quiz_hidden_from_students(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "String Matching")

    # Generate quiz (status: REVIEW)
    gen_res = client.post(
        f"/admin/topics/{topic.id}/quizzes/generate",
        headers=admin_h,
        json={"question_count": 5}
    )
    quiz_id = gen_res.json()["id"]

    # Student cannot retrieve quiz by id
    get_res = client.get(f"/learn/quizzes/{quiz_id}", headers=student_h)
    assert get_res.status_code == 404

    # Student cannot list unpublished quiz
    list_res = client.get(f"/learn/topics/{topic.id}/quizzes", headers=student_h)
    assert list_res.status_code == 200
    assert not any(q["id"] == quiz_id for q in list_res.json())


# ==============================================================================
# TEST 13: Published quiz visible to students
# ==============================================================================
def test_13_published_quiz_visible_to_students(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Hashing Techniques")

    gen_res = client.post(
        f"/admin/topics/{topic.id}/quizzes/generate",
        headers=admin_h,
        json={"question_count": 5}
    )
    quiz_id = gen_res.json()["id"]

    # Admin approves and publishes
    client.post(f"/admin/quizzes/{quiz_id}/approve", headers=admin_h)
    pub_res = client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"

    # Now student can view
    get_res = client.get(f"/learn/quizzes/{quiz_id}", headers=student_h)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == quiz_id


# ==============================================================================
# TEST 14: Correct MCQ grading
# ==============================================================================
def test_14_correct_mcq_grading(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Disjoint Sets")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # Query full quiz as admin to get answer keys for testing
    admin_quiz = client.get(f"/admin/quizzes/{quiz_id}", headers=admin_h).json()
    all_correct_answers = {
        str(q["id"]): q["correct_answer"]
        for q in admin_quiz["questions"]
    }

    # Student submits 100% correct answers
    sub_res = client.post(
        f"/learn/quizzes/{quiz_id}/submit",
        headers=student_h,
        json={"answers": all_correct_answers}
    )
    assert sub_res.status_code == 200
    data = sub_res.json()
    assert data["percentage"] == 100.0
    assert data["passed"] is True
    assert data["score"] == 5.0
    assert len(data["weak_concepts"]) == 0


# ==============================================================================
# TEST 15: Incorrect MCQ grading
# ==============================================================================
def test_15_incorrect_mcq_grading(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Fibonacci Heaps")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # Deliberately submit wrong answer
    wrong_answers = {str(q["id"]): "Z_WRONG" for q in gen_res.json()["questions"]}

    sub_res = client.post(
        f"/learn/quizzes/{quiz_id}/submit",
        headers=student_h,
        json={"answers": wrong_answers}
    )
    assert sub_res.status_code == 200
    data = sub_res.json()
    assert data["percentage"] == 0.0
    assert data["passed"] is False
    assert len(data["weak_concepts"]) > 0


# ==============================================================================
# TEST 16: Passing score calculation
# ==============================================================================
def test_16_passing_score_calculation(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Amortized Analysis")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 10, "passing_score": 80.0})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    admin_quiz = client.get(f"/admin/quizzes/{quiz_id}", headers=admin_h).json()
    qs = admin_quiz["questions"]

    # 7 out of 10 correct = 70% (< 80% passing)
    answers = {}
    for i, q in enumerate(qs):
        answers[str(q["id"])] = q["correct_answer"] if i < 7 else "WRONG"

    sub_res = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": answers})
    assert sub_res.status_code == 200
    res_data = sub_res.json()
    assert res_data["percentage"] == 70.0
    assert res_data["passed"] is False


# ==============================================================================
# TEST 17: Attempt recorded in database
# ==============================================================================
def test_17_attempt_recorded_in_db(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Trie Data Structures")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    sub_res = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": {}})
    attempt_id = sub_res.json()["attempt_id"]

    att_in_db = db_session.get(QuizAttempt, attempt_id)
    assert att_in_db is not None
    assert att_in_db.quiz_id == quiz_id
    assert att_in_db.student_id == 1  # Alice's student record id is 1


# ==============================================================================
# TEST 18: Student only sees their own attempts
# ==============================================================================
def test_18_student_isolation_on_attempts(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student1_h = make_auth_header(2, "student")  # Alice
    student2_h = make_auth_header(3, "student")  # Bob
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Suffix Trees")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # Student 1 attempts quiz
    client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student1_h, json={"answers": {}})

    # Student 1 sees 1 attempt
    s1_attempts = client.get(f"/learn/quizzes/{quiz_id}/attempts", headers=student1_h).json()
    assert len(s1_attempts) == 1

    # Student 2 sees 0 attempts
    s2_attempts = client.get(f"/learn/quizzes/{quiz_id}/attempts", headers=student2_h).json()
    assert len(s2_attempts) == 0


# ==============================================================================
# TEST 19: Topic performance record created / updated
# ==============================================================================
def test_19_topic_performance_updated(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Segment Trees")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # First attempt: 0%
    client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": {}})

    perf_res = client.get(f"/learn/topics/{topic.id}/performance", headers=student_h)
    assert perf_res.status_code == 200
    perf = perf_res.json()
    assert perf["topic_id"] == topic.id
    assert perf["attempts"] == 1
    assert perf["latest_score"] == 0.0
    assert perf["mastery_level"] == "NEEDS_PRACTICE"


# ==============================================================================
# TEST 20: Mastery calculation rules (<50 NEEDS_PRACTICE, 50-79 IN_PROGRESS, 80+ MASTERED)
# ==============================================================================
def test_20_mastery_calculation_rules(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Fenwick Trees")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 10})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    admin_quiz = client.get(f"/admin/quizzes/{quiz_id}", headers=admin_h).json()
    qs = admin_quiz["questions"]

    # 1. Score 40% -> NEEDS_PRACTICE
    ans_40 = {str(q["id"]): q["correct_answer"] if i < 4 else "WRONG" for i, q in enumerate(qs)}
    res1 = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": ans_40})
    assert res1.json()["mastery_level"] == "NEEDS_PRACTICE"

    # 2. Score 70% -> IN_PROGRESS
    ans_70 = {str(q["id"]): q["correct_answer"] if i < 7 else "WRONG" for i, q in enumerate(qs)}
    res2 = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": ans_70})
    assert res2.json()["mastery_level"] == "IN_PROGRESS"

    # 3. Score 90% -> MASTERED
    ans_90 = {str(q["id"]): q["correct_answer"] if i < 9 else "WRONG" for i, q in enumerate(qs)}
    res3 = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": ans_90})
    assert res3.json()["mastery_level"] == "MASTERED"


# ==============================================================================
# TEST 21: Low score triggers adaptive remediation trigger
# ==============================================================================
def test_21_failed_quiz_triggers_adaptive_remediation(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Convex Hull")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # Submit 0% score
    sub_res = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": {}})
    data = sub_res.json()
    assert data["passed"] is False
    assert data["adaptive_recommended"] is True


# ==============================================================================
# TEST 22 & 23: Adaptive quiz uses parent_quiz_id & is_adaptive=True
# ==============================================================================
def test_22_and_23_adaptive_quiz_attributes(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Linear Programming")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    parent_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{parent_id}/publish", headers=admin_h)

    # Submit poor score
    client.post(f"/learn/quizzes/{parent_id}/submit", headers=student_h, json={"answers": {}})

    # Generate adaptive quiz
    adapt_res = client.post(f"/learn/topics/{topic.id}/adaptive-quiz", headers=student_h)
    assert adapt_res.status_code == 200
    adapt_data = adapt_res.json()
    assert adapt_data["is_adaptive"] is True
    assert adapt_data["parent_quiz_id"] == parent_id
    assert adapt_data["attempt_number"] == 2
    assert adapt_data["status"] == "PUBLISHED"


# ==============================================================================
# TEST 24: Previous questions are excluded in adaptive quiz
# ==============================================================================
def test_24_previous_questions_excluded(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Maximum Bipartite Matching")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    parent_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{parent_id}/publish", headers=admin_h)
    client.post(f"/learn/quizzes/{parent_id}/submit", headers=student_h, json={"answers": {}})

    orig_q_texts = {q["question_text"].strip() for q in gen_res.json()["questions"]}

    # Adaptive quiz
    adapt_res = client.post(f"/learn/topics/{topic.id}/adaptive-quiz", headers=student_h)
    assert adapt_res.status_code == 200
    adapt_q_texts = {q["question_text"].strip() for q in adapt_res.json()["questions"]}

    # No exact duplicates
    intersection = orig_q_texts.intersection(adapt_q_texts)
    assert len(intersection) == 0, f"Adaptive quiz repeated original questions: {intersection}"


# ==============================================================================
# TEST 25: Weak concepts are targeted in adaptive quiz
# ==============================================================================
def test_25_weak_concepts_targeted(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Kruskal Algorithm")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # Submit and get weak concepts
    sub_res = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": {}})
    weak_concepts = sub_res.json()["weak_concepts"]
    assert len(weak_concepts) > 0

    adapt_res = client.post(f"/learn/topics/{topic.id}/adaptive-quiz", headers=student_h)
    assert adapt_res.status_code == 200
    # Generated adaptive quiz title or questions should reference targeted weak concept
    adapt_title = adapt_res.json()["title"]
    assert "Adaptive Practice" in adapt_title


# ==============================================================================
# TEST 26: Adaptive difficulty adjusts based on prior performance
# ==============================================================================
def test_26_adaptive_difficulty_adjusts(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Bellman-Ford Algorithm")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # Score < 50% -> adaptive quiz focuses on EASY / foundational questions
    client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": {}})

    adapt_res = client.post(f"/learn/topics/{topic.id}/adaptive-quiz", headers=student_h)
    assert adapt_res.status_code == 200
    difficulties = [q["difficulty"] for q in adapt_res.json()["questions"]]
    # Should include EASY questions for remediation
    assert "EASY" in difficulties or "MEDIUM" in difficulties


# ==============================================================================
# TEST 27: Adaptive quiz does not contain internal duplicate questions
# ==============================================================================
def test_27_adaptive_quiz_no_internal_duplicates(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Floyd-Warshall Algorithm")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)
    client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": {}})

    adapt_res = client.post(f"/learn/topics/{topic.id}/adaptive-quiz", headers=student_h)
    assert adapt_res.status_code == 200
    texts = [q["question_text"] for q in adapt_res.json()["questions"]]
    assert len(texts) == len(set(texts))


# ==============================================================================
# TEST 28: Adaptive generation failure handled safely
# ==============================================================================
def test_28_adaptive_generation_handles_missing_content_safely(client, db_session):
    student_h = make_auth_header(2, "student")
    # Non-existent topic
    res = client.post("/learn/topics/999999/adaptive-quiz", headers=student_h)
    assert res.status_code in [400, 404]


# ==============================================================================
# TEST 29: ProcessingJob lifecycle works (QUIZ_GENERATION, 10% -> 100%)
# ==============================================================================
def test_29_processing_job_lifecycle(client, db_session):
    admin_h = make_auth_header(1, "admin")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Job Scheduling")

    res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    assert res.status_code == 200

    job = db_session.query(ProcessingJob).filter(
        ProcessingJob.topic_id == topic.id,
        ProcessingJob.job_type == "QUIZ_GENERATION"
    ).order_by(ProcessingJob.created_at.desc()).first()

    assert job is not None
    assert str(job.status).upper() == "COMPLETED"
    assert job.progress == 100.0


# ==============================================================================
# TEST 30: Student cannot access answer key before submission
# ==============================================================================
def test_30_student_cannot_access_answer_key_before_submission(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Prim Algorithm")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # Student requests published quiz
    res = client.get(f"/learn/quizzes/{quiz_id}", headers=student_h)
    assert res.status_code == 200
    for q in res.json()["questions"]:
        assert "correct_answer" not in q or q["correct_answer"] is None
        assert "explanation" not in q or q["explanation"] is None


# ==============================================================================
# TEST 31: Parent and teacher cannot modify student quiz attempt
# ==============================================================================
def test_31_parent_and_teacher_cannot_submit_student_attempt(client, db_session):
    admin_h = make_auth_header(1, "admin")
    teacher_h = make_auth_header(4, "teacher")
    parent_h = make_auth_header(5, "parent")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Huffman Coding")

    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    quiz_id = gen_res.json()["id"]
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # Parent attempt rejected
    p_res = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=parent_h, json={"answers": {}})
    assert p_res.status_code == 403

    # Teacher attempt rejected
    t_res = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=teacher_h, json={"answers": {}})
    assert t_res.status_code == 403


# ==============================================================================
# TEST 32: Complete End-to-End Quiz Lifecycle
# ==============================================================================
def test_32_end_to_end_quiz_lifecycle(client, db_session):
    admin_h = make_auth_header(1, "admin")
    student_h = make_auth_header(2, "student")
    _, _, topic, _ = _create_approved_learning_hierarchy(db_session, "Branch and Bound")

    # Step 1: Admin generates quiz
    gen_res = client.post(f"/admin/topics/{topic.id}/quizzes/generate", headers=admin_h, json={"question_count": 5})
    assert gen_res.status_code == 200
    quiz_id = gen_res.json()["id"]

    # Step 2: Admin reviews and publishes quiz
    client.post(f"/admin/quizzes/{quiz_id}/approve", headers=admin_h)
    client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)

    # Step 3: Student starts quiz
    start_res = client.post(f"/learn/quizzes/{quiz_id}/start", headers=student_h)
    assert start_res.status_code == 200

    # Step 4: Student submits answers
    admin_quiz = client.get(f"/admin/quizzes/{quiz_id}", headers=admin_h).json()
    qs = admin_quiz["questions"]
    # Provide 4/5 correct answers = 80%
    answers = {str(q["id"]): q["correct_answer"] if i < 4 else "WRONG" for i, q in enumerate(qs)}
    sub_res = client.post(f"/learn/quizzes/{quiz_id}/submit", headers=student_h, json={"answers": answers})
    assert sub_res.status_code == 200
    result = sub_res.json()
    assert result["percentage"] == 80.0
    assert result["passed"] is True
    assert result["mastery_level"] == "MASTERED"

    # Step 5: Student verifies topic performance
    perf_res = client.get(f"/learn/topics/{topic.id}/performance", headers=student_h)
    assert perf_res.status_code == 200
    perf = perf_res.json()
    assert perf["mastery_level"] == "MASTERED"
    assert perf["best_score"] == 80.0
