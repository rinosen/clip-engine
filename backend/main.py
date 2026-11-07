import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

import shutil
from .config import DATA_DIR, UPLOADS_DIR, OUTPUTS_DIR, FFMPEG_PATH, get_hardware_info
from .database import init_db, get_db, SessionLocal, Project, Clip, AppSettings
from .worker import job_queue, worker_loop, notifier, emit_progress
from .core.ingest import save_uploaded_video
from .core.subtitles import generate_karaoke_ass
from .core.renderer import render_vertical_clip
from .core.camera import generate_smoothed_camera_path
from .core.vision import analyze_video_faces_and_layout
from .core.exporter import generate_capcut_draft_json, generate_remotion_props, generate_fcpxml

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with SessionLocal() as db:
        stuck = db.query(Project).filter(Project.status.in_(["processing", "queued"])).all()
        for p in stuck:
            p.status = "failed"
            p.error_message = "Server restarted or previous job was interrupted. Please retry or delete."
            p.current_stage = "failed"
        if stuck:
            db.commit()
    worker_task = asyncio.create_task(worker_loop())
    yield
    worker_task.cancel()

app = FastAPI(title="AutoClipper AI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=str(DATA_DIR)), name="media")

class UrlSubmission(BaseModel):
    url: str

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    pexels_api_key: Optional[str] = None
    whisper_model: Optional[str] = None
    subtitle_style: Optional[str] = None
    hardware_mode: Optional[str] = None
    max_clips: Optional[int] = None
    min_duration: Optional[int] = None
    max_duration: Optional[int] = None

class RerenderRequest(BaseModel):
    hook: Optional[str] = None
    subtitle_style: Optional[str] = "hormozi"
    transcript: Optional[List[Dict[str, Any]]] = None

@app.get("/api/health")
def health():
    hw = get_hardware_info()
    return {
        "status": "online",
        "ffmpeg_path": FFMPEG_PATH,
        "hardware": hw,
        "queue_size": job_queue.qsize()
    }

@app.get("/api/projects")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [p.to_dict() for p in projects]

@app.post("/api/projects/url")
async def create_project_from_url(payload: UrlSubmission, db: Session = Depends(get_db)):
    if not payload.url or not payload.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    
    project_id = str(uuid.uuid4())
    project = Project(
        id=project_id,
        title=f"Processing {payload.url[:30]}...",
        source_type="url",
        source_url=payload.url.strip(),
        source_file="",
        status="queued",
        progress=0.0,
        current_stage="queued"
    )
    db.add(project)
    db.commit()

    await job_queue.put(project_id)
    return project.to_dict()

@app.post("/api/projects/upload")
async def create_project_from_upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file")

    project_id = str(uuid.uuid4())
    video_path, meta = save_uploaded_video(file.file, file.filename, project_id)

    project = Project(
        id=project_id,
        title=meta.get("title", file.filename),
        source_type="upload",
        source_url=None,
        source_file=str(video_path),
        duration=meta.get("duration", 0.0),
        width=meta.get("width", 1920),
        height=meta.get("height", 1080),
        fps=meta.get("fps", 30.0),
        status="queued",
        progress=0.0,
        current_stage="queued"
    )
    db.add(project)
    db.commit()

    await job_queue.put(project_id)
    return project.to_dict()

@app.get("/api/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    data = project.to_dict()
    clips = db.query(Clip).filter(Clip.project_id == project_id).order_by(Clip.virality_score.desc()).all()
    data["clips"] = [c.to_dict() for c in clips]
    return data

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.query(Clip).filter(Clip.project_id == project_id).delete()
    db.delete(project)
    db.commit()

    upload_dir = UPLOADS_DIR / project_id
    if upload_dir.exists():
        shutil.rmtree(upload_dir, ignore_errors=True)
    output_dir = OUTPUTS_DIR / project_id
    if output_dir.exists():
        shutil.rmtree(output_dir, ignore_errors=True)

    return {"status": "deleted", "id": project_id}

@app.post("/api/projects/{project_id}/retry")
async def retry_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.status = "queued"
    project.progress = 0.0
    project.current_stage = "queued"
    project.error_message = None
    db.commit()

    await job_queue.put(project_id)
    return project.to_dict()

@app.get("/api/clips/{clip_id}")
def get_clip(clip_id: str, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    return clip.to_dict()

@app.post("/api/clips/{clip_id}/rerender")
async def rerender_clip(clip_id: str, payload: RerenderRequest, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    
    project = db.query(Project).filter(Project.id == clip.project_id).first()
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()

    if payload.hook is not None:
        clip.hook = payload.hook
    if payload.transcript is not None:
        clip.transcript_json = json.dumps(payload.transcript)
    if payload.subtitle_style is not None:
        clip.subtitle_style = payload.subtitle_style
    db.commit()

    clip_words = json.loads(clip.transcript_json)
    clip_output_dir = OUTPUTS_DIR / project.id / clip_id
    ass_file = clip_output_dir / "karaoke.ass"
    
    style_name = payload.subtitle_style or clip.subtitle_style or (settings.subtitle_style if settings else "hormozi")
    await asyncio.to_thread(
        generate_karaoke_ass,
        words=clip_words,
        output_path=ass_file,
        hook_text=clip.hook,
        style_name=style_name,
        clip_offset=clip.start_time
    )

    camera_file = clip_output_dir / "camera_path.json"
    layout_type = clip.layout_type or "single_speaker"
    camera_path = []

    if camera_file.exists():
        try:
            with open(camera_file, "r", encoding="utf-8") as f:
                cam_data = json.load(f)
                camera_path = cam_data.get("camera_path", [])
                layout_type = cam_data.get("layout_type", layout_type)
        except Exception:
            camera_path = []

    if not camera_path:
        # Track speaker face so face cam is centered accurately on the speaker
        vision_data = await asyncio.to_thread(
            analyze_video_faces_and_layout,
            video_path=Path(project.source_file),
            start_time=clip.start_time,
            end_time=clip.end_time
        )
        layout_type = vision_data["layout_type"]
        camera_path = generate_smoothed_camera_path(
            track_points=vision_data["primary_face_track"],
            source_w=vision_data["source_width"],
            source_h=vision_data["source_height"],
            scene_cuts=vision_data["scene_cuts"]
        )
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

    rendered_mp4 = clip_output_dir / "short.mp4"
    await asyncio.to_thread(
        render_vertical_clip,
        source_video_path=Path(project.source_file),
        start_time=clip.start_time,
        end_time=clip.end_time,
        layout_type=layout_type,
        source_w=project.width,
        source_h=project.height,
        camera_path=camera_path,
        ass_subtitle_path=ass_file,
        output_clip_path=rendered_mp4,
        hardware_mode=settings.hardware_mode if settings else "auto"
    )

    clip.rendered_video_path = str(rendered_mp4)
    clip.ass_subtitle_path = str(ass_file)
    db.commit()

    return clip.to_dict()

@app.get("/api/clips/{clip_id}/export/{format}")
def export_clip(clip_id: str, format: str, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    project = db.query(Project).filter(Project.id == clip.project_id).first()

    words = json.loads(clip.transcript_json) if clip.transcript_json else []
    clip_output_dir = OUTPUTS_DIR / project.id / clip_id

    if format.lower() == "capcut":
        zip_file = generate_capcut_draft_json(
            clip_title=clip.title,
            video_path=Path(clip.rendered_video_path or project.source_file),
            words=words,
            duration_sec=clip.duration,
            output_dir=clip_output_dir
        )
        return FileResponse(
            path=str(zip_file),
            filename=f"CapCut_{clip.title[:20].strip().replace(' ', '_')}.zip",
            media_type="application/zip"
        )
    elif format.lower() == "remotion":
        relative_url = f"/media/outputs/{project.id}/{clip.id}/short.mp4"
        props = generate_remotion_props(
            clip_title=clip.title,
            video_relative_url=relative_url,
            words=words,
            hook_text=clip.hook,
            duration_sec=clip.duration,
            fps=project.fps or 30.0
        )
        return JSONResponse(content=props)
    elif format.lower() == "fcpxml":
        xml_content = generate_fcpxml(
            clip_title=clip.title,
            video_path=Path(clip.rendered_video_path or project.source_file),
            duration_sec=clip.duration,
            fps=int(project.fps or 30)
        )
        xml_path = clip_output_dir / "export.fcpxml"
        with open(xml_path, "w", encoding="utf-8") as f:
            f.write(xml_content)
        return FileResponse(
            path=str(xml_path),
            filename=f"{clip.title[:20].strip().replace(' ', '_')}.fcpxml",
            media_type="application/xml"
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Supported: capcut, remotion, fcpxml")

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
    return settings.to_dict()

@app.post("/api/settings")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)

    if payload.gemini_api_key is not None:
        settings.gemini_api_key = payload.gemini_api_key
    if payload.pexels_api_key is not None:
        settings.pexels_api_key = payload.pexels_api_key
    if payload.whisper_model is not None:
        settings.whisper_model = payload.whisper_model
    if payload.subtitle_style is not None:
        settings.subtitle_style = payload.subtitle_style
    if payload.hardware_mode is not None:
        settings.hardware_mode = payload.hardware_mode
    if payload.max_clips is not None:
        settings.max_clips = payload.max_clips
    if payload.min_duration is not None:
        settings.min_duration = payload.min_duration
    if payload.max_duration is not None:
        settings.max_duration = payload.max_duration

    db.commit()
    return settings.to_dict()

@app.websocket("/ws/progress/{project_id}")
async def websocket_progress(websocket: WebSocket, project_id: str):
    await notifier.connect(project_id, websocket)
    try:
        with SessionLocal() as db:
            p = db.query(Project).filter(Project.id == project_id).first()
            if p:
                await websocket.send_json({
                    "project_id": p.id,
                    "stage": p.current_stage,
                    "progress": p.progress,
                    "message": f"Status: {p.status.capitalize()} ({p.current_stage})",
                    "status": p.status,
                    "error": p.error_message,
                    "completed": p.status == "completed"
                })
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notifier.disconnect(project_id, websocket)
    except Exception:
        notifier.disconnect(project_id, websocket)

