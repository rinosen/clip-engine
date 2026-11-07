import math
from typing import List, Dict, Any, Tuple

def compute_9x16_crop_dimensions(source_w: int, source_h: int) -> Tuple[int, int]:
    target_ratio = 9.0 / 16.0
    crop_h = source_h
    crop_w = int(round(crop_h * target_ratio))
    if crop_w % 2 != 0:
        crop_w -= 1
    if crop_w > source_w:
        crop_w = source_w
        crop_h = int(round(crop_w / target_ratio))
        if crop_h % 2 != 0:
            crop_h -= 1
    return crop_w, crop_h

def generate_smoothed_camera_path(
    track_points: List[Dict[str, Any]],
    source_w: int,
    source_h: int,
    scene_cuts: List[float],
    deadzone_ratio: float = 0.05,
    ema_alpha: float = 0.15
) -> List[Dict[str, Any]]:
    crop_w, crop_h = compute_9x16_crop_dimensions(source_w, source_h)
    deadzone_px = source_w * deadzone_ratio
    max_x = max(0, source_w - crop_w)
    
    smoothed_path: List[Dict[str, Any]] = []
    if not track_points:
        default_x = (source_w - crop_w) // 2
        return [{"timestamp": 0.0, "x": default_x, "y": 0, "w": crop_w, "h": crop_h}]

    curr_camera_x = float(track_points[0]["x"] - (crop_w / 2.0))
    curr_camera_x = max(0.0, min(float(max_x), curr_camera_x))

    scene_cuts_set = sorted(scene_cuts)

    for pt in track_points:
        t = pt["timestamp"]
        face_x = pt["x"]
        
        is_scene_cut = any(abs(t - cut) < 0.25 for cut in scene_cuts_set)
        
        target_camera_x = face_x - (crop_w / 2.0)
        target_camera_x = max(0.0, min(float(max_x), target_camera_x))

        if is_scene_cut:
            curr_camera_x = target_camera_x
        else:
            diff = target_camera_x - curr_camera_x
            if abs(diff) > deadzone_px:
                effective_target = target_camera_x - (math.copysign(deadzone_px, diff))
                curr_camera_x = (ema_alpha * effective_target) + ((1.0 - ema_alpha) * curr_camera_x)

        clamped_x = int(round(max(0.0, min(float(max_x), curr_camera_x))))
        if clamped_x % 2 != 0:
            clamped_x -= 1

        smoothed_path.append({
            "timestamp": t,
            "x": clamped_x,
            "y": 0,
            "w": crop_w,
            "h": crop_h
        })

    return smoothed_path

def get_representative_crop_coordinates(
    camera_path: List[Dict[str, Any]],
    source_w: int,
    source_h: int
) -> Tuple[int, int, int, int]:
    crop_w, crop_h = compute_9x16_crop_dimensions(source_w, source_h)
    if not camera_path:
        return ((source_w - crop_w) // 2), 0, crop_w, crop_h
    
    xs = [p["x"] for p in camera_path]
    median_x = int(sorted(xs)[len(xs) // 2])
    if median_x % 2 != 0:
        median_x -= 1
    return median_x, 0, crop_w, crop_h

def compute_split_screen_crops(
    primary_x: float,
    secondary_x: float,
    source_w: int,
    source_h: int
) -> Tuple[Tuple[int, int, int, int], Tuple[int, int, int, int]]:
    target_ratio = 9.0 / 8.0
    half_h = source_h
    half_w = int(round(half_h * target_ratio))
    if half_w % 2 != 0:
        half_w -= 1
    if half_w > source_w:
        half_w = source_w

    def clamp_crop(cx: float):
        x = int(cx - (half_w / 2.0))
        x = max(0, min(source_w - half_w, x))
        if x % 2 != 0:
            x -= 1
        return (x, 0, half_w, half_h)

    top_crop = clamp_crop(primary_x)
    bottom_crop = clamp_crop(secondary_x)
    return top_crop, bottom_crop

