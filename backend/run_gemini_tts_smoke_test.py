"""
Phase 2B-1: Live Google Gemini TTS Smoke Test

Performs a genuine live API request using Gemini 3.8 Flash TTS on the
Gemini Enterprise Agent Platform with Application Default Credentials (ADC).

STRICT VERIFICATION RULES:
- Never substitutes mocks, synthetic audio, Edge TTS, or deterministic test tones.
- If Google Cloud Project or ADC is missing, reports BLOCKED with clear actionable errors.
- Never prints or exposes credentials.
"""

import os
import sys
import time
import wave
import json
from pathlib import Path

# Add backend directory to path
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.services.video_rendering import (
    GoogleGeminiTTSProvider,
    TTSProviderUnavailableError,
    TTSResult
)


def run_gemini_tts_smoke_test():
    print("=" * 80)
    print("VEYORALABS — PHASE 2B-1: GOOGLE GEMINI TTS LIVE SMOKE TEST")
    print("=" * 80)

    # 1. Inspect Environment & Diagnostics
    project = getattr(settings, "google_cloud_project", None) or os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = getattr(settings, "google_cloud_location", None) or os.environ.get("GOOGLE_CLOUD_LOCATION") or "global"
    model = getattr(settings, "gemini_tts_model", "gemini-3.8-flash-tts")
    use_enterprise = getattr(settings, "google_genai_use_enterprise", True)

    print(f"\n[1] Environment & Configuration:")
    print(f"  • Model: {model}")
    print(f"  • Enterprise Mode: {use_enterprise}")
    print(f"  • Location: {location}")
    print(f"  • Configured Project: {project or '<UNCONFIGURED>'}")

    # Check ADC
    adc_present = False
    adc_error_detail = None
    try:
        import google.auth
        creds, detected_proj = google.auth.default()
        adc_present = True
        print(f"  • ADC Detected: Yes (Project: {detected_proj or 'none'})")
    except Exception as e:
        adc_error_detail = str(e)
        print(f"  • ADC Detected: No ({e})")

    # 2. Configuration Validation
    is_ready, validation_msg, diag_code = GoogleGeminiTTSProvider.validate_configuration()
    if not is_ready:
        print(f"\n[2] Authentication Diagnostic Result: BLOCKED")
        print(f"  • Diagnostic Code: {diag_code}")
        print(f"  • Actionable Detail: {validation_msg}")
        print("\n" + "=" * 80)
        print("STATUS: BLOCKED — Live Gemini TTS requires Google Cloud credentials.")
        print("To unblock live Gemini 3.8 TTS requests, please configure:")
        print("  1. export GOOGLE_CLOUD_PROJECT='your-google-cloud-project-id'")
        print("  2. export GOOGLE_APPLICATION_CREDENTIALS='/path/to/vertex-ai-key.json'")
        print("     or run: gcloud auth application-default login")
        print("  3. Ensure Vertex AI API (aiplatform.googleapis.com) is enabled.")
        print("  4. Ensure IAM role 'roles/aiplatform.user' is granted.")
        print("=" * 80)
        return {
            "status": "BLOCKED",
            "diagnostic_code": diag_code,
            "message": validation_msg,
            "project_configured": bool(project),
            "adc_present": adc_present
        }

    # 3. If ready, execute genuine live smoke test
    print(f"\n[2] Executing Live Smoke Test against {model}...")
    output_dir = PROJECT_ROOT / "uploads" / "tests" / "gemini_tts"
    output_dir.mkdir(parents=True, exist_ok=True)

    provider = GoogleGeminiTTSProvider(
        model=model,
        location=location,
        project=project,
        teacher_voice="Aoede",
        student_voice="Puck"
    )

    # Test 1: Single Teacher Narration
    teacher_phrase = "Welcome to today's physics lesson. Let us understand Newton's laws of motion."
    print(f"\n  [Test 1] Generating Single-Teacher Narration (Voice: Aoede)...")
    t0 = time.time()
    try:
        teacher_result: TTSResult = provider.synthesize(
            teacher_phrase,
            {"speaker": "Teacher", "voice": "Aoede"}
        )
        t_dur = time.time() - t0
        print(f"  ✓ Narration generated in {t_dur:.2f}s (Audio Duration: {teacher_result.duration_seconds:.2f}s)")

        # Validate WAV integrity
        wav_path_teacher = output_dir / "live_teacher_narration.wav"
        with open(wav_path_teacher, "wb") as f:
            f.write(teacher_result.audio_bytes)

        with wave.open(str(wav_path_teacher), "rb") as wf:
            assert wf.getframerate() == 44100
            assert wf.getnchannels() == 1
            assert wf.getsampwidth() == 2
            n_frames = wf.getnframes()
            calc_dur = round(n_frames / 44100.0, 2)
        print(f"  ✓ WAV integrity validated: 44.1 kHz 16-bit mono, frames={n_frames}, file={wav_path_teacher.name}")
    except TTSProviderUnavailableError as e:
        print(f"  ✗ Live teacher narration failed: {e}")
        return {"status": "FAIL", "test": "teacher_narration", "error": str(e)}

    # Test 2: Two-Speaker Conversation
    dialogue_prompt = (
        "Teacher: Welcome to today's physics lesson. Let us understand Newton's laws of motion.\n"
        "Student: Does the first law mean an object in motion stays in motion?\n"
        "Teacher: Exactly right! Unless acted upon by an external net force."
    )
    print(f"\n  [Test 2] Generating Two-Speaker Dialogue (Teacher: Aoede, Student: Puck)...")
    t0 = time.time()
    try:
        dialogue_result: TTSResult = provider.synthesize_multi_speaker(
            dialogue_prompt=dialogue_prompt,
            teacher_voice="Aoede",
            student_voice="Puck"
        )
        d_dur = time.time() - t0
        print(f"  ✓ Dialogue generated in {d_dur:.2f}s (Audio Duration: {dialogue_result.duration_seconds:.2f}s)")

        wav_path_dialogue = output_dir / "live_two_speaker_dialogue.wav"
        with open(wav_path_dialogue, "wb") as f:
            f.write(dialogue_result.audio_bytes)

        with wave.open(str(wav_path_dialogue), "rb") as wf:
            assert wf.getframerate() == 44100
            assert wf.getnchannels() == 1
            assert wf.getsampwidth() == 2
            n_frames = wf.getnframes()
        print(f"  ✓ WAV integrity validated: 44.1 kHz 16-bit mono, frames={n_frames}, file={wav_path_dialogue.name}")
    except TTSProviderUnavailableError as e:
        print(f"  ✗ Live dialogue synthesis failed: {e}")
        return {"status": "FAIL", "test": "dialogue_synthesis", "error": str(e)}

    print("\n" + "=" * 80)
    print("STATUS: PASS — Genuine Google Gemini TTS Verified Successfully!")
    print(f"Teacher sample: {wav_path_teacher}")
    print(f"Dialogue sample: {wav_path_dialogue}")
    print("=" * 80)

    return {
        "status": "PASS",
        "model": model,
        "teacher_audio_duration": teacher_result.duration_seconds,
        "dialogue_audio_duration": dialogue_result.duration_seconds,
        "teacher_sample": str(wav_path_teacher),
        "dialogue_sample": str(wav_path_dialogue)
    }


if __name__ == "__main__":
    result = run_gemini_tts_smoke_test()
    if result["status"] == "BLOCKED":
        sys.exit(2)
    elif result["status"] == "FAIL":
        sys.exit(1)
    else:
        sys.exit(0)
