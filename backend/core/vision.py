import gc
import math
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import cv2
import numpy as np
from scenedetect import SceneManager, open_video, ContentDetector

from ..config import ensure_yunet_model, cleanup_vram

def detect_scene_cuts(video_path: Path, threshold: float = 27.0) -> List[Tuple[float, float]]:
    scenes: List[Tuple[float, float]] = []
    video = None
    try:
        video = open_video(str(video_path))
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=threshold, min_scene_len=15))
        scene_manager.detect_scenes(video)
        scene_list = scene_manager.get_scene_list()

        for scene in scene_list:
            start_sec = scene[0].get_seconds()
            end_sec = scene[1].get_seconds()
            scenes.append((round(start_sec, 3), round(end_sec, 3)))
    except Exception:
        pass
    finally:
        if video:
            try:
                del video
            except Exception:
                pass

    if not scenes:
        scenes = [(0.0, 99999.0)]
    return scenes

def calculate_mouth_activity(prev_landmarks: Optional[np.ndarray], curr_landmarks: np.ndarray) -> float:
    if prev_landmarks is None or curr_landmarks is None:
        return 0.0
    mouth_r_prev, mouth_l_prev = prev_landmarks[8:10], prev_landmarks[10:12]
    mouth_r_curr, mouth_l_curr = curr_landmarks[8:10], curr_landmarks[10:12]

    diff_r = np.linalg.norm(mouth_r_curr - mouth_r_prev)
    diff_l = np.linalg.norm(mouth_l_curr - mouth_l_prev)
    return float((diff_r + diff_l) / 2.0)

def analyze_video_faces_and_layout(
    video_path: Path,
    start_time: float,
    end_time: float,
    sample_fps: float = 3.0
) -> Dict[str, Any]:
    yunet_path = ensure_yunet_model()
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return {
            "layout_type": "cinematic",
            "primary_face_track": [],
            "secondary_face_track": [],
            "scene_cuts": []
        }

    source_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    source_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    detector = cv2.FaceDetectorYN.create(
        model=str(yunet_path),
        config="",
        input_size=(320, 320),
        score_threshold=0.6,
        nms_threshold=0.3,
        top_k=5000
    )

    cap.set(cv2.CAP_PROP_POS_MSEC, start_time * 1000.0)
    frame_step = max(1, int(fps / sample_fps))
    curr_time = start_time

    face_records: List[Dict[str, Any]] = []
    prev_landmarks_by_track: Dict[int, np.ndarray] = {}

    scene_cuts = detect_scene_cuts(video_path)
    relevant_cuts = [c[0] for c in scene_cuts if start_time <= c[0] <= end_time]

    scale_w = 320.0 / source_width
    scale_h = 320.0 / source_height

    while curr_time <= end_time:
        ret, frame = cap.read()
        if not ret:
            break

        small_frame = cv2.resize(frame, (320, 320))
        detector.setInputSize((320, 320))
        _, detected_faces = detector.detect(small_frame)

        frame_faces = []
        if detected_faces is not None:
            for face in detected_faces:
                bbox = face[0:4]
                conf = face[14]
                landmarks = face[4:14]

                orig_x = bbox[0] / scale_w
                orig_y = bbox[1] / scale_h
                orig_w = bbox[2] / scale_w
                orig_h = bbox[3] / scale_h

                orig_center_x = orig_x + (orig_w / 2.0)
                orig_center_y = orig_y + (orig_h / 2.0)

                frame_faces.append({
                    "bbox": [orig_x, orig_y, orig_w, orig_h],
                    "center": [orig_center_x, orig_center_y],
                    "confidence": float(conf),
                    "landmarks": landmarks
                })

        face_records.append({
            "timestamp": round(curr_time, 2),
            "faces": frame_faces
        })

        for _ in range(frame_step - 1):
            cap.grab()
        curr_time += frame_step / fps

    cap.release()
    del detector
    cleanup_vram()

    num_faces_counts = [len(r["faces"]) for r in face_records if r["faces"]]
    avg_faces = (sum(num_faces_counts) / len(num_faces_counts)) if num_faces_counts else 0

    if avg_faces < 0.4:
        layout_type = "cinematic"
    elif avg_faces >= 1.6:
        layout_type = "split_screen"
    else:
        layout_type = "single_speaker"

    primary_track = []
    secondary_track = []

    for r in face_records:
        t = r["timestamp"]
        faces = r["faces"]
        if not faces:
            primary_track.append({"timestamp": t, "x": source_width / 2.0, "y": source_height / 2.0, "w": 300, "h": 300})
            continue

        sorted_faces = sorted(faces, key=lambda f: f["bbox"][2] * f["bbox"][3], reverse=True)
        main_face = sorted_faces[0]
        primary_track.append({
            "timestamp": t,
            "x": main_face["center"][0],
            "y": main_face["center"][1],
            "w": main_face["bbox"][2],
            "h": main_face["bbox"][3]
        })

        if len(sorted_faces) > 1:
            sec_face = sorted_faces[1]
            secondary_track.append({
                "timestamp": t,
                "x": sec_face["center"][0],
                "y": sec_face["center"][1],
                "w": sec_face["bbox"][2],
                "h": sec_face["bbox"][3]
            })

    return {
        "layout_type": layout_type,
        "source_width": source_width,
        "source_height": source_height,
        "primary_face_track": primary_track,
        "secondary_face_track": secondary_track,
        "scene_cuts": relevant_cuts
    }

