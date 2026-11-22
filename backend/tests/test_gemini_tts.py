"""
Tests for Phase 2B-1: Google Gemini TTS Narration Integration

Validates:
1. Single-teacher narration (consistent voice across scenes, classroom delivery).
2. Two-speaker teacher–student conversation mode (distinct voices for Teacher & Student).
3. Pronunciation formatting for technical terms, formulas, and SI units.
4. Historical script compatibility (fallback to Teacher without inventing dialogue).
5. Audio conversion from PCM to standard 44.1 kHz, 16-bit mono WAV.
6. TTSAudioCache key differentiation by model, voice, language, speed, and text.
7. Anti-silent-fallback: strict failure with TTSProviderUnavailableError when credentials or service fail.
8. Bounded retries with exponential backoff on transient API errors (503, 429).
9. Integration with VideoGenerationService rendering pipeline.
"""

import os
import io
import math
import wave
import struct
import tempfile
import pytest
from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services.video_rendering import (
    GoogleGeminiTTSProvider,
    TTSProviderUnavailableError,
    NaturalSpeechFormatter,
    TTSAudioCache,
    TTSResult,
    get_tts_provider,
    VideoGenerationService
)
from app.models.models import Video, VideoScriptVersion, VideoRenderVersion, ProcessingJob, User, Subject, Chapter, Topic


def _generate_synthetic_pcm_bytes(duration_sec: float = 1.0, sample_rate: int = 24000) -> bytes:
    """Helper to generate valid 16-bit mono raw PCM samples at given sample rate."""
    sample_count = int(sample_rate * duration_sec)
    samples = bytearray()
    for i in range(sample_count):
        val = int(8000 * math.sin(2 * math.pi * 440.0 * (i / sample_rate)))
        samples.extend(val.to_bytes(2, "little", signed=True))
    return bytes(samples)


def _create_mock_gemini_response(pcm_bytes: bytes, mime_type: str = "audio/pcm;rate=24000"):
    """Creates a mock response matching google.genai client structure."""
    part = MagicMock()
    part.inline_data = MagicMock()
    part.inline_data.data = pcm_bytes
    part.inline_data.mime_type = mime_type

    candidate = MagicMock()
    candidate.content = MagicMock()
    candidate.content.parts = [part]

    response = MagicMock()
    response.candidates = [candidate]
    return response


# ==============================================================================
# 1. PRONUNCIATION & FORMATTING TESTS
# ==============================================================================

def test_natural_speech_formatter_si_units():
    """Verify natural spoken pronunciations for SI units."""
    text = "The car travels 100 m in 4 s at 25 m/s with acceleration 2.5 m/s^2."
    formatted = NaturalSpeechFormatter.format_for_speech(text)
    assert "100 meters" in formatted
    assert "4 seconds" in formatted
    assert "25 meters per second" in formatted
    assert "2.5 meters per second squared" in formatted

    text_elec = "The circuit has resistance 10 Ω, voltage 12 V, and current 1.2 A."
    formatted_elec = NaturalSpeechFormatter.format_for_speech(text_elec)
    assert "10 ohms" in formatted_elec
    assert "12 Volts" in formatted_elec
    assert "1.2 Amperes" in formatted_elec

    text_thermo = "At 100 °C under pressure 101.3 kPa, power output is 5 kW and work is 500 J."
    formatted_thermo = NaturalSpeechFormatter.format_for_speech(text_thermo)
    assert "100 degrees Celsius" in formatted_thermo
    assert "101.3 kilopascals" in formatted_thermo
    assert "5 kilowatts" in formatted_thermo
    assert "500 Joules" in formatted_thermo


