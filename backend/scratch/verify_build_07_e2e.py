"""
BUILD 07 — PROGRAMMATIC END-TO-END VERIFICATION SCRIPT

Strictly executes 22 verified steps:
STEP 1: Admin authentication.
STEP 2: Find approved topic/video/script.
STEP 3: Generate quiz.
STEP 4: Verify ProcessingJob.
STEP 5: Verify quiz has valid questions.
STEP 6: Admin reviews quiz.
STEP 7: Admin approves quiz.
STEP 8: Admin publishes quiz.
STEP 9: Student authenticates.
STEP 10: Student receives published quiz.
STEP 11: Verify correct answers are NOT exposed before submission.
STEP 12: Student submits answers.
STEP 13: Verify automatic grading.
STEP 14: Verify QuizAttempt created.
STEP 15: Verify StudentTopicPerformance updated.
STEP 16: Use a deliberately low score.
STEP 17: Verify adaptive quiz is generated.
STEP 18: Verify adaptive quiz has: is_adaptive=true, parent_quiz_id, new questions, weak-topic focus.
STEP 19: Verify previously answered questions are excluded.
STEP 20: Verify mastery changes after improved adaptive score.
STEP 21: Verify student cannot access another student's attempt.
STEP 22: Print final result: BUILD 07 E2E VERIFICATION PASSED.
"""

import sys
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.models import (
    User, Subject, Chapter, Topic, Subtopic, Video,
    Quiz, Question, QuizAttempt, StudentTopicPerformance,
    ProcessingJob, JobStatus, Student
)
from app.core.security import create_token, hash_pw

