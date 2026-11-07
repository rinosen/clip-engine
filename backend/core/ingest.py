import json
import os
import subprocess
import uuid
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import yt_dlp

from ..config import UPLOADS_DIR, FFMPEG_PATH, FFPROBE_PATH

def probe_video(video_path: Path) -> Dict[str, Any]:
    cmd = [
        FFPROBE_PATH,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,duration,codec_name:format=duration",
        "-of", "json",
        str(video_path)
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    data = json.loads(result.stdout)
    
    stream = data.get("streams", [{}])[0]
    fmt = data.get("format", {})

    width = int(stream.get("width", 1920))
    height = int(stream.get("height", 1080))

    fps_str = stream.get("r_frame_rate", "30/1")
    if "/" in fps_str:
        num, den = fps_str.split("/")
        fps = float(num) / float(den) if float(den) > 0 else 30.0
    else:
        fps = float(fps_str)

    duration = float(stream.get("duration") or fmt.get("duration") or 0.0)
    codec = stream.get("codec_name", "h264")

    return {
        "width": width,
        "height": height,
        "fps": round(fps, 2),
        "duration": round(duration, 2),
        "codec": codec
    }

def extract_heatmap_data(info: Dict[str, Any]) -> List[Dict[str, float]]:
    heatmap_points = []
    heatmap = info.get("heatmap")
    if heatmap and isinstance(heatmap, list):
        for point in heatmap:
            heatmap_points.append({
                "start_time": float(point.get("start_time", 0.0)),
                "end_time": float(point.get("end_time", 0.0)),
                "value": float(point.get("value", 0.0))
            })
    return heatmap_points

def download_youtube_video(url: str, project_id: str, progress_callback=None) -> Tuple[Path, Dict[str, Any]]:
    target_dir = UPLOADS_DIR / project_id
    target_dir.mkdir(parents=True, exist_ok=True)

    for candidate in target_dir.glob("source.*"):
        if candidate.suffix.lower() in [".mp4", ".mkv", ".webm", ".mov"] and candidate.stat().st_size > 1024 * 1024:
            meta = probe_video(candidate)
            meta["title"] = "Downloaded Video"
            meta["heatmap"] = []
            meta["thumbnail_url"] = None
            return candidate, meta

    out_tmpl = str(target_dir / "source.%(ext)s")

    def _progress_hook(d):
        if progress_callback and d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            pct = round((downloaded / total * 100), 1) if total > 0 else 0.0
            speed = d.get("_speed_str", "").strip()
            eta = d.get("_eta_str", "").strip()
            progress_callback(pct, speed, eta)

    ydl_opts = {
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": out_tmpl,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "ffmpeg_location": FFMPEG_PATH,
        "progress_hooks": [_progress_hook] if progress_callback else [],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        video_path = Path(filename).with_suffix(".mp4")
        if not video_path.exists():
            for p in target_dir.glob("source.*"):
                if p.suffix.lower() in [".mp4", ".mkv", ".webm", ".mov"]:
                    video_path = p
                    break

    meta = probe_video(video_path)
    meta["title"] = info.get("title", "YouTube Video")
    meta["heatmap"] = extract_heatmap_data(info)
    meta["thumbnail_url"] = info.get("thumbnail")
    return video_path, meta

def save_uploaded_video(source_stream, filename: str, project_id: str) -> Tuple[Path, Dict[str, Any]]:
    target_dir = UPLOADS_DIR / project_id
    target_dir.mkdir(parents=True, exist_ok=True)
    
    clean_suffix = Path(filename).suffix or ".mp4"
    video_path = target_dir / f"source{clean_suffix}"
    
    with open(video_path, "wb") as buffer:
        while chunk := source_stream.read(1024 * 1024):
            buffer.write(chunk)
            
    meta = probe_video(video_path)
    meta["title"] = Path(filename).stem
    meta["heatmap"] = []
    meta["thumbnail_url"] = None
    return video_path, meta

def extract_audio_16k(video_path: Path, output_audio_path: Path) -> Path:
    output_audio_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        FFMPEG_PATH,
        "-y",
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_audio_path)
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
    return output_audio_path