def test_natural_speech_formatter_mathematical_expressions():
    """Verify natural spoken pronunciations for mathematical expressions, Greek symbols, and powers."""
    text = r"Given \theta = \pi/2, evaluate f(x) = x^2 + y^3 where \sqrt{25} \approx 5."
    formatted = NaturalSpeechFormatter.format_for_speech(text)
    assert "theta" in formatted
    assert "pi/2" in formatted
    assert "f of x" in formatted
    assert "x squared" in formatted
    assert "y cubed" in formatted
    assert "square root of 25" in formatted
    assert "approximately equals" in formatted

    text_symbols = r"Note that \alpha \leq \beta and \lambda \neq 0 while \sum x_i \to \infty."
    formatted_symbols = NaturalSpeechFormatter.format_for_speech(text_symbols)
    assert "alpha" in formatted_symbols
    assert "is less than or equal to" in formatted_symbols
    assert "beta" in formatted_symbols
    assert "lambda" in formatted_symbols
    assert "does not equal" in formatted_symbols
    assert "sum of" in formatted_symbols
    assert "infinity" in formatted_symbols


def test_natural_speech_formatter_computer_science_notation():
    """Verify CS notation: array indexing, Big-O, memory addresses."""
    text = "Looking up arr[2] in arr[i] has time complexity O(1) at address 0x1f4a."
    formatted = NaturalSpeechFormatter.format_for_speech(text)
    assert "arr at index 2" in formatted
    assert "arr at index i" in formatted
    assert "O of 1" in formatted
    assert "memory address 1f4a" in formatted


# ==============================================================================
# 2. AUDIO CONVERSION & PCM-TO-WAV TESTS
# ==============================================================================

def test_pcm_to_standard_wav_conversion():
    """Verify conversion of 24kHz raw PCM to standard 44.1 kHz 16-bit mono WAV."""
    prov = GoogleGeminiTTSProvider()
    synthetic_pcm = _generate_synthetic_pcm_bytes(duration_sec=1.5, sample_rate=24000)

    wav_bytes, duration = prov._convert_to_standard_wav(synthetic_pcm, "audio/pcm;rate=24000")
    assert duration >= 1.45 and duration <= 1.55
    assert len(wav_bytes) > 1000

    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        assert wf.getframerate() == 44100
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2  # 16-bit
        n_frames = wf.getnframes()
        calc_dur = round(n_frames / 44100.0, 2)
        assert calc_dur == duration


def test_convert_invalid_pcm_raises():
    """Corrupted audio conversion must raise TTSProviderUnavailableError."""
    prov = GoogleGeminiTTSProvider()
    with pytest.raises(TTSProviderUnavailableError):
        prov._convert_to_standard_wav(b"not-valid-audio-data", "audio/pcm;rate=24000")


# ==============================================================================
# 3. SINGLE-TEACHER NARRATION TESTS
# ==============================================================================

def test_teacher_narration_uses_teacher_voice():
    """Teacher narration uses configured teacher voice (default Aoede)."""
    prov = GoogleGeminiTTSProvider(teacher_voice="Aoede", student_voice="Puck")
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _create_mock_gemini_response(
        _generate_synthetic_pcm_bytes(1.0)
    )

    with patch.object(prov, "_get_client", return_value=mock_client):
        res = prov.synthesize("Welcome students. Today we will explore Newton's second law.", {"speaker": "Teacher"})

    assert res.voice == "Aoede"
    assert res.engine == "gemini_tts"
    assert not res.is_development
    assert res.duration_seconds > 0.5

    # Check client call arguments
    mock_client.models.generate_content.assert_called_once()
    call_kwargs = mock_client.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-3.8-flash-tts"
    config = call_kwargs["config"]
    assert config.speech_config.voice_config.prebuilt_voice_config.voice_name == "Aoede"
    assert config.speech_config.language_code == "en-IN"


def test_historical_script_defaults_to_teacher():
    """If no speaker is specified, defaults to Teacher voice without failing or inventing turns."""
    prov = GoogleGeminiTTSProvider(teacher_voice="Aoede", student_voice="Puck")
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _create_mock_gemini_response(
        _generate_synthetic_pcm_bytes(1.0)
    )

    with patch.object(prov, "_get_client", return_value=mock_client):
        res = prov.synthesize("This is an unannotated legacy script scene.", {})

    assert res.voice == "Aoede"


# ==============================================================================
# 4. TEACHER-STUDENT CONVERSATION MODE TESTS
# ==============================================================================

