import asyncio
import json
import logging
import traceback
import uuid
from pathlib import Path
from typing import Dict, Any, Optional, Set
from fastapi import WebSocket

from .config import DATA_DIR, UPLOADS_DIR, OUTPUTS_DIR, cleanup_vram
from .database import SessionLocal, Project, Clip, AppSettings
from .core.ingest import probe_video, extract_audio_16k, download_youtube_video
from .core.transcribe import transcribe_audio_words
from .core.director import curate_viral_clips
from .core.vision import analyze_video_faces_and_layout
from .core.camera import generate_smoothed_camera_path
from .core.subtitles import generate_karaoke_ass
from .core.renderer import render_vertical_clip
from .core.exporter import generate_capcut_draft_json, generate_remotion_props

logger = logging.getLogger("autoclipper.worker")

class ProgressNotifier:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, project_id: str, websocket: WebSocket):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = set()
        self.active_connections[project_id].add(websocket)

    def disconnect(self, project_id: str, websocket: WebSocket):
        if project_id in self.active_connections:
            self.active_connections[project_id].discard(websocket)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def broadcast(self, project_id: str, data: Dict[str, Any]):
        if project_id in self.active_connections:
            dead = set()
            for ws in self.active_connections[project_id]:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.active_connections[project_id].discard(ws)

notifier = ProgressNotifier()
job_queue: asyncio.Queue = asyncio.Queue()
gpu_lock = asyncio.Lock()

async def emit_progress(project_id: str, stage: str, progress: float, message: str, extra: Optional[Dict[str, Any]] = None):
    with SessionLocal() as db:
        p = db.query(Project).filter(Project.id == project_id).first()
        if p:
            p.current_stage = stage
            p.progress = round(progress, 1)
            db.commit()

    payload = {
        "project_id": project_id,
        "stage": stage,
        "progress": round(progress, 1),
        "message": message,
        **(extra or {})
    }
    await notifier.broadcast(project_id, payload)

