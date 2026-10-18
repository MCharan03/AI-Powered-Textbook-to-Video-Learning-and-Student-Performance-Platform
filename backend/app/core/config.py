import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DATABASE_URL = f"sqlite:///{PROJECT_ROOT / 'app.db'}"


class Settings(BaseSettings):
    app_name: str = "AI-Powered Textbook-to-Video Platform"
    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = DEFAULT_DATABASE_URL
    max_upload_mb: int = 50
    storage_type: str = "local"  # "local" or "s3"
    s3_bucket: str = "textbook-platform-assets"
    s3_region: str = "us-east-1"
    cloudfront_domain: str = ""

    # Build 04: Video Segmentation Parameters
    video_target_min_seconds: int = 300  # 5 minutes
    video_target_max_seconds: int = 360  # 6 minutes
    video_target_seconds: int = 330      # 5.5 minutes
    narration_words_per_minute: int = 140 # Educational spoken pacing (130-150 wpm)

    # Build 06 & 08.4.2: TTS & Video Rendering Parameters
    tts_provider: str = "neural"        # "elevenlabs", "neural", "local", "deterministic"
    tts_engine: str = "neural"          # "elevenlabs", "neural", "local", "deterministic"
    tts_voice: str = "en-US-AndrewNeural" # High-clarity educational teacher voice
    tts_speed: float = 1.0              # Playback speed multiplier (135-155 WPM)
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM" # Rachel - warm, conversational educational voice
    elevenlabs_model_id: str = "eleven_multilingual_v2" # Natural neural speech model
    video_render_engine: str = "ffmpeg" # "ffmpeg"
    video_render_resolution: str = "1280x720" # 720p HD educational format
    video_fps: int = 24

    # Build 07: Quiz Generation & Mastery Parameters
    quiz_generation_engine: str = "deterministic" # "deterministic" or "llm"
    quiz_default_question_count: int = 10
    quiz_passing_score: float = 80.0
    mastery_threshold_mastered: float = 80.0
    mastery_threshold_needs_practice: float = 50.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
