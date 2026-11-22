import os
import io
import json
import pytest
from unittest.mock import MagicMock

from app.models.models import Video, VideoScriptVersion, ProcessingJob
from app.services.script_generation import (
    ScriptService,
    GeminiScriptGenerationEngine,
    DeterministicScriptGenerationEngine,
    get_script_generation_engine
)
from app.services.google_ai_client import (
    GoogleAIClient,
    AIProviderUnavailableError,
    GeminiGenerationError,
    GeminiLessonScript,
    GeminiSceneDefinition
)
from app.services.pipeline_service import run_stages_1_to_5
from tests.test_security_and_failures import make_auth_header


def make_mock_gemini_response(narration_style: str = "teacher", formula: str = "F = ma"):
    """Helper creating realistic, grounded GeminiLessonScript structured JSON matching target word budget."""
    if narration_style == "conversation":
        sections = [
            GeminiSceneDefinition(
                scene_number=1,
                section_type="INTRO",
                title="Curious Questions: What Causes Acceleration?",
                narration=(
                    "Welcome back to our physics masterclass. Today we dive into one of the most foundational concepts "
                    "in classical mechanics: Newton's second law of motion and the dynamics of force and linear momentum. "
                    "In our previous discussions on inertia, we learned that objects resist changes in their motion. "
                    "Now, we ask the deeper question: what happens when an unbalanced net external force is applied? "
                    "How does that force change the velocity of an object over time, and what role does its mass play? "
                    "Let's explore this together."
                ),
                speaker="Teacher",
                visual_type="TITLE_CARD",
                visual_description="Title card showing 'Newton's Second Law of Motion' with chalkboard illustration.",
                on_screen_text="Newton's Second Law of Motion\nDynamics of Force and Linear Momentum",
                formula=formula,
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=2,
                section_type="CONCEPT",
                title="Student Clarification: Force vs Mass",
                narration=(
                    "Wait, Dr. Alex, let me make sure I understand the intuition here. If I go to the supermarket and push "
                    "an empty shopping cart with a brisk shove, it accelerates forward very quickly. But if that exact same cart "
                    "is completely loaded with heavy groceries and I push it with the exact same muscular effort, it barely accelerates "
                    "at all. Why does mass have such a dramatic dampening effect on how much speed an object gains from a force?"
                ),
                speaker="Student",
                visual_type="DIAGRAM",
                visual_description="Two shopping carts of different masses being pushed by identical force vectors.",
                on_screen_text="Same Applied Force, Different Inertial Mass → Different Acceleration",
                formula=None,
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=3,
                section_type="DETAILED_EXPLANATION",
                title="Teacher Explanation: The Fundamental Law",
                narration=(
                    "That is precisely the core physical insight captured in Chapter 3 of our textbook! "
                    "Newton discovered that the acceleration of any object is directly proportional to the net external force acting on it, "
                    "and inversely proportional to its inertial mass. In the empty cart, the small mass means each Newton of force produces "
                    "a large acceleration. But with the loaded cart, the larger mass resists the change in velocity more vigorously. "
                    "Mathematically, acceleration equals net force divided by mass, which we rearrange into the famous equation F equals m a."
                ),
                speaker="Teacher",
                visual_type="FORMULA_CARD",
                visual_description="Derivation card showing acceleration equals force divided by mass, rearranging to F = ma.",
                on_screen_text="a = F_net / m\nF_net = m · a\nDirectly Proportional to Force, Inversely to Mass",
                formula=formula,
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=4,
                section_type="EXAMPLE",
                title="Student Question: Measuring Units & Linear Momentum",
                narration=(
                    "That makes so much sense visually! But when we work with numbers in physics exercises, what units do we use? "
                    "The textbook mentions that force is proportional to the rate of change of linear momentum, and that force is measured in Newtons. "
                    "How do we break one Newton down into the standard SI base units of kilograms, meters, and seconds so we avoid calculation errors?"
                ),
                speaker="Student",
                visual_type="DIAGRAM",
                visual_description="Breakdown of SI unit: 1 Newton = 1 kg * m/s^2.",
                on_screen_text="1 Newton = 1 kg · m/s²\nForce = dp / dt = d(mv) / dt",
                formula="1 N = 1 kg * m / s^2",
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=5,
                section_type="WORKED_EXAMPLE",
                title="Worked Calculation: Rocket Thrust and Acceleration",
                narration=(
                    "Excellent question! Let's solve a concrete numerical problem together. "
                    "One Newton is defined as the force required to accelerate a one-kilogram mass at one meter per second squared. "
                    "Now imagine a small research probe with a mass of 500 kilograms floating in deep space. "
                    "Its ion thruster ignites and provides a steady forward thrust of 5000 Newtons. "
                    "Using F equals m times a, we rearrange to find acceleration: a equals 5000 Newtons divided by 500 kilograms. "
                    "The kilograms cancel, giving an exact acceleration of 10 meters per second squared. "
                    "Every single second the engine burns, the probe's speed increases by ten meters per second."
                ),
                speaker="Teacher",
                visual_type="DIAGRAM",
                visual_description="Step by step calculation card for rocket probe acceleration.",
                on_screen_text="Given: m = 500 kg, F = 5000 N\na = F / m = 5000 N / 500 kg = 10 m/s²\nSpeed increases by 10 m/s every second",
                formula="a = F / m",
                source_pages=[8],
                example_origin="textbook_direct"
            ),
            GeminiSceneDefinition(
                scene_number=6,
                section_type="APPLICATION",
                title="Real-World Application: Automotive Braking and Safety",
                narration=(
                    "Now consider where this principle saves human lives every day: automotive safety and emergency braking systems. "
                    "When a 1500-kilogram vehicle travels at highway speed, stopping it requires a large decelerating force from the disc brakes. "
                    "According to Newton's second law, if the road is wet and tire friction provides only half the normal braking force, "
                    "the resulting deceleration drops by half, and the stopping distance doubles! "
                    "Automotive engineers use F equals m a to design anti-lock braking systems, seatbelt pre-tensioners, and crumple zones."
                ),
                speaker="Teacher",
                visual_type="APPLICATION_CARD",
                visual_description="Diagram of an automobile applying friction brakes with negative acceleration vectors.",
                on_screen_text="Automotive Safety: Mass, Braking Force, and Stopping Distance\nABS Systems & Crumple Zones",
                formula=formula,
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=7,
                section_type="SUMMARY",
                title="Recap and Knowledge Check",
                narration=(
                    "Let's recap what we mastered today in this lesson on Newton's second law and linear momentum. "
                    "First, net external force is what drives changes in velocity. "
                    "Second, acceleration is directly proportional to that net force, but inversely proportional to the object's mass. "
                    "Third, always remember to verify your units in SI base quantities: kilograms for mass, meters per second squared for acceleration. "
                    "Before taking our lesson quiz, think about this check: if you double the net force on an object and double its mass simultaneously, "
                    "what happens to its acceleration? It remains exactly unchanged! Great work today."
                ),
                speaker="Teacher",
                visual_type="KNOWLEDGE_CHECK",
                visual_description="Recap card with core takeaways and multiple-choice conceptual check.",
                on_screen_text="Summary Takeaways:\n• F_net = m · a\n• SI Unit: 1 N = 1 kg·m/s²\n• If F doubles and m doubles, acceleration stays constant",
                formula=formula,
                source_pages=[8]
            ),
        ]
    else:
        sections = [
            GeminiSceneDefinition(
                scene_number=1,
                section_type="INTRO",
                title="Introduction to Dynamics and Force",
                narration=(
                    "Welcome to our physics lecture on classical mechanics. Today we investigate Newton's second law of motion, "
                    "which forms the bedrock of Newtonian mechanics and explains the physical dynamics of force and linear momentum. "
                    "In earlier chapters we studied kinematics, describing how objects move through distance, speed, and acceleration. "
                    "Today we advance into dynamics, investigating why objects accelerate and how external forces dictate that motion. "
                    "By grounding our study in the textbook's core principles, we will build both intuitive understanding and mathematical precision."
                ),
                speaker="Teacher",
                visual_type="TITLE_CARD",
                visual_description="Clean title card showing topic title and educational context.",
                on_screen_text="Newton's Second Law: Dynamics of Force and Acceleration",
                formula=formula,
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=2,
                section_type="OBJECTIVE",
                title="Learning Objectives",
                narration=(
                    "By the end of this instructional video, you will be able to clearly define net external force and linear momentum. "
                    "You will understand why acceleration is directly proportional to applied force and inversely proportional to inertial mass. "
                    "Furthermore, you will be able to manipulate and apply the equation F equals m a to solve quantitative physics problems, "
                    "and connect these mathematical concepts to real-world engineering and safety applications."
                ),
                speaker="Teacher",
                visual_type="SUMMARY_CHIPS",
                visual_description="List of primary learning outcomes.",
                on_screen_text="Learning Objectives:\n1. Define Net Force and Inertial Mass\n2. Master F = m · a\n3. Solve Quantitative Acceleration Problems\n4. Connect to Real-World Dynamics",
                formula=None,
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=3,
                section_type="CONCEPT",
                title="Core Principles of Force and Mass",
                narration=(
                    "Let us begin with the core principle laid out in Chapter 3 of the textbook. "
                    "Newton established that whenever an object experiences an unbalanced net external force, it must accelerate in the direction of that force. "
                    "The magnitude of this acceleration depends strictly on two factors: the strength of the net force and the mass of the object. "
                    "Mass represents an object's inertia, which is its natural resistance to any change in its velocity. "
                    "Therefore, if you apply the same force to two bodies of differing mass, the heavier body experiences a smaller acceleration."
                ),
                speaker="Teacher",
                visual_type="DIAGRAM",
                visual_description="Free body diagram with opposing force vectors.",
                on_screen_text="Net Force = Vector Sum of All Applied Forces\nInertial Mass Resists Acceleration",
                formula=formula,
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=4,
                section_type="FORMULA",
                title="The Mathematical Formulation: F = ma",
                narration=(
                    "Mathematically, Newton formulated this relationship in terms of linear momentum change, which simplifies to the famous formula: "
                    "net force equals mass multiplied by acceleration, written as F equals m a. "
                    "Here, force F is expressed in Newtons, mass m is measured in kilograms, and acceleration a is measured in meters per second squared. "
                    "One Newton is precisely the force required to accelerate a one-kilogram mass at one meter per second squared. "
                    "Notice that acceleration equals force divided by mass: double the force, double the acceleration; double the mass, cut acceleration in half."
                ),
                speaker="Teacher",
                visual_type="FORMULA_CARD",
                visual_description="Formula card highlighting force, mass, and acceleration variables and units.",
                on_screen_text="F = m · a\na = F / m\nForce (N) = Mass (kg) × Acceleration (m/s²)\n1 N = 1 kg · m/s²",
                formula=formula,
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=5,
                section_type="EXAMPLE",
                title="Worked Example: Rocket Propulsion Calculation",
                narration=(
                    "Let us now work through a concrete numerical example. "
                    "Suppose an experimental satellite of mass 500 kilograms is deployed into orbit. "
                    "Its propulsion thruster fires, exerting a constant forward force of 5000 Newtons. "
                    "What is the satellite's acceleration during this burn? "
                    "We start with our governing equation: F equals m times a. "
                    "Rearranging for acceleration yields a equals F divided by m. "
                    "Substituting our given values gives 5000 Newtons divided by 500 kilograms, resulting in exactly 10 meters per second squared. "
                    "This demonstrates how straightforward Newton's second law is when working in standard SI units."
                ),
                speaker="Teacher",
                visual_type="DIAGRAM",
                visual_description="Step by step calculation card for satellite thrust.",
                on_screen_text="Given:\nMass m = 500 kg\nForce F = 5000 N\n\nCalculation:\na = F / m = 5000 N / 500 kg = 10 m/s²",
                formula="a = F / m",
                source_pages=[8],
                example_origin="textbook_direct"
            ),
            GeminiSceneDefinition(
                scene_number=6,
                section_type="APPLICATION",
                title="Practical Engineering Applications",
                narration=(
                    "Beyond theoretical calculations, Newton's second law is the cornerstone of modern mechanical and aerospace engineering. "
                    "Engineers use F equals m a to calculate the required thrust for commercial aircraft takeoffs, design counterweights and safety cables for high-rise elevators, "
                    "and optimize crumple zones in automobiles to dissipate kinetic energy during a collision. "
                    "By lengthening the duration of an impact, the deceleration is minimized, drastically reducing the destructive force experienced by passengers."
                ),
                speaker="Teacher",
                visual_type="APPLICATION_CARD",
                visual_description="Real-world engineering applications.",
                on_screen_text="Engineering Applications:\n• Aerospace Propulsion & Thrust\n• High-Rise Elevator Cable Systems\n• Automotive Impact Mitigation & Crumple Zones",
                formula=None,
                source_pages=[8]
            ),
            GeminiSceneDefinition(
                scene_number=7,
                section_type="SUMMARY",
                title="Summary and Knowledge Check",
                narration=(
                    "To summarize our key takeaways from today's lesson: "
                    "First, unbalanced external forces cause acceleration in the direction of the net force vector. "
                    "Second, the relationship is quantitatively governed by F equals m a, connecting force in Newtons with mass in kilograms and acceleration in meters per second squared. "
                    "Third, linear momentum and mass determine how stubbornly an object resists velocity changes. "
                    "Review these textbook derivations on Laws of Motion carefully before taking the topic assessment. Outstanding focus today."
                ),
                speaker="Teacher",
                visual_type="KNOWLEDGE_CHECK",
                visual_description="Recap chips with final check.",
                on_screen_text="Summary Takeaways:\n• Net force determines acceleration: F_net = m · a\n• Units: 1 N = 1 kg · m/s²\n• Mastered textbook principles for Laws of Motion",
                formula=formula,
                source_pages=[8]
            ),
        ]

    script = GeminiLessonScript(
        title="Newton's Second Law of Motion",
        narration_style=narration_style,
        learning_objective="Understand, apply, and calculate Newton's Second Law of Motion",
        target_words=len(" ".join(s.narration for s in sections).split()),
        estimated_duration_seconds=330,
        sections=sections,
        pedagogical_summary="Grounded in textbook chapters on force and dynamics."
    )
    mock_resp = MagicMock()
    mock_resp.text = script.model_dump_json()
    return mock_resp


