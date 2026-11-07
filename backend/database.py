import datetime
import json
from typing import Optional, List, Dict, Any
from sqlalchemy import create_engine, Column, String, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from .config import DATABASE_URL

Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True)
    title = Column(String(255), nullable=False)
    source_type = Column(String(32), default="upload")
    source_url = Column(String(1024), nullable=True)
    source_file = Column(String(1024), nullable=False)
    duration = Column(Float, default=0.0)
    width = Column(Integer, default=1920)
    height = Column(Integer, default=1080)
    fps = Column(Float, default=30.0)
    status = Column(String(64), default="pending")
    progress = Column(Float, default=0.0)
    current_stage = Column(String(128), default="queued")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    clips = relationship("Clip", back_populates="project", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "source_type": self.source_type,
            "source_url": self.source_url,
            "source_file": self.source_file,
            "duration": self.duration,
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "status": self.status,
            "progress": self.progress,
            "current_stage": self.current_stage,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "clips_count": len(self.clips) if self.clips else 0
        }

class Clip(Base):
    __tablename__ = "clips"

    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    hook = Column(String(512), nullable=False)
    virality_score = Column(Integer, default=75)
    virality_explanation = Column(Text, default="")
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    duration = Column(Float, nullable=False)
    transcript_json = Column(Text, default="[]")
    layout_type = Column(String(64), default="single_speaker")
    rendered_video_path = Column(String(1024), nullable=True)
    ass_subtitle_path = Column(String(1024), nullable=True)
    capcut_draft_path = Column(String(1024), nullable=True)
    status = Column(String(64), default="curated")
    subtitle_style = Column(String(64), default="hormozi")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="clips")

    def to_dict(self) -> Dict[str, Any]:
        try:
            transcript = json.loads(self.transcript_json) if self.transcript_json else []
        except Exception:
            transcript = []

        return {
            "id": self.id,
            "project_id": self.project_id,
            "title": self.title,
            "hook": self.hook,
            "virality_score": self.virality_score,
            "virality_explanation": self.virality_explanation,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": self.duration,
            "transcript": transcript,
            "layout_type": self.layout_type,
            "subtitle_style": self.subtitle_style or "hormozi",
            "rendered_video_path": self.rendered_video_path,
            "ass_subtitle_path": self.ass_subtitle_path,
            "capcut_draft_path": self.capcut_draft_path,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class AppSettings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, default=1)
    gemini_api_key = Column(String(255), default="")
    pexels_api_key = Column(String(255), default="")
    whisper_model = Column(String(64), default="base")
    subtitle_style = Column(String(64), default="hormozi")
    hardware_mode = Column(String(32), default="auto")
    max_clips = Column(Integer, default=4)
    min_duration = Column(Integer, default=20)
    max_duration = Column(Integer, default=60)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "gemini_api_key": self.gemini_api_key or "",
            "pexels_api_key": self.pexels_api_key or "",
            "whisper_model": self.whisper_model or "base",
            "subtitle_style": self.subtitle_style or "hormozi",
            "hardware_mode": self.hardware_mode or "auto",
            "max_clips": self.max_clips or 4,
            "min_duration": self.min_duration or 20,
            "max_duration": self.max_duration or 60
        }

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

def init_db():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        if not settings:
            settings = AppSettings(id=1)
            db.add(settings)
            db.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

