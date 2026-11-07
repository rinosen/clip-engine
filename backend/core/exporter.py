import json
import uuid
import zipfile
from pathlib import Path
from typing import Dict, Any, List

def generate_capcut_draft_json(
    clip_title: str,
    video_path: Path,
    words: List[Dict[str, Any]],
    duration_sec: float,
    output_dir: Path
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    video_id = str(uuid.uuid4())
    audio_id = str(uuid.uuid4())
    duration_us = int(duration_sec * 1_000_000)

    texts = []
    text_segments = []
    
    for i, w in enumerate(words):
        t_id = str(uuid.uuid4())
        seg_id = str(uuid.uuid4())
        start_us = int(w["start"] * 1_000_000)
        end_us = int(w["end"] * 1_000_000)
        dur_w_us = max(100_000, end_us - start_us)

        texts.append({
            "id": t_id,
            "content": json.dumps({"text": w["word"].upper()}),
            "font_size": 14.0,
            "text_color": "#FFD700" if i % 2 == 0 else "#FFFFFF",
            "type": "text"
        })
        text_segments.append({
            "id": seg_id,
            "material_id": t_id,
            "target_timerange": {"start": start_us, "duration": dur_w_us}
        })

    capcut_draft = {
        "canvas_config": {"width": 1080, "height": 1920, "ratio": "9:16"},
        "fps": 30.0,
        "duration": duration_us,
        "materials": {
            "videos": [{
                "id": video_id,
                "path": str(video_path.resolve()),
                "duration": duration_us,
                "type": "video"
            }],
            "audios": [{
                "id": audio_id,
                "path": str(video_path.resolve()),
                "duration": duration_us,
                "type": "audio"
            }],
            "texts": texts,
            "speeds": []
        },
        "tracks": [
            {
                "id": str(uuid.uuid4()),
                "type": "video",
                "segments": [{
                    "id": str(uuid.uuid4()),
                    "material_id": video_id,
                    "target_timerange": {"start": 0, "duration": duration_us},
                    "source_timerange": {"start": 0, "duration": duration_us}
                }]
            },
            {
                "id": str(uuid.uuid4()),
                "type": "text",
                "segments": text_segments
            }
        ]
    }

    draft_file = output_dir / "draft_content.json"
    with open(draft_file, "w", encoding="utf-8") as f:
        json.dump(capcut_draft, f, indent=2)

    zip_path = output_dir / f"capcut_draft_{clip_title[:20].strip().replace(' ', '_')}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(draft_file, arcname="draft_content.json")

    return zip_path

def generate_remotion_props(
    clip_title: str,
    video_relative_url: str,
    words: List[Dict[str, Any]],
    hook_text: str,
    duration_sec: float,
    fps: float = 30.0
) -> Dict[str, Any]:
    duration_frames = int(round(duration_sec * fps))

    subtitles_data = []
    for w in words:
        subtitles_data.append({
            "word": w["word"],
            "startFrame": int(round(w["start"] * fps)),
            "endFrame": int(round(w["end"] * fps)),
            "probability": w.get("probability", 1.0)
        })

    return {
        "title": clip_title,
        "videoSrc": video_relative_url,
        "width": 1080,
        "height": 1920,
        "fps": fps,
        "durationInFrames": duration_frames,
        "durationInSeconds": duration_sec,
        "hook": {
            "text": hook_text,
            "displayDurationFrames": int(3.0 * fps)
        },
        "subtitles": subtitles_data,
        "stylePreset": "hormozi",
        "aspectRatio": "9:16"
    }

def generate_fcpxml(
    clip_title: str,
    video_path: Path,
    duration_sec: float,
    fps: int = 30
) -> str:
    frame_dur = f"100/{fps * 100}s"
    total_dur_str = f"{int(duration_sec * fps)}00/{fps * 100}s"

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
    <resources>
        <format id="r1" name="FFVideoFormat1080x1920p30" frameDuration="{frame_dur}" width="1080" height="1920"/>
        <asset id="r2" name="{clip_title}" src="file://{str(video_path.resolve()).replace('\\', '/')}" duration="{total_dur_str}" hasVideo="1" hasAudio="1"/>
    </resources>
    <library>
        <event name="AutoClipper Event">
            <project name="{clip_title}">
                <sequence format="r1" duration="{total_dur_str}">
                    <spine>
                        <clip name="{clip_title}" ref="r2" duration="{total_dur_str}" start="0s"/>
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>"""
    return xml

