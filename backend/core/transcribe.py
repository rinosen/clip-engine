import gc
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple
import numpy as np

from ..config import cleanup_vram, get_hardware_info

def compute_rms_energy_profile(audio_path: Path, hop_length_sec: float = 0.25) -> List[Dict[str, float]]:
    try:
        import soundfile as sf
        audio_data, sample_rate = sf.read(str(audio_path))
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)

        hop_length = int(sample_rate * hop_length_sec)
        frame_length = hop_length * 2
        
        frames = []
        for i in range(0, len(audio_data) - frame_length, hop_length):
            chunk = audio_data[i:i + frame_length]
            rms = np.sqrt(np.mean(chunk**2) + 1e-9)
            timestamp = i / sample_rate
            frames.append({"timestamp": round(timestamp, 2), "rms": float(rms)})

        if frames:
            max_rms = max(f["rms"] for f in frames) or 1.0
            for f in frames:
                f["rms_normalized"] = round(f["rms"] / max_rms, 3)

        return frames
    except Exception:
        return []

def transcribe_audio_words(
    audio_path: Path,
    model_size: str = "base",
    device_override: str = "auto"
) -> Tuple[List[Dict[str, Any]], List[Dict[str, float]], str]:
    hw = get_hardware_info()
    if device_override == "cpu":
        device = "cpu"
        compute_type = "int8"
    elif device_override == "cuda" or (device_override == "auto" and hw["cuda_available"]):
        device = "cuda"
        compute_type = hw["recommended_compute_type"]
    else:
        device = "cpu"
        compute_type = "int8"

    words: List[Dict[str, Any]] = []
    full_transcript = []
    
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel(model_size, device=device, compute_type=compute_type)

        segments, info = model.transcribe(
            str(audio_path),
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400)
        )

        detected_language = info.language

        for segment in segments:
            full_transcript.append(segment.text.strip())
            if segment.words:
                for w in segment.words:
                    clean_word = w.word.strip()
                    if clean_word:
                        words.append({
                            "word": clean_word,
                            "start": round(w.start, 3),
                            "end": round(w.end, 3),
                            "probability": round(w.probability, 3)
                        })
            else:
                words.append({
                    "word": segment.text.strip(),
                    "start": round(segment.start, 3),
                    "end": round(segment.end, 3),
                    "probability": 1.0
                })

        del model
    finally:
        cleanup_vram()

    energy_profile = compute_rms_energy_profile(audio_path)
    full_text = " ".join(full_transcript)

    return words, energy_profile, full_text

def find_speech_boundaries(words: List[Dict[str, Any]], min_gap: float = 0.4) -> List[float]:
    boundaries = [0.0]
    for i in range(len(words) - 1):
        gap = words[i + 1]["start"] - words[i]["end"]
        if gap >= min_gap:
            boundaries.append(round((words[i]["end"] + words[i + 1]["start"]) / 2.0, 3))
    if words:
        boundaries.append(words[-1]["end"])
    return sorted(list(set(boundaries)))