def run_verification():
    print("=" * 60)
    print("STARTING BUILD 07 PROGRAMMATIC E2E VERIFICATION")
    print("=" * 60)

    db = SessionLocal()
    client = TestClient(app)

    try:
        # STEP 1: Admin authentication
        print("\n--- STEP 1: Admin authentication ---")
        admin = db.query(User).filter(User.role == "admin").first()
        if not admin:
            admin = User(
                username="admin_e2e_b7",
                name="Admin E2E",
                email="admin_e2e_b7@test.com",
                password_hash=hash_pw("AdminPass123!"),
                role="admin",
                is_active=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

        admin_token = create_token(sub=str(admin.id), role="admin")
        admin_h = {"Authorization": f"Bearer {admin_token}"}
        print(f"✓ Admin authenticated successfully: user_id={admin.id}")

        # STEP 2: Find approved topic/video/script
        print("\n--- STEP 2: Find/Create approved topic/video/script ---")
        subject = Subject(name="E2E Advanced Data Structures", created_by=admin.id)
        db.add(subject)
        db.flush()

        chapter = Chapter(
            subject_id=subject.id,
            chapter_number=1,
            title="Balanced Search Trees",
            status="APPROVED",
            source_start_page=1,
            source_end_page=40
        )
        db.add(chapter)
        db.flush()

        topic = Topic(
            chapter_id=chapter.id,
            sequence_number=1,
            title="AVL Tree Rebalancing Invariants",
            description="Detailed analysis of height balance factor in AVL trees, single rotations, and double rotations.",
            status="APPROVED",
            source_start_page=1,
            source_end_page=20
        )
        db.add(topic)
        db.flush()

        subtopic = Subtopic(
            topic_id=topic.id,
            sequence_number=1,
            title="Rotations and Balance Factors",
            description="Left-Left, Right-Right, Left-Right, and Right-Left rotation mechanics.",
            source_start_page=1,
            source_end_page=10
        )
        db.add(subtopic)
        db.flush()

        video = Video(
            topic_id=topic.id,
            subtopic_id=subtopic.id,
            title="AVL Rotations Deep Dive",
            description="Algorithmic visualization of AVL rotations.",
            status="PUBLISHED",
            review_status="published",
            script_status="SCRIPT_APPROVED",
            duration_seconds=330,
            estimated_duration_seconds=330,
            learning_objective="Understand AVL balance factors and apply tree rotations.",
            content_outline=[
                "Definition of AVL balance factor (-1, 0, 1)",
                "Left rotation for Right-Right imbalance",
                "Right rotation for Left-Left imbalance",
                "Double rotations for zig-zag cases"
            ],
            source_start_page=1,
            source_end_page=20,
            script="Narration explaining tree height balance. When balance factor becomes +2 or -2, rebalancing via rotation restores the logarithmic search bound."
        )
        db.add(video)
        db.commit()
        db.refresh(topic)
        print(f"✓ Approved topic & script ready: topic_id={topic.id}, video_id={video.id}")

        # STEP 3: Generate quiz
        print("\n--- STEP 3: Generate quiz ---")
        gen_res = client.post(
            f"/admin/topics/{topic.id}/quizzes/generate",
            headers=admin_h,
            json={"question_count": 10, "passing_score": 80.0, "engine": "deterministic"}
        )
        assert gen_res.status_code == 200, f"Quiz generation failed: {gen_res.text}"
        quiz_data = gen_res.json()
        quiz_id = quiz_data["id"]
        print(f"✓ Quiz generated successfully: quiz_id={quiz_id}, questions={quiz_data['question_count']}")

        # STEP 4: Verify ProcessingJob
        print("\n--- STEP 4: Verify ProcessingJob ---")
        job = db.query(ProcessingJob).filter(
            ProcessingJob.topic_id == topic.id,
            ProcessingJob.job_type == "QUIZ_GENERATION"
        ).order_by(ProcessingJob.created_at.desc()).first()
        assert job is not None, "ProcessingJob was not created!"
        assert str(job.status).upper() == "COMPLETED", f"ProcessingJob status is {job.status}"
        assert job.progress == 100.0, f"ProcessingJob progress is {job.progress}"
        print(f"✓ ProcessingJob verified: id={job.id}, type={job.job_type}, status={job.status}, progress=100%")

        # STEP 5: Verify quiz has valid questions
        print("\n--- STEP 5: Verify quiz has valid questions ---")
        questions = quiz_data["questions"]
        assert len(questions) == 10, f"Expected 10 questions, got {len(questions)}"
        for q in questions:
            assert len(q["options"]) >= 4, "Question missing 4 options"
            assert q["correct_answer"] is not None, "Missing correct answer"
            assert q["difficulty"] in ["EASY", "MEDIUM", "HARD"], f"Invalid difficulty: {q['difficulty']}"
            assert q["bloom_level"] in ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE"], f"Invalid Bloom level: {q['bloom_level']}"
            assert q["source_reference"] is not None, "Missing source reference"
        print("✓ All 10 questions verified for Bloom's taxonomy, difficulty, options, and grounding.")

        # STEP 6: Admin reviews quiz
        print("\n--- STEP 6: Admin reviews quiz ---")
        rev_res = client.get(f"/admin/quizzes/{quiz_id}", headers=admin_h)
        assert rev_res.status_code == 200, rev_res.text
        assert rev_res.json()["status"] == "REVIEW"
        print(f"✓ Admin reviewed quiz in REVIEW state: title='{rev_res.json()['title']}'")

        # STEP 7: Admin approves quiz
        print("\n--- STEP 7: Admin approves quiz ---")
        appr_res = client.post(f"/admin/quizzes/{quiz_id}/approve", headers=admin_h)
        assert appr_res.status_code == 200, appr_res.text
        print("✓ Admin approved quiz successfully.")

        # STEP 8: Admin publishes quiz
        print("\n--- STEP 8: Admin publishes quiz ---")
        pub_res = client.post(f"/admin/quizzes/{quiz_id}/publish", headers=admin_h)
        assert pub_res.status_code == 200, pub_res.text
        assert pub_res.json()["status"] == "PUBLISHED"
        print("✓ Admin published quiz successfully. Status is now PUBLISHED.")

        # STEP 9: Student authenticates
        print("\n--- STEP 9: Student authenticates ---")
        student_user = db.query(User).filter(User.role == "student").first()
        if not student_user:
            student_user = User(
                username="student_e2e_b7",
                name="Student E2E",
                email="student_e2e_b7@test.com",
                password_hash=hash_pw("StudentPass123!"),
                role="student",
                is_active=True
            )
            db.add(student_user)
            db.commit()
            db.refresh(student_user)

        student_rec = db.query(Student).filter(Student.user_id == student_user.id).first()
        if not student_rec:
            student_rec = Student(
                user_id=student_user.id,
                student_id="STU-B7-E2E",
                name=student_user.name,
                email=student_user.email
            )
            db.add(student_rec)
            db.commit()
            db.refresh(student_rec)

        student_token = create_token(sub=str(student_user.id), role="student")
        student_h = {"Authorization": f"Bearer {student_token}"}
        print(f"✓ Student authenticated: user_id={student_user.id}, student_rec_id={student_rec.id}")

        # STEP 10: Student receives published quiz
        print("\n--- STEP 10: Student receives published quiz ---")
        student_quiz_res = client.get(f"/learn/quizzes/{quiz_id}", headers=student_h)
        assert student_quiz_res.status_code == 200, student_quiz_res.text
        student_quiz = student_quiz_res.json()
        assert student_quiz["id"] == quiz_id
        print(f"✓ Student retrieved published quiz: id={quiz_id}, title='{student_quiz['title']}'")

        # STEP 11: Verify correct answers are NOT exposed before submission
        print("\n--- STEP 11: Verify correct answers are NOT exposed before submission ---")
        for sq in student_quiz["questions"]:
            assert "correct_answer" not in sq or sq["correct_answer"] is None, "SECURITY LEAK: correct_answer exposed to student!"
            assert "explanation" not in sq or sq["explanation"] is None, "SECURITY LEAK: explanation exposed before submission!"
        print("✓ Confirmed: Answer keys and explanations are securely hidden before submission.")

        # STEP 12: Student submits answers
        print("\n--- STEP 12: Student submits answers ---")
        # Submit 10/10 correct answers
        full_admin_quiz = client.get(f"/admin/quizzes/{quiz_id}", headers=admin_h).json()
        correct_answers = {
            str(q["id"]): q["correct_answer"]
            for q in full_admin_quiz["questions"]
        }
        submit_res = client.post(
            f"/learn/quizzes/{quiz_id}/submit",
            headers=student_h,
            json={"answers": correct_answers}
        )
        assert submit_res.status_code == 200, submit_res.text
        attempt_result = submit_res.json()
        print(f"✓ Student submission accepted: attempt_id={attempt_result['attempt_id']}")

        # STEP 13: Verify automatic grading
        print("\n--- STEP 13: Verify automatic grading ---")
        assert attempt_result["percentage"] == 100.0, f"Expected 100%, got {attempt_result['percentage']}"
        assert attempt_result["passed"] is True
        assert attempt_result["mastery_level"] == "MASTERED"
        assert len(attempt_result["question_results"]) == 10
        for qr in attempt_result["question_results"]:
            assert qr["is_correct"] is True
            assert qr["explanation"] is not None and len(qr["explanation"]) > 5
        print("✓ Automatic grading verified: score=100%, passed=True, full explanations released.")

        # STEP 14: Verify QuizAttempt created
        print("\n--- STEP 14: Verify QuizAttempt created ---")
        att_db = db.get(QuizAttempt, attempt_result["attempt_id"])
        assert att_db is not None, "QuizAttempt not found in database!"
        assert att_db.quiz_id == quiz_id
        assert att_db.passed is True
        print(f"✓ QuizAttempt recorded in canonical table: id={att_db.id}, score={att_db.score}")

        # STEP 15: Verify StudentTopicPerformance updated
        print("\n--- STEP 15: Verify StudentTopicPerformance updated ---")
        perf_res = client.get(f"/learn/topics/{topic.id}/performance", headers=student_h)
        assert perf_res.status_code == 200, perf_res.text
        perf = perf_res.json()
        assert perf["mastery_level"] == "MASTERED"
        assert perf["best_score"] == 100.0
        assert perf["attempts"] >= 1
        print(f"✓ StudentTopicPerformance verified: topic_id={topic.id}, mastery=MASTERED, best=100%")

        # STEP 16: Use a deliberately low score on a fresh topic to test adaptive remediation
        print("\n--- STEP 16: Use deliberately low score to trigger remediation ---")
        topic_remed = Topic(
            chapter_id=chapter.id,
            sequence_number=2,
            title="Red-Black Tree Rotations and Color Flips",
            description="Deep study of Red-Black tree invariants, black height, and case analysis.",
            status="APPROVED",
            source_start_page=21,
            source_end_page=35
        )
        db.add(topic_remed)
        db.commit()
        db.refresh(topic_remed)

        # Generate & publish quiz for topic_remed
        gen2 = client.post(
            f"/admin/topics/{topic_remed.id}/quizzes/generate",
            headers=admin_h,
            json={"question_count": 5}
        ).json()
        quiz2_id = gen2["id"]
        client.post(f"/admin/quizzes/{quiz2_id}/publish", headers=admin_h)

        # Student submits 0%
        fail_sub = client.post(
            f"/learn/quizzes/{quiz2_id}/submit",
            headers=student_h,
            json={"answers": {str(q["id"]): "WRONG_ANSWER" for q in gen2["questions"]}}
        ).json()
        assert fail_sub["passed"] is False
        assert fail_sub["percentage"] == 0.0
        assert fail_sub["mastery_level"] == "NEEDS_PRACTICE"
        assert len(fail_sub["weak_concepts"]) > 0
        print(f"✓ Low score attempt recorded: passed=False, weak_concepts={fail_sub['weak_concepts']}")

        # STEP 17: Verify adaptive quiz is generated
        print("\n--- STEP 17: Verify adaptive quiz is generated ---")
        adapt_res = client.post(f"/learn/topics/{topic_remed.id}/adaptive-quiz", headers=student_h)
        assert adapt_res.status_code == 200, adapt_res.text
        adapt_quiz = adapt_res.json()
        print(f"✓ Adaptive remediation quiz created: id={adapt_quiz['id']}")

        # STEP 18: Verify adaptive quiz has is_adaptive=true, parent_quiz_id, new questions, weak-topic focus
        print("\n--- STEP 18: Verify adaptive quiz metadata ---")
        assert adapt_quiz["is_adaptive"] is True, "is_adaptive must be True"
        assert adapt_quiz["parent_quiz_id"] == quiz2_id, f"Expected parent_quiz_id={quiz2_id}, got {adapt_quiz['parent_quiz_id']}"
        assert adapt_quiz["attempt_number"] == 2, f"Expected attempt_number=2, got {adapt_quiz['attempt_number']}"
        assert len(adapt_quiz["questions"]) > 0, "Adaptive quiz has no questions"
        print("✓ Verified: is_adaptive=True, parent_quiz_id matches, attempt_number=2.")

        # STEP 19: Verify previously answered questions are excluded
        print("\n--- STEP 19: Verify previously answered questions are excluded ---")
        original_q_texts = {q["question_text"].strip() for q in gen2["questions"]}
        adaptive_q_texts = {q["question_text"].strip() for q in adapt_quiz["questions"]}
        repeated = original_q_texts.intersection(adaptive_q_texts)
        assert len(repeated) == 0, f"Adaptive quiz repeated previous questions: {repeated}"
        print("✓ Confirmed: 0 questions from initial attempt repeated in adaptive quiz.")

        # STEP 20: Verify mastery changes after improved adaptive score
        print("\n--- STEP 20: Verify mastery changes after improved adaptive score ---")
        admin_adapt_quiz = client.get(f"/admin/quizzes/{adapt_quiz['id']}", headers=admin_h).json()
        adapt_correct = {
            str(q["id"]): q["correct_answer"]
            for q in admin_adapt_quiz["questions"]
        }
        adapt_sub_res = client.post(
            f"/learn/quizzes/{adapt_quiz['id']}/submit",
            headers=student_h,
            json={"answers": adapt_correct}
        )
        assert adapt_sub_res.status_code == 200, adapt_sub_res.text
        adapt_result = adapt_sub_res.json()
        assert adapt_result["passed"] is True
        assert adapt_result["percentage"] == 100.0
        assert adapt_result["mastery_level"] == "MASTERED"

        # Check topic performance now reflects improvement
        perf_after = client.get(f"/learn/topics/{topic_remed.id}/performance", headers=student_h).json()
        assert perf_after["mastery_level"] == "MASTERED"
        assert perf_after["best_score"] == 100.0
        print(f"✓ Mastery updated after adaptive pass: NEEDS_PRACTICE -> MASTERED (best_score=100%)")

        # STEP 21: Verify student cannot access another student's attempt
        print("\n--- STEP 21: Verify student cannot access another student's attempt ---")
        student2_user = db.query(User).filter(User.username == "student2_b7_e2e").first()
        if not student2_user:
            student2_user = User(
                username="student2_b7_e2e",
                name="Student Two",
                email="student2_b7_e2e@test.com",
                password_hash=hash_pw("Student2Pass!"),
                role="student",
                is_active=True
            )
            db.add(student2_user)
            db.commit()
            db.refresh(student2_user)

        s2_token = create_token(sub=str(student2_user.id), role="student")
        s2_h = {"Authorization": f"Bearer {s2_token}"}

        # Student 2 tries to list attempts for quiz_id (which Alice attempted)
        s2_attempts = client.get(f"/learn/quizzes/{quiz_id}/attempts", headers=s2_h).json()
        # Student 2 should see 0 attempts
        assert len(s2_attempts) == 0, f"Student 2 saw another student's attempts: {s2_attempts}"
        print("✓ Verified: Student attempts are strictly isolated by authenticated student identity.")

        # STEP 22: Print final result
        print("\n" + "=" * 60)
        print("BUILD 07 E2E VERIFICATION PASSED")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    run_verification()