@pytest.fixture
def test_video_with_source(client, db_session):
    """Sets up an approved textbook with extracted pages and an approved video plan."""
    admin_headers = make_auth_header(1, "admin")

    pdf_content = (
        b"%PDF-1.4\n"
        b"Chapter 1: Newton Dynamics\n"
        b"Topic 1.1: Force and Acceleration\n"
        b"According to Newton's Second Law, the acceleration of an object is directly proportional "
        b"to the net force and inversely proportional to its mass: F = ma. Force is measured in Newtons.\n"
        b"%%EOF"
    )
    res_upload = client.post(
        "/admin/textbooks",
        headers=admin_headers,
        data={"title": "Newton Dynamics Textbook", "subject_id": 1},
        files={"file": ("newton_dyn.pdf", io.BytesIO(pdf_content), "application/pdf")}
    )
    assert res_upload.status_code == 201
    tb_id = res_upload.json()["id"]

    client.post(f"/admin/textbooks/{tb_id}/pipeline", headers=admin_headers)
    run_stages_1_to_5(db_session, tb_id)
    client.post(f"/admin/textbooks/{tb_id}/approve", headers=admin_headers)

    res_plans = client.get(f"/admin/video-plans?textbook_id={tb_id}", headers=admin_headers)
    assert res_plans.status_code == 200
    plans = res_plans.json()
    assert len(plans) > 0
    newton_plans = [
        p for p in plans
        if any(term in (p.get("title") or "").lower() for term in ["newton", "force", "motion", "inertia", "linear momentum", "second law"])
    ]
    selected_plan = newton_plans[0] if newton_plans else plans[0]
    video_id = selected_plan["id"]

    v = db_session.get(Video, video_id)
    v.estimated_duration_seconds = 300
    v.duration_seconds = 300
    v.learning_objective = "Understand and calculate Newton's second law of motion, force, mass, acceleration, and linear momentum"
    db_session.commit()

    # Approve plan
    client.post(f"/admin/video-plans/{video_id}/approve", headers=admin_headers)
    return video_id, admin_headers