def test_student_narration_uses_student_voice():
    """Student scene uses configured student voice (default Puck)."""
    prov = GoogleGeminiTTSProvider(teacher_voice="Aoede", student_voice="Puck")
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _create_mock_gemini_response(
        _generate_synthetic_pcm_bytes(1.0)
    )

    with patch.object(prov, "_get_client", return_value=mock_client):
        res = prov.synthesize("Teacher, how does air resistance affect this calculation?", {"speaker": "Student"})

    assert res.voice == "Puck"
    mock_client.models.generate_content.assert_called_once()
    config = mock_client.models.generate_content.call_args.kwargs["config"]
    assert config.speech_config.voice_config.prebuilt_voice_config.voice_name == "Puck"


def test_multi_speaker_dialogue_synthesis():
    """Scene containing structured dialogue turns produces combined audio with both voices."""
    prov = GoogleGeminiTTSProvider(teacher_voice="Aoede", student_voice="Puck")
    mock_client = MagicMock()

    # Two separate synthesis calls for the two turns
    mock_client.models.generate_content.side_effect = [
        _create_mock_gemini_response(_generate_synthetic_pcm_bytes(1.0)),
        _create_mock_gemini_response(_generate_synthetic_pcm_bytes(1.2)),
    ]

    dialogue = [
        {"speaker": "Teacher", "text": "What happens if mass increases?"},
        {"speaker": "Student", "text": "Acceleration decreases inversely!"}
    ]

    with patch.object(prov, "_get_client", return_value=mock_client):
        res = prov.synthesize("", {"dialogue": dialogue})

    assert res.voice == "Teacher+Student"
    assert res.engine == "gemini_tts"
    assert res.duration_seconds > 2.0  # 1.0 + 1.2 + 0.25s pause
    assert mock_client.models.generate_content.call_count == 2


# ==============================================================================
# 5. AUDIO CACHE IDENTITY & REUSE
# ==============================================================================

