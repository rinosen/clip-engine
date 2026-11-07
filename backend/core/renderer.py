import json
import os
import subprocess
import urllib.request
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from ..config import FFMPEG_PATH, FFPROBE_PATH, OUTPUTS_DIR, get_hardware_info
from .camera import compute_9x16_crop_dimensions, get_representative_crop_coordinates, compute_split_screen_crops

def escape_ffmpeg_path(p: Path) -> str:
    path_str = str(p.resolve()).replace("\\", "/")
    path_str = path_str.replace(":", "\\:")
    path_str = path_str.replace("'", "'\\\\''")
    return path_str

def fetch_pexels_broll(query: str, api_key: str, dest_path: Path) -> Optional[Path]:
    if not api_key or not query:
        return None
    try:
        url = f"https://api.pexels.com/videos/search?query={urllib.parse.quote(query)}&per_page=1&orientation=portrait"
        req = urllib.request.Request(url, headers={"Authorization": api_key, "User-Agent": "AutoClipper/1.0"})
        with urllib.request.urlopen(req, timeout=8) as response:
            data = json.loads(response.read().decode())
            videos = data.get("videos", [])
            if not videos:
                return None
            video_files = videos[0].get("video_files", [])
            sorted_files = sorted(video_files, key=lambda f: f.get("width", 0), reverse=True)
            if not sorted_files:
                return None
            download_url = sorted_files[0].get("link")
            
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(download_url, dest_path)
            return dest_path
    except Exception:
        return None

def build_single_pass_filtergraph(
    layout_type: str,
    source_w: int,
    source_h: int,
    crop_coords: Tuple[int, int, int, int],
    split_coords: Optional[Tuple[Tuple[int, int, int, int], Tuple[int, int, int, int]]],
    ass_path: Path,
    punch_in: bool = True,
    clip_duration: float = 30.0
) -> str:
    escaped_ass = escape_ffmpeg_path(ass_path)
    crop_x, crop_y, crop_w, crop_h = crop_coords

    filter_chains = []

    if layout_type == "split_screen" and split_coords:
        top_c, bot_c = split_coords
        tx, ty, tw, th = top_c
        bx, by, bw, bh = bot_c
        filter_chains.append(f"[0:v]crop={tw}:{th}:{tx}:{ty},scale=1080:960:flags=lanczos[v_top]")
        filter_chains.append(f"[0:v]crop={bw}:{bh}:{bx}:{by},scale=1080:960:flags=lanczos[v_bot]")
        filter_chains.append("[v_top][v_bot]vstack=inputs=2[v_base]")
    elif layout_type == "cinematic":
        filter_chains.append("[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg]")
        filter_chains.append("[0:v]scale=1080:-2:flags=lanczos[fg]")
        filter_chains.append("[bg][fg]overlay=(W-w)/2:(H-h)/2[v_base]")
    else:
        filter_chains.append(f"[0:v]crop={crop_w}:{crop_h}:{crop_x}:{crop_y},scale=1080:1920:flags=lanczos[v_base]")

    current_v = "[v_base]"
    
    if punch_in and clip_duration >= 10.0:
        punch_start = round(clip_duration * 0.35, 2)
        punch_end = round(punch_start + 2.2, 2)
        punch_w = int(1080 / 1.14)
        punch_h = int(1920 / 1.14)
        punch_x = (1080 - punch_w) // 2
        punch_y = (1920 - punch_h) // 2

        filter_chains.append(
            f"{current_v}split=2[main_v][punch_src];"
            f"[punch_src]crop={punch_w}:{punch_h}:{punch_x}:{punch_y},scale=1080:1920:flags=lanczos[punch_zoomed];"
            f"[main_v][punch_zoomed]overlay=0:0:enable='between(t,{punch_start},{punch_end})'[v_punched]"
        )
        current_v = "[v_punched]"

    filter_chains.append(f"{current_v}ass='{escaped_ass}'[v_out]")

    return ";".join(filter_chains)

def render_vertical_clip(
    source_video_path: Path,
    start_time: float,
    end_time: float,
    layout_type: str,
    source_w: int,
    source_h: int,
    camera_path: List[Dict[str, Any]],
    ass_subtitle_path: Path,
    output_clip_path: Path,
    broll_query: Optional[str] = None,
    pexels_key: Optional[str] = None,
    hardware_mode: str = "auto"
) -> Path:
    output_clip_path.parent.mkdir(parents=True, exist_ok=True)
    duration = end_time - start_time
    crop_coords = get_representative_crop_coordinates(camera_path, source_w, source_h)

    split_coords = None
    if layout_type == "split_screen":
        p_x = crop_coords[0] + (crop_coords[2] // 2)
        s_x = source_w - p_x
        split_coords = compute_split_screen_crops(p_x, s_x, source_w, source_h)

    filter_str = build_single_pass_filtergraph(
        layout_type=layout_type,
        source_w=source_w,
        source_h=source_h,
        crop_coords=crop_coords,
        split_coords=split_coords,
        ass_path=ass_subtitle_path,
        punch_in=True,
        clip_duration=duration
    )

    hw = get_hardware_info()
    use_nvenc = False
    if hardware_mode == "nvenc":
        use_nvenc = True
    elif hardware_mode == "auto" and hw.get("nvenc_available"):
        use_nvenc = True

    video_encode_args = [
        "-c:v", "h264_nvenc",
        "-preset", "p4",
        "-cq", "22",
        "-b:v", "4500k",
        "-maxrate", "6000k",
        "-bufsize", "8000k",
        "-pix_fmt", "yuv420p"
    ] if use_nvenc else [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-b:v", "4500k",
        "-maxrate", "6000k",
        "-bufsize", "8000k",
        "-pix_fmt", "yuv420p"
    ]

    audio_filter = "loudnorm=I=-16:TP=-1.0:LRA=11"

    cmd = [
        FFMPEG_PATH,
        "-y",
        "-ss", str(start_time),
        "-to", str(end_time),
        "-i", str(source_video_path),
        "-filter_complex", filter_str,
        "-map", "[v_out]",
        "-map", "0:a?",
        "-af", audio_filter,
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        *video_encode_args,
        "-movflags", "+faststart",
        str(output_clip_path)
    ]

    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
    except subprocess.CalledProcessError as err:
        if use_nvenc:
            fallback_cmd = [
                FFMPEG_PATH,
                "-y",
                "-ss", str(start_time),
                "-to", str(end_time),
                "-i", str(source_video_path),
                "-filter_complex", filter_str,
                "-map", "[v_out]",
                "-map", "0:a?",
                "-af", audio_filter,
                "-c:a", "aac",
                "-b:a", "192k",
                "-ar", "48000",
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "22",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                str(output_clip_path)
            ]
            subprocess.run(fallback_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
        else:
            raise err

    thumb_path = output_clip_path.with_suffix(".jpg")
    thumb_cmd = [
        FFMPEG_PATH,
        "-y",
        "-ss", "00:00:01.000",
        "-i", str(output_clip_path),
        "-vframes", "1",
        "-q:v", "2",
        str(thumb_path)
    ]
    try:
        subprocess.run(thumb_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    return output_clip_path