# ==============================================================================
# TEST 1: Successful Gemini Teacher Script Generation
# ==============================================================================
def test_01_gemini_teacher_script_generation(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = make_mock_gemini_response("teacher")
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "narration_style": "teacher", "force_regenerate": True}
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["generation_engine"] == "gemini"
        assert data["narration_style"] == "teacher"
        assert len(data["sections"]) >= 6
        assert all(s.get("speaker") == "Teacher" for s in data["sections"])
        assert data["quality_score"] >= 80.0
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 2: Successful Gemini Conversation Script Generation
# ==============================================================================
def test_02_gemini_conversation_script_generation(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = make_mock_gemini_response("conversation")
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "narration_style": "conversation", "force_regenerate": True}
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["generation_engine"] == "gemini"
        assert data["narration_style"] == "conversation"
        speakers = {s.get("speaker") for s in data["sections"]}
        assert "Teacher" in speakers
        assert "Student" in speakers
        assert any("?" in s["narration"] for s in data["sections"])
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 3: Textbook Source Grounding
# ==============================================================================
def test_03_gemini_textbook_source_grounding(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = make_mock_gemini_response("teacher")
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        assert res.status_code == 200
        call_args = mock_client.models.generate_content.call_args
        contents = call_args.kwargs.get("contents") or call_args[1].get("contents", "")
        # Grounding check: textbook text was passed in prompt
        assert "Newton" in contents or "Force" in contents
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 4: Source Page References
# ==============================================================================
def test_04_gemini_source_page_references(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = make_mock_gemini_response("teacher")
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        assert res.status_code == 200
        data = res.json()
        for s in data["sections"]:
            assert isinstance(s["source_pages"], list)
            assert len(s["source_pages"]) > 0
            assert all(isinstance(p, int) for p in s["source_pages"])
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 5: Formula Preservation
# ==============================================================================
def test_05_gemini_formula_preservation(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = make_mock_gemini_response("teacher", formula="F = ma")
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        assert res.status_code == 200
        data = res.json()
        formulas = [s.get("formula") for s in data["sections"] if s.get("formula")]
        assert any("F = ma" in f for f in formulas)
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 6: Invalid Structured Output Recovery
# ==============================================================================
def test_06_gemini_invalid_structured_output(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_bad_resp = MagicMock()
    mock_bad_resp.text = '{"malformed": "not a valid script JSON'
    mock_client.models.generate_content.return_value = mock_bad_resp
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        # Should raise 502 or 500 when Gemini returns invalid schema
        assert res.status_code in [500, 502]
        assert "Gemini" in res.json()["detail"] or "validation" in res.json()["detail"].lower()
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 7: Missing Credentials Handling
# ==============================================================================
def test_07_gemini_missing_credentials(client, db_session, monkeypatch, test_video_with_source):
    video_id, admin_headers = test_video_with_source
    GoogleAIClient.reset_mock_client()

    # Clear environment credentials
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_CLOUD_PROJECT", raising=False)

    from app.core.config import settings
    monkeypatch.setattr(settings, "gemini_api_key", None)
    monkeypatch.setattr(settings, "google_cloud_project", None)

    res = client.post(
        f"/admin/video-plans/{video_id}/script/generate",
        headers=admin_headers,
        json={"engine": "gemini", "force_regenerate": True}
    )
    assert res.status_code == 503
    assert "credentials not configured" in res.json()["detail"]


# ==============================================================================
# TEST 8: Gemini Timeout Handling
# ==============================================================================
def test_08_gemini_timeout_handling(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = TimeoutError("Gemini request timed out after 60s")
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        assert res.status_code in [500, 502]
        assert "timed out" in res.json()["detail"].lower() or "failed" in res.json()["detail"].lower()
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 9: Gemini API Error Handling
# ==============================================================================
def test_09_gemini_api_error_handling(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = RuntimeError("ResourceExhausted: Quota exceeded for model")
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        assert res.status_code in [500, 502]
        assert "Quota" in res.json()["detail"] or "ResourceExhausted" in res.json()["detail"]
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 10: Script Versioning
# ==============================================================================
def test_10_gemini_script_versioning(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = make_mock_gemini_response("teacher")
    GoogleAIClient.set_mock_client(mock_client)

    try:
        # Generate version 1
        res1 = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        assert res1.status_code == 200
        ver1 = res1.json()["version_number"]

        # Generate version 2 with force_regenerate
        res2 = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        assert res2.status_code == 200
        ver2 = res2.json()["version_number"]
        assert ver2 == ver1 + 1

        versions = db_session.query(VideoScriptVersion).filter(
            VideoScriptVersion.video_id == video_id
        ).all()
        assert len(versions) >= 2
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 11: Script Approval Compatibility
# ==============================================================================
def test_11_gemini_script_approval_compatibility(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = make_mock_gemini_response("teacher")
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res_gen = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        assert res_gen.status_code == 200

        res_appr = client.post(f"/admin/scripts/{video_id}/approve", headers=admin_headers)
        assert res_appr.status_code == 200
        assert res_appr.json()["script_status"] == "SCRIPT_APPROVED"

        v = db_session.get(Video, video_id)
        assert v.script_status == "SCRIPT_APPROVED"
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 12: Existing Offline Test Compatibility
# ==============================================================================
def test_12_existing_offline_test_compatibility(client, db_session, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    # Explicit offline deterministic mode
    res = client.post(
        f"/admin/video-plans/{video_id}/script/generate",
        headers=admin_headers,
        json={"engine": "deterministic", "force_regenerate": True}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["generation_engine"] == "deterministic"
    assert len(data["sections"]) >= 4


# ==============================================================================
# TEST 13: Example Origin Attribution and Page Grounding
# ==============================================================================
def test_13_example_origin_attribution_and_page_grounding(client, test_video_with_source):
    video_id, admin_headers = test_video_with_source

    mock_client = MagicMock()
    mock_sections = [
        GeminiSceneDefinition(
            scene_number=1,
            section_type="INTRO",
            title="Introduction to Dynamics",
            narration="Welcome to our physics lecture on classical mechanics. Today we investigate Newton's second law of motion.",
            speaker="Teacher",
            visual_type="TITLE_CARD",
            visual_description="Title card",
            on_screen_text="Newton's Second Law",
            source_pages=[],  # empty on purpose to verify no unsafe fallback to [start_p]
            example_origin=None
        ),
        GeminiSceneDefinition(
            scene_number=2,
            section_type="EXAMPLE",
            title="Creative Analogy: Shopping Cart",
            narration="Think of pushing a shopping cart through grocery aisles as an analogy for how mass resists acceleration.",
            speaker="Teacher",
            visual_type="DIAGRAM",
            visual_description="Shopping cart diagram",
            on_screen_text="Analogy: Shopping Cart",
            source_pages=[8],  # model mistakenly cited page 8
            example_origin="generative_analogy"
        ),
        GeminiSceneDefinition(
            scene_number=3,
            section_type="APPLICATION",
            title="Creative Application: Electric Vehicle Regenerative Braking",
            narration="Modern electric cars use inverter torque control to apply precise braking forces according to Newton's laws.",
            speaker="Teacher",
            visual_type="APPLICATION_CARD",
            visual_description="EV braking diagram",
            on_screen_text="EV Inverter Braking",
            source_pages=[8],  # model mistakenly cited page 8
            example_origin="generative_application"
        ),
        GeminiSceneDefinition(
            scene_number=4,
            section_type="WORKED_EXAMPLE",
            title="Textbook Problem: Probe Acceleration",
            narration="Solving the numerical example directly from the textbook: 5000 Newtons divided by 500 kilograms equals 10 m/s^2.",
            speaker="Teacher",
            visual_type="DIAGRAM",
            visual_description="Calculation card",
            on_screen_text="a = 5000 N / 500 kg = 10 m/s²",
            source_pages=[8],  # valid textbook page
            example_origin="textbook_direct"
        ),
        GeminiSceneDefinition(
            scene_number=5,
            section_type="SUMMARY",
            title="Summary & Recap",
            narration="To summarize: net force drives acceleration, mass resists it, and units must be strictly verified.",
            speaker="Teacher",
            visual_type="SUMMARY_CHIPS",
            visual_description="Recap chips",
            on_screen_text="F = ma Summary",
            source_pages=[8],
            example_origin=None
        ),
        GeminiSceneDefinition(
            scene_number=6,
            section_type="CLOSING",
            title="Closing Assessment",
            narration="Review these textbook derivations on Laws of Motion carefully before taking the topic assessment. Outstanding focus today.",
            speaker="Teacher",
            visual_type="KNOWLEDGE_CHECK",
            visual_description="Closing check",
            on_screen_text="Ready for Assessment",
            source_pages=[8],
            example_origin=None
        )
    ]

    mock_script = GeminiLessonScript(
        title="Newton's Second Law of Motion",
        narration_style="teacher",
        learning_objective="Understand Newton's Second Law",
        target_words=200,
        sections=mock_sections,
        pedagogical_summary="Grounded in textbook with creative analogies attributed."
    )
    mock_resp = MagicMock()
    mock_resp.text = mock_script.model_dump_json()
    mock_client.models.generate_content.return_value = mock_resp
    GoogleAIClient.set_mock_client(mock_client)

    try:
        res = client.post(
            f"/admin/video-plans/{video_id}/script/generate",
            headers=admin_headers,
            json={"engine": "gemini", "force_regenerate": True}
        )
        assert res.status_code == 200
        sections = res.json()["sections"]

        # Scene 1: Non-example with empty source_pages should remain empty (unsafe [start_p] fallback removed)
        assert sections[0]["source_pages"] == []
        assert sections[0]["example_origin"] is None

        # Scene 2: generative_analogy must have empty source_pages ([]), even if Gemini returned [8]
        assert sections[1]["example_origin"] == "generative_analogy"
        assert sections[1]["source_pages"] == []

        # Scene 3: generative_application must have empty source_pages ([]), even if Gemini returned [8]
        assert sections[2]["example_origin"] == "generative_application"
        assert sections[2]["source_pages"] == []

        # Scene 4: textbook_direct must preserve valid source_pages [8]
        assert sections[3]["example_origin"] == "textbook_direct"
        assert sections[3]["source_pages"] == [8]
    finally:
        GoogleAIClient.reset_mock_client()


# ==============================================================================
# TEST 14: Backward Compatibility with Old Script Schemas
# ==============================================================================
def test_14_backward_compatibility_old_script_schemas():
    from app.schemas.schemas import ScriptSection

    # 1. Old script section without example_origin field
    old_section_data = {
        "section_id": 1,
        "type": "CONCEPT",
        "title": "Core Concept: Newton's Second Law",
        "narration": "Net force causes acceleration proportional to magnitude and inversely to mass.",
        "source_pages": [8],
        "visual_type": "DIAGRAM"
    }
    sec = ScriptSection.model_validate(old_section_data)
    assert sec.example_origin is None
    assert sec.section_id == 1
    assert sec.source_pages == [8]

    # 2. New script section with explicit example_origin values
    for origin in ["textbook_direct", "generative_analogy", "generative_application"]:
        new_data = {
            "section_id": 2,
            "type": "EXAMPLE",
            "title": "Example Scene",
            "narration": "This is an example narration.",
            "source_pages": [8] if origin == "textbook_direct" else [],
            "visual_type": "DIAGRAM",
            "example_origin": origin
        }
        sec_new = ScriptSection.model_validate(new_data)
        assert sec_new.example_origin == origin


# ==============================================================================
# TEST 15: Dynamic Database Protection Fails Closed on Deletion
# ==============================================================================
def test_15_test_cleanup_dynamic_db_fail_closed(monkeypatch, tmp_path):
    from tests.conftest import is_safe_to_delete_test_artifact, is_referenced_in_live_app_db, ALLOWED_TEST_DIRS

    # Create a test candidate in an allowed test directory
    allowed_dir = ALLOWED_TEST_DIRS[0]
    candidate = os.path.join(allowed_dir, "0123456789abcdef0123456789abcdef_temp_probe.pdf")

    # 1. When DB query raises an unexpected database/network error, fail closed
    def mock_broken_session():
        raise RuntimeError("Database connection suddenly dropped or locked")

    monkeypatch.setattr("tests.conftest.SessionLocal", mock_broken_session)

    # is_referenced_in_live_app_db must fail closed (return True, meaning protected)
    assert is_referenced_in_live_app_db(candidate) is True
    # is_safe_to_delete_test_artifact must return False (refuse deletion)
    assert is_safe_to_delete_test_artifact(candidate) is False
