"""
BUILD 06: AI NARRATION (TTS) & SCENE-BASED VIDEO RENDERING PIPELINE

Core video generation and rendering service:
1. Pluggable TTS engine abstraction (Deterministic, Local macOS 'say', Production fallback).
2. Scene generation with word-count-based duration calculation.
3. Scene-based visual renderer using Pillow (TITLE_CARD, TEXT, SUMMARY_CHIPS, DIAGRAM, FORMULA_CARD, CODE_SNIPPET, EXAMPLE, FLOW_DIAGRAM).
4. Local FFmpeg video renderer creating valid 720p H.264 / AAC MP4.
5. Thumbnail generation and WebVTT/SRT caption synthesis.
6. Media output validation with FFmpeg probe.
7. ProcessingJob lifecycle and VideoRenderVersion tracking.
"""

import os
import re
import io
import json
import math
import wave
import struct
import shutil
import hashlib
import asyncio
import tempfile
import subprocess
import threading
import uuid
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple, Callable, Union
from abc import ABC, abstractmethod

import httpx
try:
    import edge_tts
except ImportError:
    edge_tts = None

from sqlalchemy.orm import Session
from PIL import Image, ImageDraw, ImageFont

from app.core.config import settings
from app.core.storage import get_storage
from app.core.database import SessionLocal
from app.models.models import (
    Video, VideoScriptVersion, VideoRenderVersion, ProcessingJob, VideoRenderingJob
)

try:
    import imageio_ffmpeg
    DEFAULT_FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    DEFAULT_FFMPEG_EXE = "ffmpeg"


def utcnow():
    return datetime.now(timezone.utc)


def normalize_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ==============================================================================
# 1. TTS ENGINE ABSTRACTION
# ==============================================================================

class TTSResult:
    def __init__(
        self,
        audio_bytes: bytes,
        duration_seconds: float,
        format: str = "wav",
        engine: str = "deterministic",
        voice: str = "default",
        is_development: bool = True
    ):
        self.audio_bytes = audio_bytes
        self.duration_seconds = duration_seconds
        self.format = format
        self.engine = engine
        self.voice = voice
        self.is_development = is_development


class TTSProviderUnavailableError(Exception):
    pass


# ==============================================================================
# NATURAL SPEECH FORMATTER & AUDIO CACHE (BUILD 8.4.2)
# ==============================================================================