async def process_project_pipeline(project_id: str):
    async with gpu_lock:
        try:
            with SessionLocal() as db:
                project = db.query(Project).filter(Project.id == project_id).first()
                settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
                if not project:
                    return
                
                project.status = "processing"
                db.commit()

                whisper_model = settings.whisper_model if settings else "base"
                subtitle_style = settings.subtitle_style if settings else "hormozi"
                gemini_key = settings.gemini_api_key if settings else ""
                pexels_key = settings.pexels_api_key if settings else ""
                hardware_mode = settings.hardware_mode if settings else "auto"
                max_clips = settings.max_clips if settings else 4
                min_dur = settings.min_duration if settings else 20
                max_dur = settings.max_duration if settings else 60

                source_type = project.source_type
                source_url = project.source_url
                source_file = project.source_file or ""

            source_path = Path(source_file)
            heatmap_data = []

            loop = asyncio.get_running_loop()
            last_download_pct = 0.0

            def on_download_progress(pct: float, speed: str, eta: str):
                nonlocal last_download_pct
                if pct - last_download_pct >= 2.0 or pct >= 99.0:
                    last_download_pct = pct
                    mapped_progress = round(5.0 + (pct * 0.10), 1)
                    speed_info = f" ({speed}" + (f", ETA {eta})" if eta else ")") if speed else ""
                    asyncio.run_coroutine_threadsafe(
                        emit_progress(project_id, "ingesting", mapped_progress, f"Downloading video: {pct:.0f}%{speed_info}"),
                        loop
                    )

            await emit_progress(project_id, "ingesting", 5.0, "Ingesting video source and probing metadata...")
            if source_type == "url" and source_url:
                source_path, meta = await asyncio.to_thread(
                    download_youtube_video, source_url, project_id, on_download_progress
                )
                heatmap_data = meta.get("heatmap", [])
                with SessionLocal() as db:
                    p = db.query(Project).filter(Project.id == project_id).first()
                    p.source_file = str(source_path)
                    p.title = meta.get("title", p.title)
                    p.width = meta.get("width", 1920)
                    p.height = meta.get("height", 1080)
                    p.fps = meta.get("fps", 30.0)
                    p.duration = meta.get("duration", 0.0)
                    db.commit()
            else:
                meta = await asyncio.to_thread(probe_video, source_path)
                with SessionLocal() as db:
                    p = db.query(Project).filter(Project.id == project_id).first()
                    p.width = meta.get("width", 1920)
                    p.height = meta.get("height", 1080)
                    p.fps = meta.get("fps", 30.0)
                    p.duration = meta.get("duration", 0.0)
                    db.commit()

            audio_16k_path = UPLOADS_DIR / project_id / "audio_16k.wav"
            if not audio_16k_path.exists() or audio_16k_path.stat().st_size < 1000:
                await emit_progress(project_id, "audio_extract", 15.0, "Extracting 16kHz speech track...")
                await asyncio.to_thread(extract_audio_16k, source_path, audio_16k_path)
            else:
                await emit_progress(project_id, "audio_extract", 15.0, "Reusing existing audio track...")

            await emit_progress(project_id, "transcribing", 25.0, f"Transcribing audio with faster-whisper ({whisper_model})...")
            words, energy_profile, full_text = await asyncio.to_thread(
                transcribe_audio_words,
                audio_path=audio_16k_path,
                model_size=whisper_model,
                device_override=hardware_mode
            )

            cleanup_vram()

            await emit_progress(project_id, "curating", 45.0, "AI Director evaluating viral hooks and narrative arcs...")
            curated_clips = await asyncio.to_thread(
                curate_viral_clips,
                words=words,
                full_text=full_text,
                heatmap_data=heatmap_data,
                energy_profile=energy_profile,
                api_key=gemini_key,
                max_clips=max_clips,
                min_duration=min_dur,
                max_duration=max_dur
            )

            created_clip_ids = []
            with SessionLocal() as db:
                for c in curated_clips:
                    clip_id = str(uuid.uuid4())
                    db_clip = Clip(
                        id=clip_id,
                        project_id=project_id,
                        title=c["title"],
                        hook=c["hook"],
                        virality_score=c["virality_score"],
                        virality_explanation=c["virality_explanation"],
                        start_time=c["start_time"],
                        end_time=c["end_time"],
                        duration=c["duration"],
                        transcript_json=json.dumps(c["transcript_words"]),
                        layout_type="single_speaker",
                        subtitle_style=subtitle_style,
                        status="curated"
                    )
                    db.add(db_clip)
                    created_clip_ids.append(clip_id)
                db.commit()

            total_clips = len(created_clip_ids)
            for idx, clip_id in enumerate(created_clip_ids):
                clip_base_prog = 55.0 + ((idx / max(1, total_clips)) * 40.0)
                await emit_progress(
                    project_id,
                    "tracking",
                    clip_base_prog,
                    f"Tracking faces & camera layout for Clip {idx+1}/{total_clips}..."
                )

                with SessionLocal() as db:
                    clip_rec = db.query(Clip).filter(Clip.id == clip_id).first()
                    start_t = clip_rec.start_time
                    end_t = clip_rec.end_time
                    hook_t = clip_rec.hook
                    title_t = clip_rec.title
                    clip_words = json.loads(clip_rec.transcript_json)

                vision_data = await asyncio.to_thread(
                    analyze_video_faces_and_layout,
                    video_path=source_path,
                    start_time=start_t,
                    end_time=end_t
                )
                cleanup_vram()

                layout_type = vision_data["layout_type"]
                camera_path = generate_smoothed_camera_path(
                    track_points=vision_data["primary_face_track"],
                    source_w=vision_data["source_width"],
                    source_h=vision_data["source_height"],
                    scene_cuts=vision_data["scene_cuts"]
                )

                clip_output_dir = OUTPUTS_DIR / project_id / clip_id
                clip_output_dir.mkdir(parents=True, exist_ok=True)

                # Persist camera path and layout metadata for accurate re-rendering
                camera_file = clip_output_dir / "camera_path.json"
                try:
                    with open(camera_file, "w", encoding="utf-8") as f:
                        json.dump({
                            "camera_path": camera_path,
                            "layout_type": layout_type,
                            "source_w": vision_data["source_width"],
                            "source_h": vision_data["source_height"]
                        }, f)
                except Exception:
                    pass
                
                ass_file = clip_output_dir / "karaoke.ass"
                await asyncio.to_thread(
                    generate_karaoke_ass,
                    words=clip_words,
                    output_path=ass_file,
                    hook_text=hook_t,
                    style_name=subtitle_style,
                    clip_offset=start_t
                )

                await emit_progress(
                    project_id,
                    "rendering",
                    clip_base_prog + 5.0,
                    f"FFmpeg NVENC rendering vertical 1080x1920 for Clip {idx+1}/{total_clips}..."
                )

                rendered_mp4 = clip_output_dir / "short.mp4"
                await asyncio.to_thread(
                    render_vertical_clip,
                    source_video_path=source_path,
                    start_time=start_t,
                    end_time=end_t,
                    layout_type=layout_type,
                    source_w=vision_data["source_width"],
                    source_h=vision_data["source_height"],
                    camera_path=camera_path,
                    ass_subtitle_path=ass_file,
                    output_clip_path=rendered_mp4,
                    hardware_mode=hardware_mode
                )

                capcut_zip = generate_capcut_draft_json(
                    clip_title=title_t,
                    video_path=rendered_mp4,
                    words=clip_words,
                    duration_sec=end_t - start_t,
                    output_dir=clip_output_dir
                )

                with SessionLocal() as db:
                    c_up = db.query(Clip).filter(Clip.id == clip_id).first()
                    c_up.layout_type = layout_type
                    c_up.rendered_video_path = str(rendered_mp4)
                    c_up.ass_subtitle_path = str(ass_file)
                    c_up.capcut_draft_path = str(capcut_zip)
                    c_up.status = "ready"
                    db.commit()

            with SessionLocal() as db:
                p = db.query(Project).filter(Project.id == project_id).first()
                p.status = "completed"
                p.progress = 100.0
                p.current_stage = "completed"
                db.commit()

            await emit_progress(project_id, "completed", 100.0, "All viral shorts generated successfully!", {"completed": True})

        except Exception as e:
            logger.error(f"Pipeline error for project {project_id}: {str(e)}", exc_info=True)
            with SessionLocal() as db:
                p = db.query(Project).filter(Project.id == project_id).first()
                if p:
                    p.status = "failed"
                    p.error_message = str(e)
                    db.commit()
            await emit_progress(project_id, "failed", 100.0, f"Error: {str(e)}", {"error": str(e)})
        finally:
            cleanup_vram()

async def worker_loop():
    while True:
        project_id = await job_queue.get()
        try:
            await process_project_pipeline(project_id)
        except Exception as err:
            logger.error(f"Worker queue crash on {project_id}: {err}")
        finally:
            job_queue.task_done()