def test_tts_audio_cache_key_differentiation(tmp_path):
    """Audio cache differentiates by model, voice, language, speed, and text."""
    cache = TTSAudioCache(cache_dir=str(tmp_path))

    k_teacher = cache.get_key(
        script_version=1, scene_id=1, provider="gemini_tts",
        voice="Aoede", speed=1.0, text="Concept explanation",
        model="gemini-3.8-flash-tts", language="en-IN"
    )
    k_student = cache.get_key(
        script_version=1, scene_id=1, provider="gemini_tts",
        voice="Puck", speed=1.0, text="Concept explanation",
        model="gemini-3.8-flash-tts", language="en-IN"
    )
    k_lite_model = cache.get_key(
        script_version=1, scene_id=1, provider="gemini_tts",
        voice="Aoede", speed=1.0, text="Concept explanation",
        model="gemini-3.8-flash-lite-tts", language="en-IN"
    )
    k_different_lang = cache.get_key(
        script_version=1, scene_id=1, provider="gemini_tts",
        voice="Aoede", speed=1.0, text="Concept explanation",
        model="gemini-3.8-flash-tts", language="en-US"
    )

    assert len({k_teacher, k_student, k_lite_model, k_different_lang}) == 4

    # Test put and get
    sample_wav = _generate_synthetic_pcm_bytes(0.5, 44100)
    # Create simple WAV from PCM
    out_buf = io.BytesIO()
    with wave.open(out_buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(44100)
        wf.writeframes(sample_wav)
    wav_bytes = out_buf.getvalue()

    result = TTSResult(wav_bytes, 0.5, "wav", "gemini_tts", "Aoede", False)
    cache.put(k_teacher, result, model="gemini-3.8-flash-tts", language="en-IN")

    cached = cache.get(k_teacher)
    assert cached is not None
    assert cached.voice == "Aoede"
    assert cached.duration_seconds == 0.5
    assert cached.engine == "gemini_tts"


# ==============================================================================
# 6. ANTI-SILENT-FALLBACK & RELIABILITY TESTS
# ==============================================================================

def test_missing_credentials_raises_provider_unavailable():
    """In production with Gemini TTS, missing credentials must fail closed (never silent fallback)."""
    prov = GoogleGeminiTTSProvider()

    with patch.dict(os.environ, {}, clear=True), \
         patch.object(settings, "gemini_api_key", None), \
         patch.object(settings, "gemini_tts_api_key", None), \
         patch.object(settings, "google_cloud_project", None):
        # When Client() fails or raises
        with patch("google.genai.Client", side_effect=Exception("No credentials found")):
            with pytest.raises(TTSProviderUnavailableError) as exc_info:
                prov.synthesize("Important lesson narration.", {})
            assert "TTS FAILED / GEMINI TTS UNAVAILABLE" in str(exc_info.value)


def test_retries_transient_503_error():
    """Transient 503 errors trigger exponential backoff and succeed if subsequent attempt passes."""
    prov = GoogleGeminiTTSProvider(max_retries=2)
    mock_client = MagicMock()

    # Fail once with 503, succeed on second attempt
    mock_client.models.generate_content.side_effect = [
        Exception("503 UNAVAILABLE: Model experiencing high demand"),
        _create_mock_gemini_response(_generate_synthetic_pcm_bytes(1.0))
    ]

    with patch.object(prov, "_get_client", return_value=mock_client), \
         patch("time.sleep", return_value=None):  # Skip sleep in test
        res = prov.synthesize("Testing transient retry.", {})

    assert res.duration_seconds > 0.5
    assert mock_client.models.generate_content.call_count == 2


def test_exhausted_retries_raises_provider_unavailable():
    """If retries are exhausted, raise TTSProviderUnavailableError (no fallback to tones)."""
    prov = GoogleGeminiTTSProvider(max_retries=2)
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("503 UNAVAILABLE: High demand")

    with patch.object(prov, "_get_client", return_value=mock_client), \
         patch("time.sleep", return_value=None):
        with pytest.raises(TTSProviderUnavailableError) as exc_info:
            prov.synthesize("Testing retry exhaustion.", {})
        assert "generation failed" in str(exc_info.value)


def test_factory_returns_gemini_tts_provider():
    """get_tts_provider returns GoogleGeminiTTSProvider when configured."""
    p1 = get_tts_provider("gemini")
    assert isinstance(p1, GoogleGeminiTTSProvider)
    assert p1.model == "gemini-3.8-flash-tts"

    p2 = get_tts_provider("gemini_tts")
    assert isinstance(p2, GoogleGeminiTTSProvider)

    p3 = get_tts_provider("google")
    assert isinstance(p3, GoogleGeminiTTSProvider)

    with patch.object(settings, "tts_provider", "gemini"), patch.dict(os.environ, {"PYTEST_CURRENT_TEST": ""}):
        p4 = get_tts_provider()
        assert isinstance(p4, GoogleGeminiTTSProvider)


# ==============================================================================
# 7. RENDERING PIPELINE INTEGRATION
# ==============================================================================

def test_pipeline_uses_distinct_voices_for_scenes(db_session, monkeypatch):
    """Pipeline passes speaker metadata to active TTS and preserves distinct voices per scene."""
    from tests.test_video_rendering_and_pipeline import create_approved_script_video

    db = db_session

    # Mock GoogleGeminiTTSProvider to return synthetic WAVs without external API calls
    mock_provider = MagicMock(spec=GoogleGeminiTTSProvider)
    mock_provider.engine = "gemini_tts"
    mock_provider.model = "gemini-3.8-flash-tts"
    mock_provider.language_code = "en-IN"
    mock_provider.teacher_voice = "Aoede"
    mock_provider.student_voice = "Puck"

    def mock_synthesize(text, cfg=None):
        voice = (cfg or {}).get("voice", "Aoede")
        pcm = _generate_synthetic_pcm_bytes(3.0, 44100)
        out_buf = io.BytesIO()
        with wave.open(out_buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(pcm)
        return TTSResult(out_buf.getvalue(), 3.0, "wav", "gemini_tts", voice, False)

    mock_provider.synthesize.side_effect = mock_synthesize

    _, _, _, video = create_approved_script_video(db, title="Conversation Lesson")
    # Set conversation script with alternating Teacher and Student
    sections = [
        {"title": "Scene 1", "narration": "Welcome to our class on momentum.", "speaker": "Teacher", "type": "CONCEPT"},
        {"title": "Scene 2", "narration": "Is momentum always conserved in collisions?", "speaker": "Student", "type": "CONCEPT"},
    ]
    video.script_data = {"sections": sections, "narration_style": "conversation"}
    db.commit()

    import uuid
    from app.models.models import VideoRenderingJob
    from app.services.video_rendering import utcnow

    job_id = f"job_test_{uuid.uuid4().hex[:8]}"
    job = VideoRenderingJob(
        job_id=job_id,
        video_id=video.id,
        stage_number=1,
        stage_name="Preparing script and scenes",
        status="PENDING",
        progress=0.0,
        started_at=utcnow()
    )
    db.add(job)
    db.commit()

    service = VideoGenerationService(tts_engine=mock_provider)
    res_video = service.run_rendering_pipeline(job.job_id, db)

    assert res_video.render_status == "RENDERED"
    assert mock_provider.synthesize.call_count == 2

    # Check voice configurations used in the two calls
    call1_cfg = mock_provider.synthesize.call_args_list[0][0][1]
    call2_cfg = mock_provider.synthesize.call_args_list[1][0][1]

    assert call1_cfg["speaker"] == "Teacher"
    assert call1_cfg["voice"] == "Aoede"
    assert call2_cfg["speaker"] == "Student"
    assert call2_cfg["voice"] == "Puck"


# ==============================================================================
# 8. ENTERPRISE AUTHENTICATION, DIAGNOSTICS & MULTI-SPEAKER SCHEMA TESTS
# ==============================================================================

def test_enterprise_client_init_uses_adc_and_no_api_key():
    """Enterprise client initialization strictly uses ADC and never passes AI Studio API key."""
    prov = GoogleGeminiTTSProvider(project="my-edu-project", location="global")

    with patch("google.auth.default", return_value=(MagicMock(), "my-edu-project")), \
         patch("google.genai.Client") as mock_genai_client, \
         patch.object(settings, "gemini_api_key", "AIzaSyFakeStudioKey"):

        prov._get_client()

        mock_genai_client.assert_called_once_with(
            enterprise=True,
            project="my-edu-project",
            location="global"
        )
        call_kwargs = mock_genai_client.call_args.kwargs
        assert "api_key" not in call_kwargs or call_kwargs["api_key"] is None


def test_diagnostics_classification_all_categories():
    """Verify safe diagnostic classification into 7 distinct actionable categories."""
    prov = GoogleGeminiTTSProvider

    # 1. Missing project
    cat1, msg1 = prov.classify_error("Missing project", project=None)
    assert cat1 == "MISSING_PROJECT_CONFIGURATION"
    assert "GOOGLE_CLOUD_PROJECT" in msg1

    # 2. Missing ADC
    from google.auth.exceptions import DefaultCredentialsError
    cat2, msg2 = prov.classify_error(DefaultCredentialsError("Your default credentials were not found"), project="p1")
    assert cat2 == "MISSING_ADC_CREDENTIALS"
    assert "application-default login" in msg2

    # 3. Insufficient IAM permissions
    cat3, msg3 = prov.classify_error(Exception("403 PERMISSION_DENIED: Permission denied on resource"), project="p1")
    assert cat3 == "INSUFFICIENT_IAM_PERMISSIONS"
    assert "roles/aiplatform.user" in msg3

    # 4. API not enabled
    cat4, msg4 = prov.classify_error(Exception("SERVICE_DISABLED: Vertex AI API has not been used in project"), project="p1")
    assert cat4 == "API_NOT_ENABLED"
    assert "aiplatform.googleapis.com" in msg4

    # 5. Model or location unavailable
    cat5, msg5 = prov.classify_error(Exception("404 NOT_FOUND: Publisher Model gemini-3.8-flash-tts not found in location global"), project="p1")
    assert cat5 == "MODEL_OR_LOCATION_UNAVAILABLE"
    assert "gemini-3.8-flash-tts" in msg5

    # 6. Invalid request schema
    cat6, msg6 = prov.classify_error(Exception("400 INVALID_ARGUMENT: Unknown name 'speechConfig'"), project="p1")
    assert cat6 == "INVALID_REQUEST_SCHEMA"
    assert "speech_config" in msg6

    # 7. Rate limiting & transient
    cat7, msg7 = prov.classify_error(Exception("503 UNAVAILABLE: Model experiencing high demand"), project="p1")
    assert cat7 == "RATE_LIMITING_OR_TRANSIENT_ERROR"
    assert "Transient service error" in msg7


def test_validate_configuration_checks():
    """validate_configuration distinguishes configured project, missing ADC, and disabled state."""
    # When disabled
    with patch.object(settings, "gemini_tts_enabled", False), patch.dict(os.environ, {"GEMINI_TTS_ENABLED": "false"}):
        ok, msg, cat = GoogleGeminiTTSProvider.validate_configuration()
        assert not ok
        assert cat == "DISABLED"

    # When project missing
    with patch.object(settings, "gemini_tts_enabled", True), \
         patch.object(settings, "google_cloud_project", None), \
         patch.dict(os.environ, {"GOOGLE_CLOUD_PROJECT": ""}, clear=True):
        ok, msg, cat = GoogleGeminiTTSProvider.validate_configuration()
        assert not ok
        assert cat == "MISSING_PROJECT_CONFIGURATION"

    # When ADC missing
    with patch.object(settings, "gemini_tts_enabled", True), \
         patch.object(settings, "google_cloud_project", "test-project"), \
         patch("google.auth.default", side_effect=Exception("No credentials")):
        ok, msg, cat = GoogleGeminiTTSProvider.validate_configuration()
        assert not ok
        assert cat == "MISSING_ADC_CREDENTIALS"

    # When fully valid
    with patch.object(settings, "gemini_tts_enabled", True), \
         patch.object(settings, "google_cloud_project", "test-project"), \
         patch.object(settings, "google_cloud_location", "global"), \
         patch("google.auth.default", return_value=(MagicMock(), "test-project")):
        ok, msg, cat = GoogleGeminiTTSProvider.validate_configuration()
        assert ok
        assert cat is None
        assert "test-project" in msg


def test_gemini_3_8_multi_speaker_request_schema():
    """Verify Gemini 3.8 MultiSpeakerVoiceConfig schema generation and execution."""
    prov = GoogleGeminiTTSProvider(teacher_voice="Aoede", student_voice="Puck", language_code="en-IN")

    cfg = prov.build_multi_speaker_config()
    assert cfg.response_modalities == ["AUDIO"]
    multi_sc = cfg.speech_config.multi_speaker_voice_config
    assert len(multi_sc.speaker_voice_configs) == 2
    assert multi_sc.speaker_voice_configs[0].speaker == "Teacher"
    assert multi_sc.speaker_voice_configs[0].voice_config.prebuilt_voice_config.voice_name == "Aoede"
    assert multi_sc.speaker_voice_configs[0].voice_config.voice == "Aoede"
    assert multi_sc.speaker_voice_configs[1].speaker == "Student"
    assert multi_sc.speaker_voice_configs[1].voice_config.prebuilt_voice_config.voice_name == "Puck"
    assert multi_sc.speaker_voice_configs[1].voice_config.voice == "Puck"
    assert cfg.speech_config.language_code == "en-IN"

    # Test synthesize_multi_speaker with mock client
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _create_mock_gemini_response(
        _generate_synthetic_pcm_bytes(2.5)
    )

    with patch.object(prov, "_get_client", return_value=mock_client):
        res = prov.synthesize_multi_speaker(
            dialogue_prompt="Teacher: Hello class.\nStudent: Hello teacher!"
        )

    assert res.voice == "Teacher+Student"
    assert res.duration_seconds > 2.0
    mock_client.models.generate_content.assert_called_once()
    call_kwargs = mock_client.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-3.8-flash-tts"
    assert "Teacher: Hello class." in call_kwargs["contents"]
    assert call_kwargs["config"].speech_config.multi_speaker_voice_config is not None