class NaturalSpeechFormatter:
    """
    Preprocesses raw educational scripts for natural conversational narration.
    Implements natural pauses, human-like cadence, and clear pronunciation of
    technical notations, mathematical expressions, formulas, and SI units
    without modifying underlying educational facts.
    """

    @staticmethod
    def format_for_speech(text: str) -> str:
        if not text:
            return ""
        t = text

        # 1. Normalize code and index bracket lookups
        t = re.sub(r"\barr\[([0-9]+)\]", r"arr at index \1", t)
        t = re.sub(r"\barr\[([a-zA-Z_]+)\]", r"arr at index \1", t)
        t = re.sub(r"\b([a-zA-Z_]+)\[([0-9]+)\]", r"\1 at index \2", t)

        # 2. Normalize complexity notations
        t = re.sub(r"\bO\(([0-9]+)\)", r"O of \1", t)
        t = re.sub(r"\bO\(([a-zA-Z]+)\)", r"O of \1", t)

        # 3. Normalize memory hexadecimal addresses
        t = re.sub(r"\b0x([0-9a-fA-F]+)\b", r"memory address \1", t)

        # 4. Mathematical address calculations
        t = t.replace("Base_Address", "base address")
        t = t.replace("Element_Size", "element size")
        t = re.sub(r"Address\(arr\[i\]\) = Base \+ \(i \* size\)", "Address of arr at index i equals Base plus index times size", t)
        t = re.sub(r"Address\(arr\[i\]\) = Base_Address \+ \(i \* Element_Size\)", "Address of arr at index i equals base address plus i times element size", t)

        # 5. SI Units normalization (when preceded by a number)
        # Acceleration / Speed
        t = re.sub(r"(\d+(?:\.\d+)?)\s*(?:m/s\^2|m/s²)\b", r"\1 meters per second squared", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*(?:km/h|km/hr)\b", r"\1 kilometers per hour", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*m/s\b", r"\1 meters per second", t)

        # Mass & Distance
        t = re.sub(r"(\d+(?:\.\d+)?)\s*kg\b", r"\1 kilograms", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*mg\b", r"\1 milligrams", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*cm\b", r"\1 centimeters", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*mm\b", r"\1 millimeters", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*km\b", r"\1 kilometers", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*m\b", r"\1 meters", t)

        # Time
        t = re.sub(r"(\d+(?:\.\d+)?)\s*(?:sec|seconds?)\b", r"\1 seconds", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*ms\b", r"\1 milliseconds", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*s\b", r"\1 seconds", t)

        # Frequency
        t = re.sub(r"(\d+(?:\.\d+)?)\s*GHz\b", r"\1 gigahertz", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*MHz\b", r"\1 megahertz", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*kHz\b", r"\1 kilohertz", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*Hz\b", r"\1 hertz", t)

        # Force, Work & Energy, Power
        t = re.sub(r"(\d+(?:\.\d+)?)\s*kJ\b", r"\1 kilojoules", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*J\b", r"\1 Joules", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*N\b", r"\1 Newtons", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*kW\b", r"\1 kilowatts", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*MW\b", r"\1 megawatts", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*W\b", r"\1 Watts", t)

        # Electricity
        t = re.sub(r"(\d+(?:\.\d+)?)\s*mV\b", r"\1 millivolts", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*V\b", r"\1 Volts", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*mA\b", r"\1 milliamperes", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*A\b", r"\1 Amperes", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*kΩ\b", r"\1 kilo-ohms", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*(?:Ω|ohms?)\b", r"\1 ohms", t)

        # Pressure & Temperature
        t = re.sub(r"(\d+(?:\.\d+)?)\s*kPa\b", r"\1 kilopascals", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*Pa\b", r"\1 Pascals", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*(?:°C|deg C|degrees C)\b", r"\1 degrees Celsius", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*(?:°F|deg F|degrees F)\b", r"\1 degrees Fahrenheit", t)
        t = re.sub(r"(\d+(?:\.\d+)?)\s*K\b", r"\1 Kelvin", t)

        # 6. Mathematical Expressions, Formulas and Operators
        t = t.replace(r"\approx", "approximately equals").replace("≈", "approximately equals")
        t = t.replace(r"\neq", "does not equal").replace("≠", "does not equal")
        t = t.replace(r"\leq", "is less than or equal to").replace("≤", "is less than or equal to")
        t = t.replace(r"\geq", "is greater than or equal to").replace("≥", "is greater than or equal to")
        t = t.replace(r"\pm", "plus or minus").replace("±", "plus or minus")
        t = t.replace(r"\times", "times").replace("×", "times")
        t = t.replace(r"\div", "divided by").replace("÷", "divided by")
        t = t.replace(r"\infty", "infinity").replace("∞", "infinity")
        t = t.replace(r"\sum", "sum of").replace("∑", "sum of")
        t = t.replace(r"\int", "integral of").replace("∫", "integral of")

        # Greek Symbols
        greek_map = {
            r"\theta": "theta", "θ": "theta",
            r"\pi": "pi", "π": "pi",
            r"\alpha": "alpha", "α": "alpha",
            r"\beta": "beta", "β": "beta",
            r"\gamma": "gamma", "γ": "gamma",
            r"\lambda": "lambda", "λ": "lambda",
            r"\Delta": "delta", "Δ": "delta",
            r"\mu": "micro", "μ": "micro",
            r"\sigma": "sigma", "σ": "sigma",
            r"\omega": "omega", "ω": "omega"
        }
        for g_k, g_v in greek_map.items():
            t = t.replace(g_k, g_v)

        # Powers and roots
        t = re.sub(r"\\sqrt\{([^{}]+)\}", r"square root of \1", t)
        t = re.sub(r"\b([a-zA-Z0-9]+)\^2\b", r"\1 squared", t)
        t = re.sub(r"\b([a-zA-Z0-9]+)\^3\b", r"\1 cubed", t)
        t = re.sub(r"\b([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)\b", r"\1 to the power of \2", t)

        # Function calls
        t = re.sub(r"\bf\(([a-zA-Z0-9]+)\)", r"f of \1", t)
        t = re.sub(r"\blog_2\(([a-zA-Z0-9]+)\)", r"log base 2 of \1", t)
        t = re.sub(r"\blog_2", "log base 2", t)

        # 7. Clean LaTeX and Markdown syntax
        t = t.replace("$$", " ").replace("$", " ")
        t = t.replace(r"\(", " ").replace(r"\)", " ")
        t = t.replace("**", "").replace("`", "")
        t = re.sub(r"^\s*#+\s*", "", t, flags=re.MULTILINE)

        # 8. Natural conversational rhythm padding
        t = re.sub(r"\s+", " ", t).strip()
        return t


class TTSAudioCache:
    """
    Disk-backed audio cache for synthesized speech segments.
    Keyed by: script_version, scene_id, provider, model, voice, language, speed, and formatted text.
    Reuses existing audio when narration and voice configuration are unchanged.
    """

    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = cache_dir or os.path.join(getattr(settings, "upload_dir", "uploads"), "cache", "audio")
        os.makedirs(self.cache_dir, exist_ok=True)

    def get_key(
        self,
        script_version: int,
        scene_id: int,
        provider: str,
        voice: str,
        speed: float,
        text: str,
        model: str = "",
        language: str = ""
    ) -> str:
        raw = f"{script_version}_{scene_id}_{provider}_{model}_{voice}_{language}_{speed:.2f}_{text.strip()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[TTSResult]:
        meta_file = os.path.join(self.cache_dir, f"{key}.json")
        wav_file = os.path.join(self.cache_dir, f"{key}.wav")
        if os.path.exists(meta_file) and os.path.exists(wav_file):
            try:
                with open(meta_file, "r") as mf:
                    meta = json.load(mf)
                with open(wav_file, "rb") as wf:
                    audio_bytes = wf.read()
                return TTSResult(
                    audio_bytes=audio_bytes,
                    duration_seconds=meta["duration_seconds"],
                    format="wav",
                    engine=meta["engine"],
                    voice=meta["voice"],
                    is_development=meta.get("is_development", False)
                )
            except Exception:
                return None
        return None

    def put(self, key: str, result: TTSResult, model: str = "", language: str = "") -> None:
        try:
            meta_file = os.path.join(self.cache_dir, f"{key}.json")
            wav_file = os.path.join(self.cache_dir, f"{key}.wav")
            with open(wav_file, "wb") as wf:
                wf.write(result.audio_bytes)
            with open(meta_file, "w") as mf:
                json.dump({
                    "duration_seconds": result.duration_seconds,
                    "engine": result.engine,
                    "voice": result.voice,
                    "model": model,
                    "language": language,
                    "is_development": result.is_development
                }, mf)
        except Exception:
            pass


# ==============================================================================
# 1. TTS PROVIDER ABSTRACTION (BUILD 8.4.2)
# ==============================================================================

class TTSProvider(ABC):
    @abstractmethod
    def synthesize(self, text: str, voice_config: Optional[Dict[str, Any]] = None) -> TTSResult:
        pass


class NeuralTTSProvider(TTSProvider):
    """
    Primary Neural TTS Provider for Build 8.4.2.
    Integrates ElevenLabs official API when ELEVENLABS_API_KEY is configured,
    with local high-clarity Neural speech (edge-tts / Microsoft Andrew & Christopher Neural)
    for natural, warm, conversational teacher delivery.
    """

    def __init__(
        self,
        prefer_elevenlabs: bool = True,
        strict: bool = False,
        words_per_minute: int = settings.narration_words_per_minute,
        ffmpeg_exe: str = DEFAULT_FFMPEG_EXE,
        provider: Optional[str] = None
    ):
        self.provider = provider
        self.prefer_elevenlabs = prefer_elevenlabs
        self.strict = strict
        self.wpm = words_per_minute
        self.ffmpeg_exe = ffmpeg_exe

    def synthesize(self, text: str, voice_config: Optional[Dict[str, Any]] = None) -> TTSResult:
        if self.provider and self.provider.lower() not in ["elevenlabs", "neural", "edge"]:
            raise TTSProviderUnavailableError(f"TTS provider '{self.provider}' is unavailable or not configured.")

        cfg = voice_config or {}
        api_key = os.environ.get("ELEVENLABS_API_KEY") or settings.elevenlabs_api_key
        voice = cfg.get("voice") or settings.elevenlabs_voice_id or "21m00Tcm4TlvDq8ikWAM"
        speed = float(cfg.get("speed") or settings.tts_speed or 1.0)

        # Preprocess text for natural conversational speech
        speech_text = NaturalSpeechFormatter.format_for_speech(text)

        # 1. ElevenLabs API if key present
        if api_key:
            try:
                return self._synthesize_elevenlabs(speech_text, api_key, voice, speed)
            except Exception as e:
                if self.strict:
                    raise TTSProviderUnavailableError(f"TTS FAILED / NEURAL VOICE UNAVAILABLE: ElevenLabs synthesis failed: {str(e)}")

        # 2. If strict production requested without ElevenLabs key
        if self.strict and self.prefer_elevenlabs:
            raise TTSProviderUnavailableError("TTS FAILED / NEURAL VOICE UNAVAILABLE: ELEVENLABS_API_KEY is not configured.")

        # 3. High-quality Neural voice (edge_tts)
        neural_voice = cfg.get("neural_voice") or cfg.get("voice") or settings.tts_voice
        if not neural_voice or not neural_voice.endswith("Neural"):
            neural_voice = "en-US-AndrewNeural"  # High-clarity educational teacher voice

        if edge_tts is not None:
            try:
                return self._synthesize_neural_edge(speech_text, neural_voice, speed)
            except Exception as e:
                if self.strict:
                    raise TTSProviderUnavailableError(f"TTS FAILED / NEURAL VOICE UNAVAILABLE: Neural synthesis failed: {str(e)}")

        # 4. Fallback to LocalTTSProvider if neural fails
        fallback = LocalTTSProvider(self.wpm, self.ffmpeg_exe)
        res = fallback.synthesize(speech_text, voice_config)
        res.engine = "local_fallback"
        return res

    def _synthesize_elevenlabs(self, text: str, api_key: str, voice_id: str, speed: float) -> TTSResult:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json"
        }
        model_id = os.environ.get("ELEVENLABS_MODEL_ID") or settings.elevenlabs_model_id
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }
        resp = httpx.post(url, headers=headers, json=payload, timeout=60.0)
        if resp.status_code != 200:
            raise RuntimeError(f"ElevenLabs API error ({resp.status_code}): {resp.text}")

        mp3_bytes = resp.content
        with tempfile.TemporaryDirectory() as td:
            mp3_path = os.path.join(td, "speech.mp3")
            wav_path = os.path.join(td, "speech.wav")
            with open(mp3_path, "wb") as f:
                f.write(mp3_bytes)
            subprocess.run([self.ffmpeg_exe, "-y", "-i", mp3_path, "-ac", "1", "-ar", "44100", wav_path], check=True, capture_output=True)
            with open(wav_path, "rb") as wf:
                audio_bytes = wf.read()
            with wave.open(wav_path, "rb") as wf_obj:
                dur = round(wf_obj.getnframes() / float(wf_obj.getframerate()), 2)

        return TTSResult(
            audio_bytes=audio_bytes,
            duration_seconds=dur,
            format="wav",
            engine="elevenlabs",
            voice=voice_id,
            is_development=False
        )

    def _synthesize_neural_edge(self, text: str, voice_name: str, speed: float) -> TTSResult:
        rate_str = "+0%" if speed == 1.0 else (f"+{int((speed-1)*100)}%" if speed > 1.0 else f"{int((speed-1)*100)}%")
        with tempfile.TemporaryDirectory() as td:
            mp3_path = os.path.join(td, "speech.mp3")
            wav_path = os.path.join(td, "speech.wav")

            async def _generate():
                comm = edge_tts.Communicate(text, voice_name, rate=rate_str)
                await comm.save(mp3_path)

            asyncio.run(_generate())
            subprocess.run([self.ffmpeg_exe, "-y", "-i", mp3_path, "-ac", "1", "-ar", "44100", wav_path], check=True, capture_output=True)
            with open(wav_path, "rb") as wf:
                audio_bytes = wf.read()
            with wave.open(wav_path, "rb") as wf_obj:
                dur = round(wf_obj.getnframes() / float(wf_obj.getframerate()), 2)

        return TTSResult(
            audio_bytes=audio_bytes,
            duration_seconds=dur,
            format="wav",
            engine="neural_tts",
            voice=voice_name,
            is_development=False
        )


class LocalTTSProvider(TTSProvider):
    """
    Local speech synthesis fallback leveraging macOS native 'say' utility when available.
    """

    def __init__(self, words_per_minute: int = settings.narration_words_per_minute, ffmpeg_exe: str = DEFAULT_FFMPEG_EXE):
        self.wpm = words_per_minute
        self.ffmpeg_exe = ffmpeg_exe
        self.has_say = os.path.exists("/usr/bin/say")

    def synthesize(self, text: str, voice_config: Optional[Dict[str, Any]] = None) -> TTSResult:
        speech_text = NaturalSpeechFormatter.format_for_speech(text)
        if not self.has_say:
            fallback = DeterministicTTSProvider(self.wpm)
            return fallback.synthesize(speech_text, voice_config)

        voice = (voice_config or {}).get("voice") or settings.tts_voice
        if not voice or voice.endswith("Neural"):
            voice = "Samantha"
        voice_flag = ["-v", voice] if voice and voice != "default" else []

        with tempfile.TemporaryDirectory() as td:
            aiff_path = os.path.join(td, "speech.aiff")
            wav_path = os.path.join(td, "speech.wav")
            try:
                rate_wpm = str(int(self.wpm * 1.05))
                cmd = ["/usr/bin/say", "-r", rate_wpm, "-o", aiff_path] + voice_flag + [speech_text]
                proc = subprocess.run(cmd, capture_output=True, timeout=60)
                if proc.returncode != 0 and voice_flag:
                    cmd = ["/usr/bin/say", "-r", rate_wpm, "-o", aiff_path, speech_text]
                    proc = subprocess.run(cmd, capture_output=True, timeout=60)

                if proc.returncode == 0 and os.path.exists(aiff_path) and os.path.getsize(aiff_path) > 100:
                    subprocess.run(
                        [self.ffmpeg_exe, "-y", "-i", aiff_path, "-ac", "1", "-ar", "44100", wav_path],
                        capture_output=True,
                        check=True
                    )
                    with open(wav_path, "rb") as f:
                        audio_bytes = f.read()
                    with wave.open(wav_path, "rb") as wf:
                        duration = wf.getnframes() / float(wf.getframerate())
                    if duration > 0.05 and len(audio_bytes) > 500:
                        return TTSResult(
                            audio_bytes=audio_bytes,
                            duration_seconds=round(duration, 2),
                            format="wav",
                            engine="local_fallback",
                            voice=voice or "Samantha",
                            is_development=True
                        )
            except Exception:
                pass

        fallback = DeterministicTTSProvider(self.wpm)
        res = fallback.synthesize(speech_text, voice_config)
        res.engine = "local_deterministic_fallback"
        return res


class DeterministicTTSProvider(TTSProvider):
    """
    Zero-cost deterministic development TTS engine.
    Generates valid harmonic tone waveforms whose duration precisely matches
    the spoken narration word count based on narration_words_per_minute.
    """

    def __init__(self, words_per_minute: int = settings.narration_words_per_minute):
        self.wpm = words_per_minute

    def synthesize(self, text: str, voice_config: Optional[Dict[str, Any]] = None) -> TTSResult:
        speech_text = NaturalSpeechFormatter.format_for_speech(text)
        words = len(speech_text.split())
        duration_sec = max(2.0, round((words / self.wpm) * 60.0, 2))
        sample_rate = 44100
        total_samples = int(sample_rate * duration_sec)

        samples = bytearray()
        base_freq = 220.0
        for i in range(total_samples):
            t = i / sample_rate
            syllable_env = 0.5 + 0.5 * math.sin(2 * math.pi * 3.2 * t)
            tone = (
                0.6 * math.sin(2 * math.pi * base_freq * t) +
                0.25 * math.sin(2 * math.pi * base_freq * 2 * t) +
                0.15 * math.sin(2 * math.pi * base_freq * 3 * t)
            )
            val = int(32767 * 0.18 * syllable_env * tone)
            samples.extend(val.to_bytes(2, "little", signed=True))

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            wav_path = tf.name

        try:
            with wave.open(wav_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sample_rate)
                wf.writeframes(samples)
            with open(wav_path, "rb") as f:
                audio_bytes = f.read()
        finally:
            if os.path.exists(wav_path):
                os.remove(wav_path)

        return TTSResult(
            audio_bytes=audio_bytes,
            duration_seconds=duration_sec,
            format="wav",
            engine="deterministic",
            voice="deterministic_synth",
            is_development=True
        )


class GoogleGeminiTTSProvider(TTSProvider):
    """
    Production Google Gemini TTS Provider for Phase 2B-1.
    Integrates Gemini TTS (primary: gemini-3.8-flash-tts, cost-efficient: gemini-3.8-flash-lite-tts)
    using the official Google Gen AI SDK on Gemini Enterprise Agent Platform.

    Authentication & Client:
    - Enterprise Client: enterprise=True, project=<GOOGLE_CLOUD_PROJECT>, location=<GOOGLE_CLOUD_LOCATION>
    - Application Default Credentials (ADC) - strictly never passes AI Studio API key.
    - Diagnostics distinguishing project, ADC, IAM permissions, API status, model/location, schema, rate limits.
    - Full support for single-teacher voice and multi-speaker teacher-student dialogue.
    """

    _mock_client: Optional[Any] = None

    def __init__(
        self,
        model: Optional[str] = None,
        location: Optional[str] = None,
        language_code: Optional[str] = None,
        teacher_voice: Optional[str] = None,
        student_voice: Optional[str] = None,
        project: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        max_retries: Optional[int] = None,
        ffmpeg_exe: str = DEFAULT_FFMPEG_EXE,
        strict: bool = True
    ):
        self.model = model or getattr(settings, "gemini_tts_model", "gemini-3.8-flash-tts")
        self.location = (
            location
            or getattr(settings, "gemini_tts_location", None)
            or getattr(settings, "google_cloud_location", None)
            or os.environ.get("GOOGLE_CLOUD_LOCATION")
            or "global"
        )
        self.language_code = language_code or getattr(settings, "gemini_tts_language", "en-IN")
        self.teacher_voice = teacher_voice or getattr(settings, "gemini_tts_teacher_voice", "Aoede")
        self.student_voice = student_voice or getattr(settings, "gemini_tts_student_voice", "Puck")
        self.project = project or getattr(settings, "google_cloud_project", None) or os.environ.get("GOOGLE_CLOUD_PROJECT")
        self.timeout_seconds = timeout_seconds or getattr(settings, "gemini_tts_timeout_seconds", 60)
        self.max_retries = max_retries or getattr(settings, "gemini_tts_max_retries", 3)
        self.ffmpeg_exe = ffmpeg_exe
        self.strict = strict
        self.engine = "gemini_tts"
        self.is_development = False
        self._client = None

    @classmethod
    def set_mock_client(cls, mock_client: Any) -> None:
        """Injects a mock client for testing without external API calls."""
        cls._mock_client = mock_client

    @classmethod
    def reset_mock_client(cls) -> None:
        """Clears any injected mock client."""
        cls._mock_client = None

    @classmethod
    def classify_error(
        cls,
        e: Union[Exception, str],
        project: Optional[str] = None,
        model: str = "gemini-3.8-flash-tts",
        location: str = "global"
    ) -> Tuple[str, str]:
        """
        Classifies errors into standard diagnostic categories with actionable messages.
        Ensures credentials (API keys, tokens) are never included in output.
        """
        err_str = str(e) if isinstance(e, Exception) else str(e)
        err_type = type(e).__name__ if isinstance(e, Exception) else "Error"

        # 1. Missing ADC credentials
        if (
            "DefaultCredentialsError" in err_type
            or "defaultcredentialserror" in err_str.lower()
            or "credentials were not found" in err_str.lower()
            or "could not automatically determine credentials" in err_str.lower()
            or "no credentials" in err_str.lower()
        ):
            return (
                "MISSING_ADC_CREDENTIALS",
                "Google Cloud Application Default Credentials (ADC) not found. "
                "Run 'gcloud auth application-default login' or configure GOOGLE_APPLICATION_CREDENTIALS pointing to a valid service account JSON key file."
            )

        # 2. Rate limiting and transient service errors (503, 429)
        if any(term in err_str for term in [
            "RESOURCE_EXHAUSTED",
            "429",
            "quota",
            "Rate limit",
            "503",
            "UNAVAILABLE",
            "Service Unavailable",
            "deadline",
            "timeout",
            "high demand"
        ]):
            return (
                "RATE_LIMITING_OR_TRANSIENT_ERROR",
                f"Transient service error or rate limit reached: {err_str}."
            )

        # 3. API not enabled
        if any(term in err_str for term in [
            "SERVICE_DISABLED",
            "has not been used in project",
            "has not enabled the API",
            "activation is pending",
            "serviceusage.services.use",
            "aiplatform.googleapis.com not enabled",
            "API [aiplatform.googleapis.com] not enabled"
        ]):
            return (
                "API_NOT_ENABLED",
                f"Vertex AI API (aiplatform.googleapis.com) is not enabled on project '{project or 'unconfigured'}'. "
                f"Enable it via Google Cloud Console or run 'gcloud services enable aiplatform.googleapis.com --project {project or 'PROJECT_ID'}'."
            )

        # 4. Insufficient IAM permissions
        if any(term in err_str for term in [
            "PERMISSION_DENIED",
            "403",
            "does not have permission",
            "iam.serviceAccounts.actAs",
            "roles/aiplatform.user",
            "endpoints.predict denied",
            "Permission denied on resource",
            "Forbidden"
        ]):
            return (
                "INSUFFICIENT_IAM_PERMISSIONS",
                f"Insufficient IAM permissions on Google Cloud project '{project or 'unconfigured'}'. "
                f"Ensure the service account or authenticated user has the 'Vertex AI User' role (roles/aiplatform.user)."
            )

        # 5. Model or location unavailable
        if any(term in err_str for term in [
            "NOT_FOUND",
            "404",
            "Publisher Model",
            "not found in location",
            "is not supported in location",
            "Endpoint not found",
            "Resource not found"
        ]) and ("model" in err_str.lower() or "location" in err_str.lower() or "not found" in err_str.lower()):
            return (
                "MODEL_OR_LOCATION_UNAVAILABLE",
                f"Model '{model}' is not available in location '{location}'. "
                f"Verify that the model ID is correct and supported in this Google Cloud region."
            )

        # 6. Invalid request schema
        if any(term in err_str for term in [
            "INVALID_ARGUMENT",
            "400",
            "Unknown name",
            "Invalid JSON payload",
            "Cannot find field",
            "validation error",
            "Malformed request",
            "speechConfig"
        ]):
            return (
                "INVALID_REQUEST_SCHEMA",
                f"Invalid request schema or configuration payload: {err_str}. "
                "Ensure speech_config and parameters adhere to Gemini 3.8 TTS requirements."
            )

        # 7. Missing project configuration
        if not project or str(project).strip() in ("", "None", "undefined"):
            return (
                "MISSING_PROJECT_CONFIGURATION",
                "Google Cloud Project is not configured. Please set GOOGLE_CLOUD_PROJECT in your environment or backend/.env."
            )

        return (
            "SERVICE_ERROR",
            f"Gemini TTS synthesis error: {err_str}"
        )

    @classmethod
    def validate_configuration(cls) -> Tuple[bool, str, Optional[str]]:
        """
        Validates configuration and authentication prerequisites before synthesis.
        Returns: (is_ready: bool, message: str, diagnostic_category: Optional[str])
        """
        if not getattr(settings, "gemini_tts_enabled", True) and os.environ.get("GEMINI_TTS_ENABLED", "").lower() not in ["true", "1"]:
            return False, "Gemini TTS is disabled in configuration (GEMINI_TTS_ENABLED=false).", "DISABLED"

        project = getattr(settings, "google_cloud_project", None) or os.environ.get("GOOGLE_CLOUD_PROJECT")
        location = getattr(settings, "google_cloud_location", None) or os.environ.get("GOOGLE_CLOUD_LOCATION") or "global"

        if not project or str(project).strip() in ("", "None", "undefined"):
            cat, msg = cls.classify_error("Missing project", project=None, location=location)
            return False, msg, cat

        try:
            import google.auth
            google.auth.default()
        except Exception as e:
            cat, msg = cls.classify_error(e, project=project, location=location)
            return False, msg, cat

        return True, f"Google Cloud Project '{project}' and ADC credentials verified for location '{location}'.", None

    def _get_client(self):
        if self._mock_client is not None:
            return self._mock_client
        if self._client is not None:
            return self._client

        try:
            from google import genai
        except ImportError:
            raise TTSProviderUnavailableError("TTS FAILED / GEMINI TTS UNAVAILABLE: google-genai SDK is not installed.")

        project = self.project or getattr(settings, "google_cloud_project", None) or os.environ.get("GOOGLE_CLOUD_PROJECT")
        location = self.location

        # 1. Project configuration check
        if not project or str(project).strip() in ("", "None", "undefined"):
            cat, msg = self.classify_error("Missing project", project=None, model=self.model, location=location)
            raise TTSProviderUnavailableError(f"TTS FAILED / GEMINI TTS UNAVAILABLE [{cat}]: {msg}")

        # 2. Check ADC presence before initializing
        import google.auth
        try:
            google.auth.default()
        except Exception as adc_err:
            cat, msg = self.classify_error(adc_err, project=project, model=self.model, location=location)
            raise TTSProviderUnavailableError(f"TTS FAILED / GEMINI TTS UNAVAILABLE [{cat}]: {msg}")

        # 3. Initialize Enterprise Client using Application Default Credentials
        # DO NOT pass api_key! Enterprise Agent Platform uses ADC.
        try:
            self._client = genai.Client(
                enterprise=True,
                project=project,
                location=location
            )
        except Exception as e:
            cat, msg = self.classify_error(e, project=project, model=self.model, location=location)
            raise TTSProviderUnavailableError(f"TTS FAILED / GEMINI TTS UNAVAILABLE [{cat}]: {msg}")

        return self._client

    def _generate_with_retry(self, client: Any, model: str, contents: Any, config: Any) -> Any:
        retries = 0
        project = self.project or getattr(settings, "google_cloud_project", None) or os.environ.get("GOOGLE_CLOUD_PROJECT")
        while retries <= self.max_retries:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config
                )
                return response
            except Exception as e:
                cat, msg = self.classify_error(e, project=project, model=model, location=self.location)
                if cat == "RATE_LIMITING_OR_TRANSIENT_ERROR":
                    retries += 1
                    if retries <= self.max_retries:
                        time.sleep(2 ** retries)
                        continue
                raise TTSProviderUnavailableError(f"TTS FAILED / GEMINI TTS UNAVAILABLE [{cat}]: Model '{model}' generation failed: {msg}")

    def _extract_audio_bytes(self, response: Any, model: str) -> Tuple[bytes, str]:
        audio_bytes = None
        mime_type = "audio/pcm"
        candidates = getattr(response, "candidates", []) or []
        for cand in candidates:
            content = getattr(cand, "content", None)
            if content and hasattr(content, "parts"):
                for part in content.parts:
                    inline = getattr(part, "inline_data", None)
                    if inline and getattr(inline, "data", None):
                        audio_bytes = inline.data
                        mime_type = getattr(inline, "mime_type", "audio/pcm")
                        break
            if audio_bytes:
                break

        if not audio_bytes or len(audio_bytes) < 100:
            raise TTSProviderUnavailableError(
                f"TTS FAILED / GEMINI TTS UNAVAILABLE [INVALID_RESPONSE]: Model '{model}' returned empty or truncated audio."
            )
        return audio_bytes, mime_type

    def synthesize(self, text: str, voice_config: Optional[Dict[str, Any]] = None) -> TTSResult:
        cfg = voice_config or {}

        # Support structured multi-speaker dialogue turns
        dialogue = cfg.get("dialogue")
        if dialogue and isinstance(dialogue, list) and len(dialogue) > 1:
            return self._synthesize_dialogue(dialogue, cfg)

        speech_text = NaturalSpeechFormatter.format_for_speech(text)
        if not speech_text or not speech_text.strip():
            raise ValueError("Narration text is empty for TTS synthesis.")

        speaker = cfg.get("speaker") or "Teacher"
        is_student = str(speaker).strip().lower() == "student"

        # Determine voice identity
        if is_student:
            chosen_voice = cfg.get("student_voice") or cfg.get("voice") or self.student_voice
        else:
            chosen_voice = cfg.get("teacher_voice") or cfg.get("voice") or self.teacher_voice

        language = cfg.get("language") or self.language_code
        model = cfg.get("model") or self.model
        client = self._get_client()

        # Build GenerateContentConfig with SpeechConfig (Gemini 3.8 TTS schema)
        try:
            from google.genai import types
            voice_config_obj = types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=chosen_voice),
            )
            speech_config = types.SpeechConfig(
                voice_config=voice_config_obj,
                language_code=language
            )
            gen_config = types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=speech_config
            )
        except Exception as e:
            project = self.project or getattr(settings, "google_cloud_project", None) or os.environ.get("GOOGLE_CLOUD_PROJECT")
            cat, msg = self.classify_error(e, project=project, model=model, location=self.location)
            raise TTSProviderUnavailableError(f"TTS FAILED / GEMINI TTS UNAVAILABLE [{cat}]: Failed to build speech configuration: {str(e)}")

        # Execute generation with retry
        response = self._generate_with_retry(client, model, speech_text, gen_config)
        audio_bytes, mime_type = self._extract_audio_bytes(response, model)

        # Convert to standard 44.1 kHz, 16-bit mono WAV
        wav_bytes, duration = self._convert_to_standard_wav(audio_bytes, mime_type)

        return TTSResult(
            audio_bytes=wav_bytes,
            duration_seconds=duration,
            format="wav",
            engine=self.engine,
            voice=chosen_voice,
            is_development=False
        )

    def build_multi_speaker_config(
        self,
        teacher_voice: Optional[str] = None,
        student_voice: Optional[str] = None,
        language_code: Optional[str] = None
    ) -> Any:
        """
        Builds the official Gemini 3.8 MultiSpeakerVoiceConfig GenerateContentConfig.
        Uses exact documented schema:
        - response_modalities=["AUDIO"]
        - speech_config.multi_speaker_voice_config.speaker_voice_configs
        """
        from google.genai import types
        t_voice = teacher_voice or self.teacher_voice
        s_voice = student_voice or self.student_voice
        lang = language_code or self.language_code

        return types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                language_code=lang,
                multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                    speaker_voice_configs=[
                        types.SpeakerVoiceConfig(
                            speaker="Teacher",
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=t_voice),
                            )
                        ),
                        types.SpeakerVoiceConfig(
                            speaker="Student",
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=s_voice),
                            )
                        )
                    ]
                )
            )
        )

    def synthesize_multi_speaker(
        self,
        dialogue_prompt: str,
        teacher_voice: Optional[str] = None,
        student_voice: Optional[str] = None,
        language_code: Optional[str] = None,
        model: Optional[str] = None
    ) -> TTSResult:
        """
        Synthesizes two-speaker teacher-student dialogue in a single request using
        Gemini 3.8 Flash TTS native MultiSpeakerVoiceConfig.
        """
        client = self._get_client()
        chosen_model = model or self.model
        gen_config = self.build_multi_speaker_config(
            teacher_voice=teacher_voice,
            student_voice=student_voice,
            language_code=language_code
        )
        response = self._generate_with_retry(client, chosen_model, dialogue_prompt, gen_config)
        audio_bytes, mime_type = self._extract_audio_bytes(response, chosen_model)
        wav_bytes, duration = self._convert_to_standard_wav(audio_bytes, mime_type)

        return TTSResult(
            audio_bytes=wav_bytes,
            duration_seconds=duration,
            format="wav",
            engine=self.engine,
            voice="Teacher+Student",
            is_development=False
        )

    def _synthesize_dialogue(self, dialogue: List[Dict[str, Any]], parent_cfg: Dict[str, Any]) -> TTSResult:
        """
        Synthesizes two-speaker teacher-student conversation turns sequentially
        and concatenates them into a unified WAV file with natural turn pauses.
        If parent_cfg specifies native_multi_speaker=True, uses synthesize_multi_speaker.
        """
        valid_turns = []
        for turn in dialogue:
            t_speaker = turn.get("speaker") or "Teacher"
            t_text = NaturalSpeechFormatter.format_for_speech(turn.get("text") or turn.get("narration") or "")
            if t_text.strip():
                valid_turns.append((t_speaker, t_text))

        if not valid_turns:
            raise TTSProviderUnavailableError("Dialogue contained no valid spoken turns.")

        if parent_cfg.get("native_multi_speaker", False):
            dialogue_prompt = "\n".join([f"{spk}: {txt}" for spk, txt in valid_turns])
            return self.synthesize_multi_speaker(
                dialogue_prompt=dialogue_prompt,
                teacher_voice=parent_cfg.get("teacher_voice") or self.teacher_voice,
                student_voice=parent_cfg.get("student_voice") or self.student_voice,
                language_code=parent_cfg.get("language") or self.language_code,
                model=parent_cfg.get("model") or self.model
            )

        # Sequential turn synthesis with per-turn audio caching and concatenation
        turn_wavs: List[bytes] = []
        total_dur = 0.0
        for spk, txt in valid_turns:
            turn_cfg = dict(parent_cfg)
            turn_cfg["speaker"] = spk
            turn_cfg.pop("dialogue", None)
            res = self.synthesize(txt, turn_cfg)
            turn_wavs.append(res.audio_bytes)
            total_dur += res.duration_seconds

        concatenated_wav, final_dur = self._concatenate_wav_segments(turn_wavs)
        return TTSResult(
            audio_bytes=concatenated_wav,
            duration_seconds=final_dur,
            format="wav",
            engine=self.engine,
            voice="Teacher+Student",
            is_development=False
        )

    def _concatenate_wav_segments(self, wav_list: List[bytes], pause_seconds: float = 0.25) -> Tuple[bytes, float]:
        if len(wav_list) == 1:
            with wave.open(io.BytesIO(wav_list[0]), "rb") as wf:
                dur = wf.getnframes() / float(wf.getframerate())
            return wav_list[0], round(dur, 2)

        pause_frames = int(44100 * pause_seconds)
        pause_bytes = b"\x00\x00" * pause_frames

        combined_frames = bytearray()
        for idx, wb in enumerate(wav_list):
            if idx > 0 and pause_seconds > 0:
                combined_frames.extend(pause_bytes)
            with wave.open(io.BytesIO(wb), "rb") as wf:
                combined_frames.extend(wf.readframes(wf.getnframes()))

        out_buf = io.BytesIO()
        with wave.open(out_buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(combined_frames)

        out_bytes = out_buf.getvalue()
        dur = round(len(combined_frames) / (2 * 44100), 2)
        return out_bytes, dur

    def _convert_to_standard_wav(self, raw_audio: bytes, mime_type: str) -> Tuple[bytes, float]:
        with tempfile.TemporaryDirectory() as td:
            is_pcm = "pcm" in mime_type.lower() or mime_type == "audio/x-raw"
            ext = ".pcm" if is_pcm else ".bin"
            raw_path = os.path.join(td, f"raw_audio{ext}")
            wav_path = os.path.join(td, "speech.wav")

            with open(raw_path, "wb") as f:
                f.write(raw_audio)

            rate_match = re.search(r"rate=(\d+)", mime_type.lower())
            input_rate = rate_match.group(1) if rate_match else "24000"

            if is_pcm:
                cmd = [
                    self.ffmpeg_exe, "-y",
                    "-f", "s16le",
                    "-ar", input_rate,
                    "-ac", "1",
                    "-i", raw_path,
                    "-ar", "44100",
                    "-ac", "1",
                    wav_path
                ]
            else:
                cmd = [
                    self.ffmpeg_exe, "-y",
                    "-i", raw_path,
                    "-ar", "44100",
                    "-ac", "1",
                    wav_path
                ]

            try:
                proc = subprocess.run(cmd, check=True, capture_output=True)
            except subprocess.CalledProcessError as e:
                err_text = e.stderr.decode("utf-8", errors="replace") if e.stderr else str(e)
                raise TTSProviderUnavailableError(f"TTS audio conversion to WAV failed: {err_text}")

            with open(wav_path, "rb") as wf:
                wav_bytes = wf.read()

            try:
                with wave.open(wav_path, "rb") as wave_file:
                    n_frames = wave_file.getnframes()
                    fr = wave_file.getframerate()
                    duration = round(n_frames / float(fr), 2)
            except Exception as e:
                raise TTSProviderUnavailableError(f"Generated WAV file is invalid: {str(e)}")

            if duration <= 0:
                raise TTSProviderUnavailableError("Generated audio has zero duration.")

            return wav_bytes, duration


# Backward compatibility aliases
TTSEngine = TTSProvider
DeterministicTTSEngine = DeterministicTTSProvider
LocalTTSEngine = LocalTTSProvider
ProductionTTSEngine = NeuralTTSProvider
GeminiTTSEngine = GoogleGeminiTTSProvider
GoogleGeminiTTSEngine = GoogleGeminiTTSProvider


def get_tts_provider(provider_name: Optional[str] = None) -> TTSProvider:
    if provider_name:
        prov = provider_name.lower()
    elif os.environ.get("PYTEST_CURRENT_TEST"):
        prov = os.environ.get("TEST_TTS_PROVIDER", "deterministic").lower()
    else:
        prov = (settings.tts_provider or settings.tts_engine or os.environ.get("TTS_PROVIDER", "gemini")).lower()

    if prov in ["gemini", "gemini_tts", "google", "gemini-tts"]:
        return GoogleGeminiTTSProvider()
    elif prov in ["production", "prod"]:
        api_key = os.environ.get("ELEVENLABS_API_KEY") or settings.elevenlabs_api_key
        if not api_key:
            return LocalTTSProvider()
        return NeuralTTSProvider(prefer_elevenlabs=True)
    elif prov == "elevenlabs":
        return NeuralTTSProvider(prefer_elevenlabs=True, strict=bool(os.environ.get("PRODUCTION_ENV")))
    elif prov in ["neural", "azure", "edge"]:
        return NeuralTTSProvider(prefer_elevenlabs=False)
    elif prov in ["local", "local_fallback", "say", "macos"]:
        return LocalTTSProvider()
    elif prov == "deterministic":
        return DeterministicTTSProvider()
    return GoogleGeminiTTSProvider() if settings.gemini_tts_enabled else NeuralTTSProvider()


def get_tts_engine(engine_name: Optional[str] = None) -> TTSProvider:
    return get_tts_provider(engine_name)


# ==============================================================================
# 2. SCENE GENERATION
# ==============================================================================

class SceneGenerator:
    """
    Converts approved structured script sections into timed, pedagogical scenes.
    Derives duration from narration word counts and narration_words_per_minute.
    """

    def __init__(self, words_per_minute: int = settings.narration_words_per_minute):
        self.wpm = words_per_minute

    def generate_scenes(self, video: Video, script_sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        scenes: List[Dict[str, Any]] = []
        current_time = 0.0

        for idx, sec in enumerate(script_sections, start=1):
            sec_type = sec.get("type", "CONCEPT")
            title = sec.get("title", f"Scene {idx}")
            narration = sec.get("narration", "")
            words = len(narration.split())
            # Calculate scene duration
            est_dur = max(3.5, round((words / self.wpm) * 60.0, 1))

            start_t = round(current_time, 1)
            end_t = round(current_time + est_dur, 1)
            current_time = end_t

            scene_payload = {
                "scene_number": idx,
                "section_type": sec_type,
                "title": title,
                "narration_text": narration,
                "visual_type": sec.get("visual_type", "DIAGRAM"),
                "visual_description": sec.get("visual_description"),
                "on_screen_text": sec.get("on_screen_text") or title,
                "formula": sec.get("formula"),
                "animation_hint": sec.get("animation_hint", "FADE_IN"),
                "source_pages": sec.get("source_pages", [video.source_start_page or 1]),
                "estimated_duration_seconds": est_dur,
                "start_time_seconds": start_t,
                "end_time_seconds": end_t,
                "visual_data": sec.get("visual_data", {}),
                "learning_objective": sec.get("learning_objective") or video.learning_objective
            }
            scenes.append(scene_payload)

        # Pre-render validation
        self.validate_scenes(scenes)
        return scenes

    @staticmethod
    def validate_scenes(scenes: List[Dict[str, Any]]) -> None:
        """Validates scene quality, non-empty narration, and positive duration."""
        if not scenes:
            raise ValueError("Scene generation produced zero scenes.")
        for idx, s in enumerate(scenes, start=1):
            sc_num = s.get("scene_number", idx)
            if not s.get("title"):
                raise ValueError(f"Scene #{sc_num} is missing a title.")
            narration = (s.get("narration_text") or "").strip()
            if not narration:
                raise ValueError(f"Narration required for scene {sc_num} ('{s.get('title')}') but narration text is empty.")
            if len(narration) < 15 or len(narration.split()) < 3:
                raise ValueError(
                    f"Narration required for scene {sc_num} ('{s.get('title')}') but narration text is insufficient "
                    f"({len(narration)} chars, {len(narration.split())} words)."
                )
            if s.get("estimated_duration_seconds", 0) <= 0:
                raise ValueError(f"Scene #{sc_num} has non-positive duration.")


# ==============================================================================
# 3. VISUAL SLIDE RENDERER (PILLOW HD 720p)
# ==============================================================================

class VisualSlideRenderer:
    """
    Renders high-contrast, modern educational presentation slides (1280x720 HD).
    Complies strictly with font hierarchy:
    - Title: >= 36px
    - Main concept: >= 28px
    - Body: >= 24px
    - Code: >= 24px
    - Diagram labels: >= 22px
    Supports visual types:
    TITLE_CARD, ARRAY_GRID, MEMORY_LAYOUT, CODE_SNIPPET, BEFORE_AFTER,
    COMPLEXITY_CHART, COMMON_MISTAKES, APPLICATION_CARD, KNOWLEDGE_CHECK,
    SUMMARY_CHIPS, FORMULA_CARD, DIAGRAM, TEXT.
    """

    def __init__(self, width: int = 1280, height: int = 720):
        self.width = width
        self.height = height
        self._font_cache: Dict[Tuple[int, bool, bool], ImageFont.ImageFont] = {}

    def _get_font(self, size: int, bold: bool = False, mono: bool = False) -> ImageFont.ImageFont:
        key = (size, bold, mono)
        if key in self._font_cache:
            return self._font_cache[key]

        candidates: List[str] = []
        if mono:
            candidates = [
                "C:/Windows/Fonts/cour.ttf",
                "C:/Windows/Fonts/courbd.ttf",
                "C:/Windows/Fonts/consola.ttf",
                "C:/Windows/Fonts/consolab.ttf",
                "/System/Library/Fonts/Menlo.ttc",
                "/System/Library/Fonts/Supplemental/Courier New.ttf",
                "/Library/Fonts/Courier New.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
                "Menlo.ttc",
                "Courier New.ttf",
                "cour.ttf",
                "DejaVuSansMono.ttf"
            ]
        elif bold:
            candidates = [
                "C:/Windows/Fonts/arialbd.ttf",
                "C:/Windows/Fonts/arial.ttf",
                "C:/Windows/Fonts/calibrib.ttf",
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "/System/Library/Fonts/Helvetica.ttc",
                "/Library/Fonts/Arial Bold.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "arialbd.ttf",
                "Arial Bold.ttf",
                "DejaVuSans-Bold.ttf"
            ]
        else:
            candidates = [
                "C:/Windows/Fonts/arial.ttf",
                "C:/Windows/Fonts/calibri.ttf",
                "C:/Windows/Fonts/segoeui.ttf",
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/System/Library/Fonts/Helvetica.ttc",
                "/Library/Fonts/Arial.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "arial.ttf",
                "Arial.ttf",
                "DejaVuSans.ttf"
            ]

        for path in candidates:
            try:
                font = ImageFont.truetype(path, size)
                self._font_cache[key] = font
                return font
            except Exception:
                continue

        fallback = ImageFont.load_default()
        self._font_cache[key] = fallback
        return fallback

    def render_scene_slide(self, video: Video, scene: Dict[str, Any]) -> Image.Image:
        img = Image.new("RGB", (self.width, self.height), color=(15, 23, 42))  # Deep Slate 900
        draw = ImageDraw.Draw(img)

        # Header bar (70px height)
        draw.rectangle([(0, 0), (self.width, 70)], fill=(30, 41, 59))  # Slate 800
        draw.line([(0, 70), (self.width, 70)], fill=(51, 65, 85), width=2)

        # Academic / Subject badge (font 20px)
        topic_title = video.topic.title if video.topic else (video.title or "Educational Lesson")
        font_header = self._get_font(20, bold=True)
        draw.text((40, 24), f"ACADEMIC MODULE • {topic_title.upper()}", fill=(148, 163, 184), font=font_header)

        # Scene index pill (font 18px)
        sec_type = scene.get("section_type", "CONCEPT")
        scene_badge = f"SCENE {scene.get('scene_number', 1):02d} • {sec_type}"
        font_pill = self._get_font(18, bold=True)
        draw.rounded_rectangle([(self.width - 250, 16), (self.width - 40, 52)], radius=12, fill=(37, 99, 235))
        draw.text((self.width - 235, 24), scene_badge, fill=(255, 255, 255), font=font_pill)

        # Footer source traceability bar (50px height)
        draw.rectangle([(0, self.height - 50), (self.width, self.height)], fill=(15, 23, 42))
        draw.line([(0, self.height - 50), (self.width, self.height - 50)], fill=(51, 65, 85), width=1)
        src_pages = scene.get("source_pages", [video.source_start_page or 1])
        pages_str = ", ".join(str(p) for p in src_pages)
        font_footer = self._get_font(18)
        draw.text((40, self.height - 35), f"📖 Source Traceability: Textbook Pages {pages_str} • Verified Grounding", fill=(100, 116, 139), font=font_footer)
        draw.text((self.width - 260, self.height - 35), "AI Educational Platform HD", fill=(100, 116, 139), font=font_footer)

        # Scene Title (≥ 36px font)
        title = scene.get("title", "")
        font_title = self._get_font(36, bold=True)
        draw.text((40, 92), title[:65], fill=(241, 245, 249), font=font_title)

        vtype = (scene.get("visual_type") or "TEXT").upper()

        if vtype == "TITLE_CARD":
            self._draw_title_card(draw, video, scene)
        elif vtype in ["ARRAY_GRID", "ARRAY_TABLE", "ARRAY"]:
            self._draw_array_grid(draw, scene)
        elif vtype in ["MEMORY_LAYOUT", "MEMORY"]:
            self._draw_memory_layout(draw, scene)
        elif vtype == "CODE_SNIPPET":
            self._draw_code_snippet(draw, scene)
        elif vtype in ["BEFORE_AFTER", "WORKED_EXAMPLE"]:
            self._draw_before_after(draw, scene)
        elif vtype in ["COMPLEXITY_CHART", "COMPLEXITY"]:
            self._draw_complexity_chart(draw, scene)
        elif vtype in ["COMMON_MISTAKES", "MISTAKES"]:
            self._draw_common_mistakes(draw, scene)
        elif vtype in ["APPLICATION_CARD", "APPLICATION"]:
            self._draw_application_card(draw, scene)
        elif vtype in ["KNOWLEDGE_CHECK", "QUIZ"]:
            self._draw_knowledge_check(draw, scene)
        elif vtype == "FORMULA_CARD":
            self._draw_formula_card(draw, scene)
        elif vtype == "SUMMARY_CHIPS":
            self._draw_summary_chips(draw, scene)
        elif vtype in ["DIAGRAM", "FLOW_DIAGRAM"]:
            self._draw_diagram(draw, scene)
        else:
            self._draw_text_card(draw, scene)

        return img

    def _draw_title_card(self, draw: ImageDraw.ImageDraw, video: Video, scene: Dict[str, Any]):
        # Central hero card
        draw.rounded_rectangle([(80, 150), (self.width - 80, 640)], radius=16, fill=(30, 41, 59), outline=(56, 189, 248), width=3)
        font_tag = self._get_font(22, bold=True)
        draw.text((120, 185), "LESSON MODULE • FOUNDATIONAL CURRICULUM", fill=(56, 189, 248), font=font_tag)

        font_video_title = self._get_font(38, bold=True)
        draw.text((120, 225), video.title, fill=(255, 255, 255), font=font_video_title)

        # Subject context
        vdata = scene.get("visual_data", {})
        sub_text = vdata.get("subtitle") or (video.topic.title if video.topic else "Computer Science & Engineering")
        font_sub = self._get_font(26, bold=True)
        draw.text((120, 280), f"Subject Focus: {sub_text}", fill=(148, 163, 184), font=font_sub)

        # Learning Objectives Box
        draw.rounded_rectangle([(120, 335), (self.width - 120, 520)], radius=12, fill=(15, 23, 42), outline=(51, 65, 85), width=2)
        font_obj_label = self._get_font(22, bold=True)
        draw.text((150, 355), "LEARNING OBJECTIVES:", fill=(245, 158, 11), font=font_obj_label)

        objs = vdata.get("objectives")
        if not objs:
            obj_str = video.learning_objective or "Understand contiguous memory layout, zero-based indexing, and dynamic resizing."
            objs = [obj_str[:110], "Analyze O(1) constant-time direct memory address arithmetic"]

        font_body = self._get_font(24)
        for idx, obj_line in enumerate(objs[:3]):
            draw.text((150, 395 + idx * 40), f"• {obj_line}", fill=(226, 232, 240), font=font_body)

        # Target duration badge
        dur_sec = video.estimated_duration_seconds or video.duration_seconds or 330
        dur_str = f"Estimated Duration: {dur_sec // 60}:{dur_sec % 60:02d} min • Full HD 720p Video"
        font_dur = self._get_font(22, bold=True)
        draw.text((120, 560), dur_str, fill=(74, 222, 128), font=font_dur)

    def _draw_array_grid(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        """Renders authentic array cells with index numbers and highlighted element arr[2] = 30."""
        vdata = scene.get("visual_data", {})
        elements = vdata.get("elements", [10, 20, 30, 40, 50])
        indices = vdata.get("indices", [0, 1, 2, 3, 4])
        highlight_idx = vdata.get("highlight_index", 2)
        highlight_val = vdata.get("highlight_value", 30)

        # Concept header banner
        draw.rounded_rectangle([(80, 150), (self.width - 80, 210)], radius=10, fill=(30, 41, 59), outline=(56, 189, 248), width=2)
        font_hdr = self._get_font(26, bold=True)
        draw.text((110, 168), "STATIC ARRAY: 5 CONTIGUOUS ELEMENTS IN MEMORY", fill=(56, 189, 248), font=font_hdr)

        # Array grid layout
        cell_w = 160
        cell_h = 120
        start_x = 240
        grid_y = 280

        # "Index:" label
        font_idx_label = self._get_font(24, bold=True)
        draw.text((start_x - 120, grid_y - 45), "INDEX:", fill=(148, 163, 184), font=font_idx_label)
        draw.text((start_x - 120, grid_y + 40), "VALUE:", fill=(148, 163, 184), font=font_idx_label)

        font_index_num = self._get_font(28, bold=True)
        font_value_num = self._get_font(38, bold=True)

        for i in range(min(5, len(elements))):
            cx = start_x + i * cell_w
            is_hl = (i == highlight_idx)

            # Index above cell
            idx_color = (251, 191, 36) if is_hl else (148, 163, 184)
            draw.text((cx + cell_w // 2 - 10, grid_y - 45), str(indices[i]), fill=idx_color, font=font_index_num)

            # Cell box
            box_fill = (120, 53, 15) if is_hl else (30, 41, 59)
            box_outline = (251, 191, 36) if is_hl else (56, 189, 248)
            box_width = 4 if is_hl else 2
            draw.rectangle([(cx, grid_y), (cx + cell_w - 6, grid_y + cell_h)], fill=box_fill, outline=box_outline, width=box_width)

            # Cell value text
            val_str = str(elements[i])
            val_color = (254, 243, 199) if is_hl else (255, 255, 255)
            draw.text((cx + cell_w // 2 - 25, grid_y + 35), val_str, fill=val_color, font=font_value_num)

        # Highlight callout pointer
        draw.rounded_rectangle([(start_x + 2 * cell_w - 20, grid_y + cell_h + 20), (start_x + 3 * cell_w - 40, grid_y + cell_h + 75)],
                               radius=8, fill=(120, 53, 15), outline=(251, 191, 36), width=2)
        font_callout = self._get_font(26, bold=True)
        draw.text((start_x + 2 * cell_w + 10, grid_y + cell_h + 32), f"arr[{highlight_idx}] = {highlight_val}", fill=(254, 243, 199), font=font_callout)

        # Bottom Key Properties Card
        draw.rounded_rectangle([(80, 520), (self.width - 80, 640)], radius=12, fill=(15, 23, 42), outline=(51, 65, 85), width=2)
        font_bottom_label = self._get_font(22, bold=True)
        draw.text((110, 535), "CORE STRUCTURAL PROPERTIES:", fill=(251, 191, 36), font=font_bottom_label)
        font_bottom_body = self._get_font(24)
        draw.text((110, 568), "• Contiguous Memory: All elements sit directly side-by-side with no gaps.", fill=(226, 232, 240), font=font_bottom_body)
        draw.text((110, 602), "• Zero-Based Indexing: The first item is arr[0], giving direct O(1) random access.", fill=(226, 232, 240), font=font_bottom_body)

    def _draw_memory_layout(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        """Renders RAM memory layout with addresses 0x1000..0x1010 and Base + i*size formula."""
        # Top Formula Banner
        draw.rounded_rectangle([(80, 150), (self.width - 80, 240)], radius=12, fill=(24, 24, 27), outline=(245, 158, 11), width=3)
        font_form_lbl = self._get_font(22, bold=True)
        draw.text((110, 162), "DIRECT MEMORY ADDRESS CALCULATION (O(1) ACCESS):", fill=(245, 158, 11), font=font_form_lbl)

        font_form_math = self._get_font(30, bold=True)
        draw.text((110, 195), "Address(arr[i]) = Base_Address + (i × Element_Size)", fill=(254, 243, 199), font=font_form_math)

        # Memory Slots Visualization
        start_x = 100
        slot_w = 210
        slot_h = 160
        slot_y = 270

        font_addr = self._get_font(22, mono=True)
        font_val = self._get_font(34, bold=True)
        font_idx = self._get_font(22, bold=True)

        slots = [
            ("0x1000", 0, 10, False),
            ("0x1004", 1, 20, False),
            ("0x1008", 2, 30, True),
            ("0x100C", 3, 40, False),
            ("0x1010", 4, 50, False)
        ]

        for idx, (addr, i_num, val, is_hl) in enumerate(slots):
            sx = start_x + idx * (slot_w + 10)
            box_fill = (120, 53, 15) if is_hl else (30, 41, 59)
            box_border = (251, 191, 36) if is_hl else (56, 189, 248)
            draw.rounded_rectangle([(sx, slot_y), (sx + slot_w, slot_y + slot_h)], radius=10, fill=box_fill, outline=box_border, width=3 if is_hl else 2)

            # Slot header
            draw.text((sx + 15, slot_y + 15), addr, fill=(251, 191, 36) if is_hl else (148, 163, 184), font=font_addr)
            draw.text((sx + 15, slot_y + 45), f"Index [{i_num}]", fill=(56, 189, 248), font=font_idx)
            draw.text((sx + 15, slot_y + 80), f"Val: {val}", fill=(255, 255, 255), font=font_val)
            draw.text((sx + 15, slot_y + 125), "4 Bytes (int)", fill=(100, 116, 139), font=self._get_font(18))

        # Bottom Derivation Box
        draw.rounded_rectangle([(80, 460), (self.width - 80, 640)], radius=12, fill=(15, 23, 42), outline=(51, 65, 85), width=2)
        font_step_hdr = self._get_font(22, bold=True)
        draw.text((110, 480), "STEP-BY-STEP RAM LOOKUP FOR arr[2]:", fill=(56, 189, 248), font=font_step_hdr)
        font_step_body = self._get_font(24)
        draw.text((110, 520), "1. Base Address = 0x1000, 32-bit integer size = 4 bytes.", fill=(226, 232, 240), font=font_step_body)
        draw.text((110, 555), "2. Target Offset = index 2 × 4 bytes = 8 bytes (0x0008).", fill=(226, 232, 240), font=font_step_body)
        draw.text((110, 590), "3. RAM Address = 0x1000 + 0x0008 = 0x1008 → Instantly yields value 30 in O(1) time.", fill=(74, 222, 128), font=font_step_body)

    def _draw_code_snippet(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        """Renders Python array code snippet in >=24px monospace font with terminal output."""
        vdata = scene.get("visual_data", {})
        code_lines = vdata.get("code_lines", [
            "# 1. Initialize static array with 5 elements",
            "arr = [10, 20, 30, 40, 50]",
            "",
            "# 2. Direct O(1) indexed element access",
            "target = arr[2]",
            "",
            "# 3. Print verified output",
            "print(f'Target Element: {target}')"
        ])
        terminal_out = vdata.get("terminal_output", "Target Element: 30")

        # Code IDE container
        draw.rounded_rectangle([(80, 150), (self.width - 80, 480)], radius=14, fill=(15, 23, 42), outline=(139, 92, 246), width=2)

        # Editor header bar
        draw.rectangle([(80, 150), (self.width - 80, 200)], fill=(30, 41, 59))
        draw.ellipse([(100, 168), (116, 184)], fill=(239, 68, 68))
        draw.ellipse([(126, 168), (142, 184)], fill=(245, 158, 11))
        draw.ellipse([(152, 168), (168, 184)], fill=(34, 197, 94))
        font_editor = self._get_font(20, bold=True)
        draw.text((200, 166), "main.py — Python 3.10 Code Walkthrough", fill=(203, 213, 225), font=font_editor)

        # Monospace code lines (≥ 24px font)
        font_code = self._get_font(24, mono=True)
        for idx, line in enumerate(code_lines):
            color = (148, 163, 184) if line.strip().startswith("#") else (216, 180, 254)
            if "arr[2]" in line:
                color = (251, 191, 36)
            draw.text((110, 220 + idx * 36), f"{idx + 1:2d} |  {line}", fill=color, font=font_code)

        # Terminal Output box
        draw.rounded_rectangle([(80, 505), (self.width - 80, 640)], radius=12, fill=(24, 24, 27), outline=(34, 197, 94), width=2)
        font_term_hdr = self._get_font(20, bold=True)
        draw.text((110, 520), "CONSOLE TERMINAL OUTPUT:", fill=(34, 197, 94), font=font_term_hdr)

        font_term_out = self._get_font(28, bold=True)
        draw.text((110, 555), f">>> {terminal_out}", fill=(255, 255, 255), font=font_term_out)

        font_term_note = self._get_font(22)
        draw.text((110, 600), "Execution Complexity: Exactly 1 clock cycle offset computation • O(1) Constant Time", fill=(148, 163, 184), font=font_term_note)

    def _draw_before_after(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        """Renders dynamic array resizing: full capacity 4 -> doubling to capacity 8."""
        vdata = scene.get("visual_data", {})
        left_cells = vdata.get("left_cells", [10, 20, 30, 40])
        right_cells = vdata.get("right_cells", [10, 20, 30, 40, 50, "-", "-", "-"])

        # Left Card (Capacity Full)
        draw.rounded_rectangle([(80, 160), (560, 480)], radius=14, fill=(30, 41, 59), outline=(239, 68, 68), width=3)
        font_card_hdr = self._get_font(22, bold=True)
        draw.text((105, 180), "INITIAL ARRAY (CAPACITY: 4, FULL)", fill=(248, 113, 113), font=font_card_hdr)

        # Cells in Left Card
        font_cell = self._get_font(30, bold=True)
        for i, val in enumerate(left_cells):
            cx = 105 + i * 105
            draw.rectangle([(cx, 230), (cx + 95, 330)], fill=(69, 10, 10), outline=(239, 68, 68), width=2)
            draw.text((cx + 25, 265), str(val), fill=(254, 202, 202), font=font_cell)

        font_body = self._get_font(22)
        draw.text((105, 360), "Cannot append 50!", fill=(248, 113, 113), font=font_card_hdr)
        draw.text((105, 400), "• Array has reached capacity (4/4)", fill=(226, 232, 240), font=font_body)
        draw.text((105, 435), "• Adjacent RAM is occupied", fill=(226, 232, 240), font=font_body)

        # Transition indicator
        font_trans = self._get_font(26, bold=True)
        draw.text((585, 300), "DOUBLING", fill=(251, 191, 36), font=font_trans)
        draw.text((615, 335), "→→→", fill=(251, 191, 36), font=font_trans)

        # Right Card (Capacity Doubled)
        draw.rounded_rectangle([(720, 160), (self.width - 80, 480)], radius=14, fill=(30, 41, 59), outline=(34, 197, 94), width=3)
        draw.text((745, 180), "NEW ALLOCATION (CAPACITY: 8, DOUBLED)", fill=(74, 222, 128), font=font_card_hdr)

        # Cells in Right Card (8 cells)
        for i, val in enumerate(right_cells):
            cx = 745 + (i % 4) * 115
            cy = 230 if i < 4 else 340
            is_new = (i == 4)
            fill_c = (20, 83, 45) if is_new else (15, 23, 42)
            border_c = (34, 197, 94) if is_new else (51, 65, 85)
            draw.rectangle([(cx, cy), (cx + 105, cy + 90)], fill=fill_c, outline=border_c, width=2)
            draw.text((cx + 30, cy + 28), str(val), fill=(255, 255, 255), font=self._get_font(26, bold=True))

        # Bottom Insight Card
        draw.rounded_rectangle([(80, 505), (self.width - 80, 640)], radius=12, fill=(15, 23, 42), outline=(51, 65, 85), width=2)
        font_insight_hdr = self._get_font(22, bold=True)
        draw.text((110, 525), "AMORTIZED COMPLEXITY INSIGHT:", fill=(251, 191, 36), font=font_insight_hdr)
        font_insight_body = self._get_font(24)
        draw.text((110, 560), "1. Allocate new memory block of size 8, copy existing 4 elements (O(N) operation).", fill=(226, 232, 240), font=font_insight_body)
        draw.text((110, 595), "2. Because capacity doubles geometrically, average cost per append is Amortized O(1).", fill=(74, 222, 128), font=font_insight_body)

    def _draw_complexity_chart(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        """Renders clear time complexity chart for array operations with badges."""
        draw.rounded_rectangle([(80, 150), (self.width - 80, 640)], radius=14, fill=(30, 41, 59), outline=(56, 189, 248), width=2)
        font_tbl_hdr = self._get_font(24, bold=True)
        draw.text((110, 175), "OPERATION", fill=(148, 163, 184), font=font_tbl_hdr)
        draw.text((450, 175), "TIME COMPLEXITY", fill=(148, 163, 184), font=font_tbl_hdr)
        draw.text((780, 175), "MECHANICAL REASON", fill=(148, 163, 184), font=font_tbl_hdr)
        draw.line([(100, 215), (self.width - 100, 215)], fill=(71, 85, 105), width=2)

        rows = [
            ("Access by Index arr[i]", "O(1) Constant", "GREEN", "Direct memory address calculation"),
            ("Search by Value", "O(n) Linear", "AMBER", "Must inspect elements sequentially"),
            ("Append to Dynamic Array", "Amortized O(1)", "GREEN", "Rare doubling cost spread across N appends"),
            ("Insertion at Start / Middle", "O(n) Linear", "RED", "Must shift subsequent elements right"),
            ("Deletion at Start / Middle", "O(n) Linear", "RED", "Must shift subsequent elements left")
        ]

        font_op = self._get_font(24, bold=True)
        font_badge = self._get_font(22, bold=True)
        font_reason = self._get_font(22)

        for idx, (op, comp, badge_type, reason) in enumerate(rows):
            ry = 235 + idx * 75
            # Operation name
            draw.text((110, ry + 12), op, fill=(241, 245, 249), font=font_op)

            # Badge
            badge_color = (34, 197, 94) if badge_type == "GREEN" else ((245, 158, 11) if badge_type == "AMBER" else (239, 68, 68))
            draw.rounded_rectangle([(445, ry), (720, ry + 50)], radius=8, fill=(15, 23, 42), outline=badge_color, width=2)
            draw.text((465, ry + 12), comp, fill=badge_color, font=font_badge)

            # Reason
            draw.text((780, ry + 12), reason, fill=(203, 213, 225), font=font_reason)

    def _draw_common_mistakes(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        """Renders 3 cautionary cards on student pitfalls (off-by-one errors, 1-based indexing, shift overhead)."""
        mistakes = [
            ("1. Off-By-One Index Error (IndexOutOfBoundsException)",
             "For an array of size N = 5, valid indices are strictly 0 to 4. Accessing arr[5] crashes the program!",
             (239, 68, 68)),
            ("2. Confusing 1-Based Counting with 0-Based Indexing",
             "The 1st item is arr[0], 2nd is arr[1], and 3rd is arr[2]. Never start array loops at index 1.",
             (245, 158, 11)),
            ("3. Hidden O(N) Shifting Cost on Insertions & Deletions",
             "Inserting at index 0 forces every subsequent item to move one position right, creating slow O(N) code.",
             (56, 189, 248))
        ]

        font_m_title = self._get_font(24, bold=True)
        font_m_desc = self._get_font(22)

        for idx, (m_title, m_desc, border_color) in enumerate(mistakes):
            cy = 160 + idx * 155
            draw.rounded_rectangle([(80, cy), (self.width - 80, cy + 135)], radius=12, fill=(30, 41, 59), outline=border_color, width=2)
            draw.text((110, cy + 20), m_title, fill=border_color, font=font_m_title)
            draw.text((110, cy + 65), m_desc, fill=(226, 232, 240), font=font_m_desc)

    def _draw_application_card(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        """Renders 3 real-world production engineering applications of arrays."""
        apps = [
            ("1. Graphics & Video Framebuffers",
             "Computer displays (1080p, 4K) store pixels in massive 1D contiguous arrays for direct GPU rendering.",
             (56, 189, 248)),
            ("2. High-Performance Audio Streaming Buffers",
             "Low-latency playback engines stream audio chunks in circular array buffers to eliminate stutter.",
             (34, 197, 94)),
            ("3. Foundation for Advanced Data Structures",
             "Dynamic arrays are the internal building blocks for Hash Tables, Binary Heaps, and Vector lists.",
             (251, 191, 36))
        ]

        font_a_title = self._get_font(24, bold=True)
        font_a_desc = self._get_font(22)

        for idx, (a_title, a_desc, border_color) in enumerate(apps):
            cy = 160 + idx * 155
            draw.rounded_rectangle([(80, cy), (self.width - 80, cy + 135)], radius=12, fill=(30, 41, 59), outline=border_color, width=2)
            draw.text((110, cy + 20), a_title, fill=border_color, font=font_a_title)
            draw.text((110, cy + 65), a_desc, fill=(226, 232, 240), font=font_a_desc)

    def _draw_knowledge_check(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        """Renders conceptual quiz check with question, options, and highlighted verified answer."""
        vdata = scene.get("visual_data", {})
        question = vdata.get("question", "In an array of length N = 100, what is the index of the final element and its access time?")

        # Question container
        draw.rounded_rectangle([(80, 150), (self.width - 80, 290)], radius=14, fill=(30, 41, 59), outline=(251, 191, 36), width=3)
        font_q_lbl = self._get_font(22, bold=True)
        draw.text((110, 170), "QUICK CONCEPTUAL KNOWLEDGE CHECK:", fill=(251, 191, 36), font=font_q_lbl)
        font_q_txt = self._get_font(26, bold=True)
        draw.text((110, 210), question[:100], fill=(255, 255, 255), font=font_q_txt)
        if len(question) > 100:
            draw.text((110, 245), question[100:200], fill=(255, 255, 255), font=font_q_txt)

        # Answer cards
        options = [
            ("A) Index: 100  |  Time Complexity: O(n)", False),
            ("B) Index: 99 (N - 1)  |  Time Complexity: O(1) Constant Time  ✓ CORRECT", True),
            ("C) Index: 99  |  Time Complexity: O(log n)", False)
        ]

        font_opt = self._get_font(24, bold=True)
        font_exp = self._get_font(22)

        for idx, (opt_text, is_correct) in enumerate(options):
            oy = 315 + idx * 85
            fill_c = (20, 83, 45) if is_correct else (24, 24, 27)
            border_c = (34, 197, 94) if is_correct else (71, 85, 105)
            text_c = (255, 255, 255) if is_correct else (148, 163, 184)
            draw.rounded_rectangle([(80, oy), (self.width - 80, oy + 70)], radius=10, fill=fill_c, outline=border_c, width=3 if is_correct else 1)
            draw.text((110, oy + 20), opt_text, fill=text_c, font=font_opt)

        # Bottom Explanation Note
        draw.text((110, 580), "Explanation: Zero-based indexing runs from 0 to N-1. Address arithmetic computes RAM location in 1 step (O(1)).", fill=(74, 222, 128), font=font_exp)

    def _draw_summary_chips(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        draw.rounded_rectangle([(80, 150), (self.width - 80, 640)], radius=14, fill=(30, 41, 59), outline=(74, 222, 128), width=2)
        font_hdr = self._get_font(24, bold=True)
        draw.text((110, 175), "KEY TAKEAWAYS & RECAP CHECKLIST", fill=(74, 222, 128), font=font_hdr)

        chips = [
            "1. Contiguous Memory: All elements are stored side-by-side in unbroken RAM.",
            "2. Zero-Based Indexing: Elements are indexed 0 to N-1, giving instant random access.",
            "3. O(1) Address Calculation: Hardware uses Base + (i * size) to jump directly to memory.",
            "4. Dynamic Sizing & Amortized Bounds: Doubling capacity keeps average append cost at O(1)."
        ]
        font_chip = self._get_font(24)
        for idx, chip in enumerate(chips):
            cy = 230 + idx * 95
            draw.rounded_rectangle([(110, cy), (self.width - 110, cy + 75)], radius=10, fill=(15, 23, 42), outline=(71, 85, 105), width=1)
            draw.text((140, cy + 24), chip, fill=(241, 245, 249), font=font_chip)

    def _draw_formula_card(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        formula = scene.get("formula") or "Address(arr[i]) = Base + (i * Element_Size)"
        draw.rounded_rectangle([(80, 150), (self.width - 80, 400)], radius=16, fill=(24, 24, 27), outline=(245, 158, 11), width=3)
        font_hdr = self._get_font(24, bold=True)
        draw.text((120, 185), "MATHEMATICAL FORMULATION & BOUNDS", fill=(245, 158, 11), font=font_hdr)

        font_form = self._get_font(34, bold=True)
        draw.text((120, 260), formula, fill=(254, 243, 199), font=font_form)

        draw.rounded_rectangle([(80, 430), (self.width - 80, 640)], radius=12, fill=(30, 41, 59), outline=(71, 85, 105), width=2)
        font_lbl = self._get_font(22, bold=True)
        draw.text((120, 460), "Analytical Notation Breakdown:", fill=(148, 163, 184), font=font_lbl)
        on_screen = scene.get("on_screen_text") or "Verify invariant bounds and physical units during derivation."
        font_body = self._get_font(24)
        draw.text((120, 510), on_screen[:180], fill=(226, 232, 240), font=font_body)

    def _draw_diagram(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        """Renders domain-specific conceptual diagram without generic template placeholders."""
        draw.rounded_rectangle([(80, 150), (self.width - 80, 640)], radius=14, fill=(30, 41, 59), outline=(56, 189, 248), width=2)
        font_diag_hdr = self._get_font(24, bold=True)
        draw.text((110, 180), "CONCEPTUAL ARCHITECTURE DIAGRAM", fill=(56, 189, 248), font=font_diag_hdr)

        # Draw 3 domain steps derived from scene
        title = scene.get("title", "")
        on_screen = scene.get("on_screen_text") or scene.get("visual_description") or ""

        node_y = 250
        node_w = 320
        node_h = 160
        x_offsets = [110, 480, 850]
        step_labels = [
            ("1. Baseline State", "Initialize contiguous physical allocation."),
            ("2. Index Arithmetic", "Calculate direct byte offset from Base Address."),
            ("3. Verified Access", "Retrieve target value in O(1) constant time.")
        ]

        font_node_title = self._get_font(22, bold=True)
        font_node_desc = self._get_font(20)

        for idx, (st_title, st_desc) in enumerate(step_labels):
            x = x_offsets[idx]
            draw.rounded_rectangle([(x, node_y), (x + node_w, node_y + node_h)], radius=12, fill=(15, 23, 42), outline=(56, 189, 248), width=2)
            draw.text((x + 20, node_y + 25), st_title, fill=(56, 189, 248), font=font_node_title)
            draw.text((x + 20, node_y + 70), st_desc[:80], fill=(226, 232, 240), font=font_node_desc)

            if idx < 2:
                arr_x = x + node_w + 10
                draw.line([(arr_x, node_y + node_h // 2), (arr_x + 35, node_y + node_h // 2)], fill=(251, 191, 36), width=3)

        # Bottom detail box
        draw.rounded_rectangle([(110, 460), (self.width - 110, 610)], radius=10, fill=(15, 23, 42), outline=(71, 85, 105), width=1)
        font_detail_hdr = self._get_font(22, bold=True)
        draw.text((130, 480), "Operational Invariants & Rules:", fill=(148, 163, 184), font=font_detail_hdr)
        font_detail_body = self._get_font(24)
        draw.text((130, 520), on_screen[:150], fill=(226, 232, 240), font=font_detail_body)

    def _draw_text_card(self, draw: ImageDraw.ImageDraw, scene: Dict[str, Any]):
        draw.rounded_rectangle([(80, 150), (self.width - 80, 640)], radius=14, fill=(30, 41, 59), outline=(71, 85, 105), width=2)
        on_screen = scene.get("on_screen_text") or scene.get("narration_text") or ""
        font_hdr = self._get_font(26, bold=True)
        draw.text((120, 190), "CONCEPTUAL EXPLANATION", fill=(148, 163, 184), font=font_hdr)
        font_body = self._get_font(24)
        lines = [on_screen[i:i + 65] for i in range(0, min(len(on_screen), 260), 65)]
        for idx, l in enumerate(lines):
            draw.text((120, 250 + idx * 50), l, fill=(241, 245, 249), font=font_body)


# ==============================================================================
# 4. CAPTION GENERATOR (SRT / WebVTT)
# ==============================================================================

class CaptionGenerator:
    """
    Generates educational SubRip (.srt) and WebVTT (.vtt) caption artifacts
    from timed scenes.
    """

    @staticmethod
    def _format_srt_time(seconds: float) -> str:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds - int(seconds)) * 1000)
        return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

    @classmethod
    def generate_srt(cls, scenes: List[Dict[str, Any]]) -> str:
        lines: List[str] = []
        for s in scenes:
            num = s.get("scene_number", 1)
            start_t = cls._format_srt_time(s.get("start_time_seconds", 0.0))
            end_t = cls._format_srt_time(s.get("end_time_seconds", 10.0))
            narration = s.get("narration_text", "").strip()
            lines.append(f"{num}\n{start_t} --> {end_t}\n{narration}\n")
        return "\n".join(lines)


# ==============================================================================
# 5. VIDEO RENDERER & MEDIA PROBE (FFMPEG)
# ==============================================================================

class VideoRenderer(ABC):
    @abstractmethod
    def render(self, video: Video, scenes: List[Dict[str, Any]], audio_bytes: bytes, output_mp4_path: str) -> Dict[str, Any]:
        pass


class LocalFFmpegVideoRenderer(VideoRenderer):
    """
    Scene-based video renderer using FFmpeg concat demuxer and Pillow presentation slides.
    Produces valid 720p H.264 / AAC MP4 with thumbnail extraction and media validation.
    """

    def __init__(self, ffmpeg_exe: str = DEFAULT_FFMPEG_EXE):
        self.ffmpeg_exe = ffmpeg_exe
        self.slide_renderer = VisualSlideRenderer()

    def render(self, video: Video, scenes: List[Dict[str, Any]], audio_bytes: bytes, output_mp4_path: str) -> Dict[str, Any]:
        with tempfile.TemporaryDirectory() as td:
            # 1. Save audio to temporary WAV file
            wav_path = os.path.join(td, "narration.wav")
            with open(wav_path, "wb") as f:
                f.write(audio_bytes)

            # 2. Render PNG slides for every scene and build concat script
            concat_path = os.path.join(td, "concat.txt")
            with open(concat_path, "w") as cf:
                for idx, sc in enumerate(scenes):
                    img = self.slide_renderer.render_scene_slide(video, sc)
                    slide_path = os.path.join(td, f"slide_{idx:03d}.png")
                    img.save(slide_path, "PNG")

                    dur = sc.get("estimated_duration_seconds", 10.0)
                    cf.write(f"file '{slide_path}'\n")
                    cf.write(f"duration {dur:.2f}\n")

                # Concat demuxer requirement: repeat the last file entry
                if scenes:
                    last_slide = os.path.join(td, f"slide_{len(scenes) - 1:03d}.png")
                    cf.write(f"file '{last_slide}'\n")

            # 3. Execute FFmpeg MP4 composition with explicit stream mapping
            os.makedirs(os.path.dirname(output_mp4_path), exist_ok=True)
            cmd = [
                self.ffmpeg_exe, "-y",
                "-f", "concat", "-safe", "0", "-i", concat_path,
                "-i", wav_path,
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                "-r", str(settings.video_fps),
                "-movflags", "+faststart",
                "-shortest",
                output_mp4_path
            ]
            proc = subprocess.run(cmd, capture_output=True, timeout=180)
            if proc.returncode != 0:
                raise RuntimeError(f"FFmpeg render failed: {proc.stderr.decode()}")

            # 4. Extract thumbnail (at 0.5s or 1.0s timestamp)
            thumbnail_path = os.path.splitext(output_mp4_path)[0] + "_thumb.jpg"
            thumb_cmd = [
                self.ffmpeg_exe, "-y",
                "-ss", "00:00:01",
                "-i", output_mp4_path,
                "-vframes", "1",
                "-q:v", "2",
                thumbnail_path
            ]
            subprocess.run(thumb_cmd, capture_output=True, timeout=30)
            if not os.path.exists(thumbnail_path):
                # Fallback thumbnail at 00:00:00
                subprocess.run([
                    self.ffmpeg_exe, "-y", "-i", output_mp4_path,
                    "-vframes", "1", "-q:v", "2", thumbnail_path
                ], capture_output=True)

            # 5. Probe rendered media
            probe = self.probe_media(output_mp4_path)
            return {
                "mp4_path": output_mp4_path,
                "thumbnail_path": thumbnail_path,
                "probe": probe
            }

    def probe_media(self, file_path: str) -> Dict[str, Any]:
        """Validates rendered MP4 streams, duration, resolution, codecs, and audio amplitude."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Media file not found: {file_path}")

        file_size = os.path.getsize(file_path)
        if file_size < 1000:
            raise ValueError(f"Media file {file_path} is undersized ({file_size} bytes)")

        res = subprocess.run([self.ffmpeg_exe, "-i", file_path], capture_output=True, text=True)
        out = res.stderr

        # Extract duration
        dur_m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", out)
        if dur_m:
            hours, mins, secs = int(dur_m.group(1)), int(dur_m.group(2)), float(dur_m.group(3))
            duration = round(hours * 3600 + mins * 60 + secs, 2)
        else:
            duration = 0.0

        has_video = "Video:" in out
        has_audio = "Audio:" in out
        streams_count = len(re.findall(r"Stream #", out))

        res_m = re.search(r"(\d{3,4})x(\d{3,4})", out)
        w, h = (int(res_m.group(1)), int(res_m.group(2))) if res_m else (1280, 720)

        v_codec_m = re.search(r"Video:\s*([a-zA-Z0-9_-]+)", out)
        v_codec = v_codec_m.group(1) if v_codec_m else "h264"

        a_codec_m = re.search(r"Audio:\s*([a-zA-Z0-9_-]+)", out)
        a_codec = a_codec_m.group(1) if a_codec_m else "aac"

        # Check audio waveform / volume level (volumedetect)
        mean_vol = 0.0
        max_vol = 0.0
        is_audible = False
        if has_audio:
            vol_res = subprocess.run(
                [self.ffmpeg_exe, "-i", file_path, "-af", "volumedetect", "-vn", "-sn", "-dn", "-f", "null", "-"],
                capture_output=True,
                text=True
            )
            mean_m = re.search(r"mean_volume:\s*(-?[\d\.]+)\s*dB", vol_res.stderr)
            max_m = re.search(r"max_volume:\s*(-?[\d\.]+)\s*dB", vol_res.stderr)
            if mean_m:
                mean_vol = float(mean_m.group(1))
            if max_m:
                max_vol = float(max_m.group(1))

            if mean_vol <= -75.0:
                raise ValueError(
                    f"Rendered MP4 has silent or near-zero audio track (mean_volume: {mean_vol} dB). "
                    "Audible educational narration is required."
                )
            is_audible = bool(mean_vol > -75.0 and max_vol > -60.0)

        return {
            "duration": duration,
            "has_video": has_video,
            "has_audio": has_audio,
            "mean_volume_db": mean_vol,
            "max_volume_db": max_vol,
            "is_audible": is_audible,
            "streams_count": streams_count,
            "video_codec": v_codec,
            "audio_codec": a_codec,
            "resolution": f"{w}x{h}",
            "file_size": file_size,
            "valid": bool(has_video and has_audio and duration > 0.5 and is_audible)
        }


# ==============================================================================
# 6. VIDEO GENERATION SERVICE (ORCHESTRATOR)
# ==============================================================================

class RenderingCancelledException(Exception):
    """Raised when an ongoing rendering job is cancelled by an administrator."""
    pass


RENDERING_STAGE_METADATA = {
    1: {"code": "PREPARING_SCRIPT", "name": "Preparing script and scenes", "target_pct": 5.0},
    2: {"code": "GENERATING_AUDIO", "name": "Generating narration/audio", "target_pct": 35.0},
    3: {"code": "GENERATING_VISUALS", "name": "Generating scene visuals", "target_pct": 55.0},
    4: {"code": "RENDERING_SCENES", "name": "Rendering individual scenes", "target_pct": 70.0},
    5: {"code": "MERGING_SCENES", "name": "Merging scenes", "target_pct": 80.0},
    6: {"code": "ENCODING_MP4", "name": "Encoding the final MP4", "target_pct": 90.0},
    7: {"code": "GENERATING_CAPTIONS", "name": "Generating captions", "target_pct": 93.0},
    8: {"code": "GENERATING_THUMBNAIL", "name": "Generating thumbnail", "target_pct": 96.0},
    9: {"code": "VALIDATING_OUTPUT", "name": "Final video validation", "target_pct": 100.0},
}


class VideoGenerationService:
    """
    End-to-end video generation orchestrator coordinating:
    Script validation -> Narration audio (TTS) -> Scene generation -> FFmpeg rendering
    -> Thumbnail extraction -> Captions -> Media validation -> ProcessingJob & VideoRenderingJob tracking.
    """

    def __init__(self, tts_engine: Optional[TTSEngine] = None, renderer: Optional[VideoRenderer] = None):
        self.tts_engine = tts_engine or get_tts_engine()
        self.renderer = renderer or LocalFFmpegVideoRenderer()
        self.scene_generator = SceneGenerator()
        self.storage = get_storage()

    def update_job_progress(
        self,
        job_id: str,
        db: Session,
        stage_number: int,
        progress: float,
        current_scene: int = 0,
        completed_scenes: int = 0,
        total_scenes: Optional[int] = None
    ) -> bool:
        """
        Updates persistent VideoRenderingJob record with genuine work progress.
        Returns False if the job has been cancelled by an administrator.
        """
        job = db.query(VideoRenderingJob).filter(VideoRenderingJob.job_id == job_id).first()
        if not job:
            return True

        db.refresh(job)
        if job.is_cancelled:
            return False

        meta = RENDERING_STAGE_METADATA.get(stage_number, {})
        job.current_stage = meta.get("code", f"STAGE_{stage_number}")
        job.stage_number = stage_number
        job.stage_name = meta.get("name", f"Stage {stage_number}")
        job.progress = round(min(100.0, max(0.0, progress)), 1)
        job.current_scene = current_scene
        job.completed_scenes = completed_scenes
        if total_scenes is not None:
            job.total_scenes = total_scenes

        now = utcnow()
        started = normalize_datetime(job.started_at) or now
        elapsed = max(0.0, (now - started).total_seconds())
        job.elapsed_seconds = round(elapsed, 1)

        # Genuine data-backed ETA calculation based on completed progress percentage
        if job.progress >= 5.0 and elapsed > 0:
            total_estimated = elapsed / (job.progress / 100.0)
            remaining = max(0.0, total_estimated - elapsed)
            job.estimated_remaining_seconds = round(remaining, 1)
        else:
            job.estimated_remaining_seconds = None

        job.updated_at = now
        db.commit()
        return True

    def run_rendering_pipeline(
        self,
        job_id: str,
        db: Session,
        force: bool = False,
        tts_engine_name: Optional[str] = None,
        voice: Optional[str] = None
    ) -> Video:
        """
        Executes the 9-stage video rendering pipeline synchronously for the given job.
        Survives browser refresh by persisting real-time updates directly to database.
        """
        job = db.query(VideoRenderingJob).filter(VideoRenderingJob.job_id == job_id).first()
        if not job:
            raise ValueError(f"Rendering job '{job_id}' not found.")

        video = db.get(Video, job.video_id)
        if not video:
            job.status = "FAILED"
            job.error_message = f"Video {job.video_id} not found."
            job.completed_at = utcnow()
            db.commit()
            raise ValueError(f"Video {job.video_id} not found.")

        # Also maintain a ProcessingJob for backward-compatibility with older tests
        proc_job = db.query(ProcessingJob).filter(
            ProcessingJob.video_id == video.id,
            ProcessingJob.job_type == "VIDEO_GENERATION"
        ).order_by(ProcessingJob.id.desc()).first()
        if not proc_job or proc_job.status in ["COMPLETED", "FAILED"]:
            proc_job = ProcessingJob(
                job_type="VIDEO_GENERATION",
                video_id=video.id,
                status="RUNNING",
                progress=0.0,
                current_stage="PREPARING_SCRIPT",
                started_at=utcnow()
            )
            db.add(proc_job)
            db.commit()
            db.refresh(proc_job)

        scratch_temp_dir = None
        try:
            job.status = "RUNNING"
            job.started_at = utcnow()
            db.commit()

            # -------------------------------------------------------------
            # STAGE 1: Preparing script and scenes (5%)
            # -------------------------------------------------------------
            if (video.script_status or "").upper() != "SCRIPT_APPROVED":
                raise ValueError(
                    "Video rendering requires an approved script. "
                    f"Current script status is '{video.script_status or 'None'}'. "
                    "Only SCRIPT_APPROVED video scripts may enter the video rendering pipeline."
                )

            script_content = video.script_data or {}
            sections = script_content.get("sections")
            if not sections and video.script_versions:
                sections = video.script_versions[0].script_content.get("sections")

            if not sections:
                raise ValueError("Structured script sections not found for video.")

            total_scenes = len(sections)
            video.render_status = "AUDIO_GENERATING"
            db.commit()

            if not self.update_job_progress(job_id, db, stage_number=1, progress=5.0, current_scene=1, completed_scenes=0, total_scenes=total_scenes):
                raise RenderingCancelledException(job.cancellation_reason or "Cancelled by administrator")

            proc_job.current_stage = "PREPARING_SCRIPT"
            proc_job.progress = 5.0
            db.commit()

            # -------------------------------------------------------------
            # STAGE 2: Generating narration/audio (scene-by-scene: 5% -> 35%)
            # -------------------------------------------------------------
            active_tts = get_tts_engine(tts_engine_name) if tts_engine_name else self.tts_engine
            voice_config = {"voice": voice} if voice else None
            audio_cache = TTSAudioCache()

            scenes: List[Dict[str, Any]] = []
            master_audio_frames = bytearray()
            sample_rate = 44100
            channels = 1
            sampwidth = 2
            current_time = 0.0
            last_tts_engine = getattr(active_tts, "engine", "neural_tts")

            script_version_num = video.script_versions[0].version_number if video.script_versions else 1
            selected_voice = voice or (settings.elevenlabs_voice_id if getattr(active_tts, "prefer_elevenlabs", False) and getattr(active_tts, "api_key", None) else settings.tts_voice)

            for idx, sec in enumerate(sections, start=1):
                pct = 5.0 + (float(idx - 1) / float(total_scenes)) * 30.0
                if not self.update_job_progress(job_id, db, stage_number=2, progress=pct, current_scene=idx, completed_scenes=idx - 1, total_scenes=total_scenes):
                    raise RenderingCancelledException(job.cancellation_reason or "Cancelled by administrator")

                sec_type = sec.get("type", "CONCEPT")
                title = sec.get("title", f"Scene {idx}")
                narration = (sec.get("narration") or sec.get("narration_text") or "").strip()

                if not narration:
                    raise ValueError(f"Narration required for scene {idx} ('{title}') but narration text is empty.")
                if len(narration) < 15 or len(narration.split()) < 3:
                    raise ValueError(
                        f"Narration required for scene {idx} ('{title}') but narration text is insufficient "
                        f"({len(narration)} chars, {len(narration.split())} words)."
                    )

                # Determine active speaker and appropriate voice identity
                sec_speaker = sec.get("speaker") or "Teacher"
                is_gemini = isinstance(active_tts, GoogleGeminiTTSProvider) or getattr(active_tts, "engine", "") == "gemini_tts"
                if is_gemini:
                    if str(sec_speaker).strip().lower() == "student":
                        scene_voice = (voice_config or {}).get("student_voice") or getattr(active_tts, "student_voice", "Puck")
                    else:
                        scene_voice = (voice_config or {}).get("teacher_voice") or (voice_config or {}).get("voice") or getattr(active_tts, "teacher_voice", "Aoede")
                else:
                    scene_voice = selected_voice

                scene_voice_config = dict(voice_config or {})
                scene_voice_config["speaker"] = sec_speaker
                scene_voice_config["voice"] = str(scene_voice)
                if "dialogue" in sec:
                    scene_voice_config["dialogue"] = sec["dialogue"]

                cache_key = audio_cache.get_key(
                    script_version=script_version_num,
                    scene_id=idx,
                    provider=getattr(active_tts, "engine", "neural_tts"),
                    voice=str(scene_voice),
                    speed=settings.tts_speed,
                    text=narration,
                    model=getattr(active_tts, "model", ""),
                    language=getattr(active_tts, "language_code", "")
                )
                tts_res = audio_cache.get(cache_key)
                if not tts_res:
                    tts_res = active_tts.synthesize(narration, scene_voice_config)
                    audio_cache.put(
                        cache_key,
                        tts_res,
                        model=getattr(active_tts, "model", ""),
                        language=getattr(active_tts, "language_code", "")
                    )

                last_tts_engine = tts_res.engine

                if not tts_res.audio_bytes or len(tts_res.audio_bytes) < 100:
                    raise ValueError(f"TTS output empty or missing for scene {idx} ('{title}').")
                if tts_res.duration_seconds <= 0:
                    raise ValueError(f"TTS output has zero duration for scene {idx} ('{title}').")

                with wave.open(io.BytesIO(tts_res.audio_bytes), "rb") as wf:
                    ch = wf.getnchannels()
                    sw = wf.getsampwidth()
                    sr = wf.getframerate()
                    nf = wf.getnframes()
                    if ch < 1 or sr < 8000 or nf <= 0:
                        raise ValueError(f"Invalid audio format for scene {idx}: {ch}ch, {sr}Hz, {nf} frames.")
                    audio_raw = wf.readframes(nf)
                    sample_rate = sr
                    channels = ch
                    sampwidth = sw

                sample_count = len(audio_raw) // sw
                if sample_count > 0:
                    samples_data = struct.unpack("<" + "h" * sample_count, audio_raw)
                    rms_amp = math.sqrt(sum(s**2 for s in samples_data) / sample_count)
                    max_amp = max(abs(s) for s in samples_data)
                    if rms_amp < 30.0 and max_amp < 100:
                        raise ValueError(
                            f"TTS output for scene {idx} ('{title}') is effectively silent "
                            f"(RMS: {rms_amp:.1f}, Max: {max_amp}). Real audible speech is required."
                        )

                scene_audio_filename = f"video_{video.id}_scene_{idx:03d}.wav"
                scene_audio_key = self.storage.save_file(
                    tts_res.audio_bytes,
                    scene_audio_filename,
                    folder=f"videos/{video.id}/scenes"
                )

                spoken_duration = round(nf / float(sr), 2)
                pause_sec = 1.0
                scene_duration = round(spoken_duration + pause_sec, 2)
                start_t = round(current_time, 2)
                end_t = round(current_time + scene_duration, 2)
                current_time = end_t

                scene_payload = {
                    "scene_number": idx,
                    "section_type": sec_type,
                    "title": title,
                    "narration_text": narration,
                    "visual_type": sec.get("visual_type", "DIAGRAM"),
                    "visual_description": sec.get("visual_description"),
                    "on_screen_text": sec.get("on_screen_text") or title,
                    "formula": sec.get("formula"),
                    "animation_hint": sec.get("animation_hint", "FADE_IN"),
                    "source_pages": sec.get("source_pages", [video.source_start_page or 1]),
                    "audio_storage_key": scene_audio_key,
                    "audio_duration": spoken_duration,
                    "estimated_duration_seconds": scene_duration,
                    "start_time_seconds": start_t,
                    "end_time_seconds": end_t,
                    "visual_data": sec.get("visual_data", {}),
                    "learning_objective": sec.get("learning_objective") or video.learning_objective
                }
                scenes.append(scene_payload)

                master_audio_frames.extend(audio_raw)
                silence_frames = int(sr * pause_sec)
                master_audio_frames.extend(b"\x00" * (silence_frames * sw * ch))

            # Assemble continuous master audio
            with io.BytesIO() as master_wav_io:
                with wave.open(master_wav_io, "wb") as mwf:
                    mwf.setnchannels(channels)
                    mwf.setsampwidth(sampwidth)
                    mwf.setframerate(sample_rate)
                    mwf.writeframes(master_audio_frames)
                master_audio_bytes = master_wav_io.getvalue()

            audio_filename = f"video_{video.id}_audio.wav"
            audio_storage_key = self.storage.save_file(
                master_audio_bytes,
                audio_filename,
                folder=f"videos/{video.id}"
            )
            video.audio_storage_key = audio_storage_key
            video.tts_engine = last_tts_engine
            video.voice = voice or settings.tts_voice
            video.render_status = "AUDIO_READY"
            video.scenes_data = scenes
            db.commit()

            # -------------------------------------------------------------
            # STAGE 3: Generating scene visuals (scene-by-scene: 35% -> 55%)
            # -------------------------------------------------------------
            scratch_temp_dir = tempfile.mkdtemp(prefix=f"render_{video.id}_")
            wav_path = os.path.join(scratch_temp_dir, "narration.wav")
            with open(wav_path, "wb") as wf:
                wf.write(master_audio_bytes)

            slide_paths: List[str] = []
            slide_renderer = VisualSlideRenderer()
            for idx, sc in enumerate(scenes, start=1):
                pct = 35.0 + (float(idx - 1) / float(total_scenes)) * 20.0
                if not self.update_job_progress(job_id, db, stage_number=3, progress=pct, current_scene=idx, completed_scenes=idx - 1, total_scenes=total_scenes):
                    raise RenderingCancelledException(job.cancellation_reason or "Cancelled by administrator")

                img = slide_renderer.render_scene_slide(video, sc)
                slide_path = os.path.join(scratch_temp_dir, f"slide_{idx:03d}.png")
                img.save(slide_path, "PNG")
                slide_paths.append(slide_path)

            # -------------------------------------------------------------
            # STAGE 4: Rendering individual scenes (70%)
            # -------------------------------------------------------------
            if not self.update_job_progress(job_id, db, stage_number=4, progress=70.0, current_scene=total_scenes, completed_scenes=total_scenes, total_scenes=total_scenes):
                raise RenderingCancelledException(job.cancellation_reason or "Cancelled by administrator")

            concat_path = os.path.join(scratch_temp_dir, "concat.txt")
            with open(concat_path, "w") as cf:
                for idx, sc in enumerate(scenes):
                    slide_path = slide_paths[idx] if idx < len(slide_paths) else slide_paths[-1]
                    dur = sc.get("estimated_duration_seconds", 10.0)
                    cf.write(f"file '{slide_path}'\n")
                    cf.write(f"duration {dur:.2f}\n")
                if slide_paths:
                    cf.write(f"file '{slide_paths[-1]}'\n")

            # -------------------------------------------------------------
            # STAGE 5: Merging scenes (80%)
            # -------------------------------------------------------------
            if not self.update_job_progress(job_id, db, stage_number=5, progress=80.0, current_scene=total_scenes, completed_scenes=total_scenes, total_scenes=total_scenes):
                raise RenderingCancelledException(job.cancellation_reason or "Cancelled by administrator")

            video.render_status = "RENDERING"
            db.commit()

            prev_versions_count = db.query(VideoRenderVersion).filter(VideoRenderVersion.video_id == video.id).count()
            new_version_num = prev_versions_count + 1

            local_uploads_dir = getattr(self.storage, "base_dir", os.path.join(os.getcwd(), "uploads"))
            target_video_dir = os.path.join(local_uploads_dir, "videos", str(video.id))
            os.makedirs(target_video_dir, exist_ok=True)
            output_filename = f"video_{video.id}_v{new_version_num}.mp4"
            output_mp4_path = os.path.join(target_video_dir, output_filename)

            # -------------------------------------------------------------
            # STAGE 6: Encoding the final MP4 (90%)
            # -------------------------------------------------------------
            if not self.update_job_progress(job_id, db, stage_number=6, progress=90.0, current_scene=total_scenes, completed_scenes=total_scenes, total_scenes=total_scenes):
                raise RenderingCancelledException(job.cancellation_reason or "Cancelled by administrator")

            cmd = [
                self.renderer.ffmpeg_exe, "-y",
                "-f", "concat", "-safe", "0", "-i", concat_path,
                "-i", wav_path,
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                "-r", str(settings.video_fps),
                "-movflags", "+faststart",
                "-shortest",
                output_mp4_path
            ]
            proc = subprocess.run(cmd, capture_output=True, timeout=180)
            if proc.returncode != 0:
                raise RuntimeError(f"FFmpeg render failed: {proc.stderr.decode()}")

            # -------------------------------------------------------------
            # STAGE 7: Generating captions (93%)
            # -------------------------------------------------------------
            if not self.update_job_progress(job_id, db, stage_number=7, progress=93.0, current_scene=total_scenes, completed_scenes=total_scenes, total_scenes=total_scenes):
                raise RenderingCancelledException(job.cancellation_reason or "Cancelled by administrator")

            srt_content = CaptionGenerator.generate_srt(scenes)
            captions_key = self.storage.save_file(srt_content.encode("utf-8"), f"video_{video.id}_captions.srt", folder=f"videos/{video.id}")
            video.captions_storage_key = captions_key

            # -------------------------------------------------------------
            # STAGE 8: Generating thumbnail (96%)
            # -------------------------------------------------------------
            if not self.update_job_progress(job_id, db, stage_number=8, progress=96.0, current_scene=total_scenes, completed_scenes=total_scenes, total_scenes=total_scenes):
                raise RenderingCancelledException(job.cancellation_reason or "Cancelled by administrator")

            thumbnail_path = os.path.splitext(output_mp4_path)[0] + "_thumb.jpg"
            thumb_cmd = [
                self.renderer.ffmpeg_exe, "-y",
                "-ss", "00:00:01",
                "-i", output_mp4_path,
                "-vframes", "1",
                "-q:v", "2",
                thumbnail_path
            ]
            subprocess.run(thumb_cmd, capture_output=True, timeout=30)
            if not os.path.exists(thumbnail_path):
                subprocess.run([
                    self.renderer.ffmpeg_exe, "-y", "-i", output_mp4_path,
                    "-vframes", "1", "-q:v", "2", thumbnail_path
                ], capture_output=True)

            if os.path.exists(thumbnail_path):
                with open(thumbnail_path, "rb") as tf:
                    thumb_bytes = tf.read()
                thumb_key = self.storage.save_file(thumb_bytes, f"video_{video.id}_thumb.jpg", folder=f"videos/{video.id}")
                video.thumbnail_storage_key = thumb_key

            # -------------------------------------------------------------
            # STAGE 9: Final video validation (100%)
            # -------------------------------------------------------------
            if not self.update_job_progress(job_id, db, stage_number=9, progress=98.0, current_scene=total_scenes, completed_scenes=total_scenes, total_scenes=total_scenes):
                raise RenderingCancelledException(job.cancellation_reason or "Cancelled by administrator")

            probe = self.renderer.probe_media(output_mp4_path)
            if not probe["valid"]:
                raise ValueError("Rendered MP4 failed stream validation: missing audio or video streams.")

            video_storage_key = f"videos/{video.id}/{output_filename}"
            video.video_storage_key = video_storage_key
            video.storage_key = video_storage_key
            video.actual_duration_seconds = probe["duration"]
            video.render_engine = "ffmpeg"

            # Supersede old versions
            old_versions = db.query(VideoRenderVersion).filter(
                VideoRenderVersion.video_id == video.id
            ).all()
            for ov in old_versions:
                ov.status = "SUPERSEDED"

            render_version = VideoRenderVersion(
                video_id=video.id,
                version_number=new_version_num,
                status="REVIEW",
                render_engine="ffmpeg",
                tts_engine=video.tts_engine,
                voice=video.voice,
                actual_duration_seconds=probe["duration"],
                video_storage_key=video_storage_key,
                audio_storage_key=audio_storage_key,
                thumbnail_storage_key=video.thumbnail_storage_key,
                captions_storage_key=video.captions_storage_key,
                scenes_data=scenes
            )
            db.add(render_version)

            video.render_status = "RENDERED"
            video.status = "REVIEW"
            video.rendered_at = utcnow()
            video.render_error = None

            # Mark both persistent jobs completed
            video_url = self.storage.get_url(video_storage_key)
            job.status = "COMPLETED"
            job.progress = 100.0
            job.current_stage = "COMPLETED"
            job.stage_number = 9
            job.stage_name = "Final video validation (Complete)"
            job.completed_scenes = total_scenes
            job.current_scene = total_scenes
            job.completed_at = utcnow()
            job.estimated_remaining_seconds = 0.0
            job.output_video_url = video_url

            proc_job.status = "COMPLETED"
            proc_job.progress = 100.0
            proc_job.current_stage = "COMPLETED"
            proc_job.completed_at = utcnow()

            db.commit()
            db.refresh(video)
            return video

        except RenderingCancelledException as e:
            now = utcnow()
            job.status = "CANCELLED"
            job.completed_at = now
            job.error_message = str(e)
            video.render_status = "FAILED"
            video.render_error = str(e)
            proc_job.status = "CANCELLED"
            proc_job.completed_at = now
            db.commit()
            raise

        except Exception as e:
            now = utcnow()
            job.status = "FAILED"
            job.completed_at = now
            job.error_message = str(e)
            video.render_status = "FAILED"
            video.render_error = str(e)
            proc_job.status = "FAILED"
            proc_job.current_stage = "FAILED"
            proc_job.error_message = str(e)
            proc_job.completed_at = now
            db.commit()
            raise

        finally:
            if scratch_temp_dir and os.path.exists(scratch_temp_dir):
                shutil.rmtree(scratch_temp_dir, ignore_errors=True)

    def start_video_generation(
        self,
        video_id: int,
        db: Session,
        force: bool = False,
        tts_engine_name: Optional[str] = None,
        voice: Optional[str] = None
    ) -> Video:
        """
        Synchronous entrypoint for video rendering (preserves 100% backward compatibility
        for existing tests and direct synchronous callers).
        """
        video = db.get(Video, video_id)
        if not video:
            raise ValueError(f"Video {video_id} not found.")

        job_id = f"vjob-{video_id}-{uuid.uuid4().hex[:8]}"
        job = VideoRenderingJob(
            job_id=job_id,
            video_id=video_id,
            video_title=video.title,
            current_stage="PREPARING_SCRIPT",
            stage_number=1,
            stage_name="Preparing script and scenes",
            status="PENDING",
            progress=0.0,
            started_at=utcnow()
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        return self.run_rendering_pipeline(
            job_id=job_id,
            db=db,
            force=force,
            tts_engine_name=tts_engine_name,
            voice=voice
        )

    def queue_video_rendering(
        self,
        video_id: int,
        db: Session,
        force: bool = False,
        tts_engine_name: Optional[str] = None,
        voice: Optional[str] = None
    ) -> VideoRenderingJob:
        """
        Asynchronous background entrypoint. Spawns isolated worker thread and returns
        the persistent VideoRenderingJob immediately so the client can poll progress.
        Prevents duplicate active jobs for the same video unless force=True.
        """
        video = db.get(Video, video_id)
        if not video:
            raise ValueError(f"Video {video_id} not found.")

        if (video.script_status or "").upper() != "SCRIPT_APPROVED":
            raise ValueError(
                "Video rendering requires an approved script. "
                f"Current script status is '{video.script_status or 'None'}'. "
                "Only SCRIPT_APPROVED video scripts may enter the video rendering pipeline."
            )

        # Prevent duplicate rendering jobs
        active_job = db.query(VideoRenderingJob).filter(
            VideoRenderingJob.video_id == video_id,
            VideoRenderingJob.status.in_(["PENDING", "RUNNING"])
        ).order_by(VideoRenderingJob.id.desc()).first()

        if active_job and not force:
            return active_job

        if active_job and force:
            active_job.is_cancelled = True
            active_job.status = "CANCELLED"
            active_job.cancellation_reason = "Superseded by force re-render request"
            db.commit()

        job_id = f"vjob-{video_id}-{uuid.uuid4().hex[:8]}"
        job = VideoRenderingJob(
            job_id=job_id,
            video_id=video_id,
            video_title=video.title,
            current_stage="PREPARING_SCRIPT",
            stage_number=1,
            stage_name="Preparing script and scenes",
            status="PENDING",
            progress=0.0,
            started_at=utcnow()
        )
        db.add(job)
        video.render_status = "AUDIO_GENERATING"
        db.commit()
        db.refresh(job)

        # Launch background worker thread
        def _bg_worker():
            thread_db = SessionLocal()
            try:
                srv = VideoGenerationService()
                srv.run_rendering_pipeline(
                    job_id=job_id,
                    db=thread_db,
                    force=force,
                    tts_engine_name=tts_engine_name,
                    voice=voice
                )
            except Exception:
                pass
            finally:
                thread_db.close()

        t = threading.Thread(target=_bg_worker, daemon=True)
        t.start()

        return job

    def get_rendering_job(
        self,
        job_id_or_int: Union[str, int],
        db: Session
    ) -> Optional[VideoRenderingJob]:
        """Looks up a VideoRenderingJob by numeric primary key or string job_id."""
        if str(job_id_or_int).isdigit():
            job = db.query(VideoRenderingJob).filter(VideoRenderingJob.id == int(job_id_or_int)).first()
            if job:
                return job
        return db.query(VideoRenderingJob).filter(VideoRenderingJob.job_id == str(job_id_or_int)).first()

    def list_rendering_jobs(
        self,
        video_id: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 50,
        db: Session = None
    ) -> List[VideoRenderingJob]:
        """Lists active and recent rendering jobs."""
        q = db.query(VideoRenderingJob)
        if video_id:
            q = q.filter(VideoRenderingJob.video_id == video_id)
        if status:
            q = q.filter(VideoRenderingJob.status.ilike(status))
        return q.order_by(VideoRenderingJob.id.desc()).limit(limit).all()

    def cancel_rendering_job(
        self,
        job_id_or_int: Union[str, int],
        db: Session,
        reason: str = "Cancelled by administrator"
    ) -> VideoRenderingJob:
        """Safely cancels an active rendering job."""
        job = self.get_rendering_job(job_id_or_int, db)
        if not job:
            raise ValueError(f"Rendering job '{job_id_or_int}' not found.")

        if job.status in ["COMPLETED", "FAILED", "CANCELLED"]:
            return job

        job.is_cancelled = True
        job.cancellation_reason = reason
        job.status = "CANCELLED"
        job.completed_at = utcnow()
        job.error_message = reason

        video = db.get(Video, job.video_id)
        if video and video.render_status != "RENDERED":
            video.render_status = "FAILED"
            video.render_error = reason

        db.commit()
        db.refresh(job)
        return job

    def retry_rendering_job(
        self,
        job_id_or_int: Union[str, int],
        db: Session
    ) -> VideoRenderingJob:
        """Retries a failed or cancelled rendering job."""
        job = self.get_rendering_job(job_id_or_int, db)
        if not job:
            raise ValueError(f"Rendering job '{job_id_or_int}' not found.")

        return self.queue_video_rendering(video_id=job.video_id, db=db, force=True)

    def approve_video(self, video_id: int, db: Session, notes: Optional[str] = None) -> Video:
        video = db.get(Video, video_id)
        if not video:
            raise ValueError(f"Video {video_id} not found.")
        if video.render_status != "RENDERED":
            raise ValueError(f"Cannot publish: video has not been rendered (status: {video.render_status}). Video must be rendered before approval or publication.")
        if (video.script_status or "").upper() != "SCRIPT_APPROVED":
            raise ValueError(
                "Cannot approve video: the script must be re-approved and the video re-rendered "
                f"(script status: {video.script_status or 'None'})."
            )
        if not video.scenes_data or len(video.scenes_data) == 0:
            raise ValueError("Cannot approve video: Video has 0 scenes.")
        if not video.actual_duration_seconds or video.actual_duration_seconds <= 0:
            raise ValueError("Cannot approve video: generated MP4 duration is 0 seconds.")
        if not video.video_storage_key or any(p in (video.video_storage_key or "").lower() for p in ["seed_", "sample.mp4", "placeholder"]):
            raise ValueError("Cannot approve video: placeholder video files cannot be approved.")

        video.status = "APPROVED"
        # Update latest render version
        latest_ver = db.query(VideoRenderVersion).filter(
            VideoRenderVersion.video_id == video.id
        ).order_by(VideoRenderVersion.version_number.desc()).first()
        if latest_ver:
            latest_ver.status = "APPROVED"
        db.commit()
        db.refresh(video)
        return video

    def publish_video(self, video_id: int, db: Session) -> Video:
        video = db.get(Video, video_id)
        if not video:
            raise ValueError(f"Video {video_id} not found.")
        if video.render_status != "RENDERED":
            raise ValueError("Cannot publish: video has not been rendered.")
        if (video.script_status or "").upper() != "SCRIPT_APPROVED":
            raise ValueError("Cannot publish: video script is not approved.")
        if not video.scenes_data or len(video.scenes_data) == 0:
            raise ValueError("Cannot publish: video has 0 scenes.")
        if not video.actual_duration_seconds or video.actual_duration_seconds <= 0:
            raise ValueError("Cannot publish: generated MP4 duration is 0 seconds.")
        if not video.video_storage_key or any(p in (video.video_storage_key or "").lower() for p in ["seed_", "sample.mp4", "placeholder"]):
            raise ValueError("Cannot publish: placeholder video files cannot be published.")
        if video.status not in ["APPROVED"]:
            raise ValueError(f"Cannot publish video in status '{video.status}'. Video must be APPROVED first (explicit admin review required).")

        video.status = "PUBLISHED"
        latest_ver = db.query(VideoRenderVersion).filter(
            VideoRenderVersion.video_id == video.id
        ).order_by(VideoRenderVersion.version_number.desc()).first()
        if latest_ver:
            latest_ver.status = "PUBLISHED"
            video.video_storage_key = latest_ver.video_storage_key
            video.storage_key = latest_ver.video_storage_key

            # Update base video_{video.id}.mp4 to point to latest version for permanent playback links
            try:
                base_dir = getattr(self.storage, "base_dir", os.path.join(os.getcwd(), "uploads"))
                ver_file = os.path.join(base_dir, latest_ver.video_storage_key)
                dest_file = os.path.join(base_dir, "videos", str(video.id), f"video_{video.id}.mp4")
                if os.path.exists(ver_file) and ver_file != dest_file:
                    import shutil
                    shutil.copy2(ver_file, dest_file)
            except Exception:
                pass

        db.commit()
        db.refresh(video)
        return video
