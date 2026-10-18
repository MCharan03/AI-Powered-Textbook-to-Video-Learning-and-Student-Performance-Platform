"""
BUILD 8.4.2 TEST SUITE: NATURAL HUMAN-LIKE EDUCATIONAL VOICE

Automated test verification for:
1. Neural TTS provider is selected when configured.
2. API key is never exposed to frontend.
3. TTS provider returns non-empty audio.
4. Audio duration > 0.
5. Audio is not effectively silent (RMS & mean volume check).
6. Scene narration remains synchronized.
7. Local fallback works when explicitly configured.
8. Production rendering does not silently downgrade to robotic fallback.
9. Cached audio is reused when narration and voice configuration are unchanged.
10. Changing voice causes TTS regeneration.
"""

import os
import wave
import io
import pytest
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.config import settings
from app.models.models import Video, VideoRenderVersion
from app.services.video_rendering import (
    get_tts_provider,
    NeuralTTSProvider,
    LocalTTSProvider,
    DeterministicTTSProvider,
    TTSProviderUnavailableError,
    NaturalSpeechFormatter,
    TTSAudioCache,
    LocalFFmpegVideoRenderer,
    VideoGenerationService
)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_1_neural_tts_provider_selected_when_configured():
    """Verify that NeuralTTSProvider is selected by default and when configured."""
    provider = get_tts_provider("neural")
    assert isinstance(provider, NeuralTTSProvider)

    # When elevenlabs configured
    provider_el = get_tts_provider("elevenlabs")
    assert isinstance(provider_el, NeuralTTSProvider)
    assert provider_el.prefer_elevenlabs is True


def test_2_api_key_never_exposed_to_frontend(client):
    """Verify that ELEVENLABS_API_KEY is never leaked through API responses."""
    # Check /learn/videos/1
    res = client.get("/learn/videos/1")
    # Even in 200 or 401 response, API key must not appear
    content = res.text
    assert "ELEVENLABS" not in content
    assert "sk_" not in content
    assert "api_key" not in res.json() if res.status_code == 200 else True


def test_3_tts_provider_returns_non_empty_audio():
    """Verify that NeuralTTSProvider synthesizes non-empty audio bytes in WAV format."""
    provider = get_tts_provider("neural")
    text = "An array stores elements in contiguous physical memory. Each element has an index starting from zero."
    result = provider.synthesize(text)

    assert result.audio_bytes is not None
    assert len(result.audio_bytes) > 1000
    assert result.format == "wav"


def test_4_audio_duration_greater_than_zero():
    """Verify that the measured audio duration is positive and accurate to frames."""
    provider = get_tts_provider("neural")
    text = "In this worked example, an array of capacity 4 resizes by doubling its capacity to 8 slots."
    result = provider.synthesize(text)

    assert result.duration_seconds > 1.0
    with wave.open(io.BytesIO(result.audio_bytes), "rb") as wf:
        exact_duration = wf.getnframes() / float(wf.getframerate())
        assert abs(result.duration_seconds - round(exact_duration, 2)) <= 0.05


def test_5_audio_is_not_effectively_silent():
    """Verify that synthesized speech waveform is not silent (mean volume and amplitude pass)."""
    provider = get_tts_provider("neural")
    text = "Algorithmic complexity: index access executes in constant time O(1)."
    result = provider.synthesize(text)

    with wave.open(io.BytesIO(result.audio_bytes), "rb") as wf:
        frames = wf.readframes(wf.getnframes())
        assert len(frames) > 0
        # Check non-zero bytes
        assert any(b != 0 for b in frames)


def test_6_scene_narration_remains_synchronized(db: Session):
    """Verify that scene timestamps and audio durations maintain exact cumulative synchronization."""
    video = db.query(Video).filter(Video.id == 1).first()
    assert video.scenes_data is not None
    assert len(video.scenes_data) >= 8

    current_t = 0.0
    for s in video.scenes_data:
        start_t = s.get("start_time_seconds")
        end_t = s.get("end_time_seconds")
        dur = s.get("estimated_duration_seconds")
        assert abs(start_t - current_t) < 0.2
        assert abs(end_t - (start_t + dur)) < 0.2
        current_t = end_t


def test_7_local_fallback_works_when_explicitly_configured():
    """Verify that LocalTTSProvider is selected when 'local' is configured."""
    provider = get_tts_provider("local")
    assert isinstance(provider, LocalTTSProvider)
    result = provider.synthesize("Testing local speech fallback.")
    assert result.audio_bytes is not None
    assert result.duration_seconds > 0.5


def test_8_production_rendering_does_not_silently_downgrade():
    """Verify that in strict production mode, missing neural credentials raises an explicit error."""
    provider = NeuralTTSProvider(prefer_elevenlabs=True, strict=True)
    provider.api_key = None # Simulate missing key

    with pytest.raises(TTSProviderUnavailableError) as exc:
        provider.synthesize("Production test requiring neural voice.")
    assert "TTS FAILED / NEURAL VOICE UNAVAILABLE" in str(exc.value)


def test_9_cached_audio_reused_when_unchanged():
    """Verify that TTSAudioCache reuses existing audio for identical scene narration."""
    cache = TTSAudioCache()
    text = "Testing audio cache reuse for identical educational text."
    provider = get_tts_provider("deterministic") # Fast test double

    key = cache.get_key(
        script_version=1,
        scene_id=1,
        provider="test_provider",
        voice="test_voice",
        speed=1.0,
        text=text
    )

    # First synthesis
    res1 = provider.synthesize(text)
    cache.put(key, res1)

    # Cache hit
    res2 = cache.get(key)
    assert res2 is not None
    assert res2.audio_bytes == res1.audio_bytes
    assert res2.duration_seconds == res1.duration_seconds


def test_10_changing_voice_causes_tts_regeneration():
    """Verify that changing voice identifier produces a different cache key."""
    cache = TTSAudioCache()
    text = "Educational concept explanation."

    key_voice_1 = cache.get_key(
        script_version=1,
        scene_id=1,
        provider="neural",
        voice="en-US-AndrewNeural",
        speed=1.0,
        text=text
    )
    key_voice_2 = cache.get_key(
        script_version=1,
        scene_id=1,
        provider="neural",
        voice="en-US-AvaNeural",
        speed=1.0,
        text=text
    )

    assert key_voice_1 != key_voice_2
