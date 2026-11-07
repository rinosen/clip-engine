import gc
import os
import shutil
import urllib.request
from pathlib import Path
from typing import Dict, Any

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = DATA_DIR / "models"
UPLOADS_DIR = DATA_DIR / "uploads"
OUTPUTS_DIR = DATA_DIR / "outputs"

for directory in [DATA_DIR, MODELS_DIR, UPLOADS_DIR, OUTPUTS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'autoclipper.db'}")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
DEFAULT_WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")

YUNET_MODEL_NAME = "face_detection_yunet_2023mar.onnx"
YUNET_MODEL_PATH = MODELS_DIR / YUNET_MODEL_NAME
YUNET_MODEL_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/"
    "face_detection_yunet_2023mar.onnx"
)

def find_binary(binary_name: str) -> str:
    path = shutil.which(binary_name)
    if path:
        return path
    
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages",
        Path("C:/Program Files/ffmpeg/bin"),
        Path("C:/ffmpeg/bin"),
    ]
    for candidate in candidates:
        if candidate.exists():
            for found in candidate.rglob(f"{binary_name}.exe"):
                return str(found)
    return binary_name

FFMPEG_PATH = find_binary("ffmpeg")
FFPROBE_PATH = find_binary("ffprobe")

def ensure_yunet_model() -> Path:
    if not YUNET_MODEL_PATH.exists() or YUNET_MODEL_PATH.stat().st_size < 100000:
        opener = urllib.request.build_opener()
        opener.addheaders = [("User-Agent", "AutoClipper/1.0")]
        urllib.request.install_opener(opener)
        urllib.request.urlretrieve(YUNET_MODEL_URL, YUNET_MODEL_PATH)
    return YUNET_MODEL_PATH

def cleanup_vram():
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        pass

def get_hardware_info() -> Dict[str, Any]:
    info = {
        "cuda_available": False,
        "device_name": "CPU",
        "total_vram_gb": 0.0,
        "nvenc_available": False,
        "recommended_device": "cpu",
        "recommended_compute_type": "int8"
    }
    try:
        import torch
        if torch.cuda.is_available():
            info["cuda_available"] = True
            info["device_name"] = torch.cuda.get_device_name(0)
            total_vram = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
            info["total_vram_gb"] = round(total_vram, 2)
            info["recommended_device"] = "cuda"
            info["recommended_compute_type"] = "int8_float16" if total_vram <= 8.0 else "float16"
            info["nvenc_available"] = True
    except Exception:
        pass
    return info

