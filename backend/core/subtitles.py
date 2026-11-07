import re
from pathlib import Path
from typing import List, Dict, Any, Optional

STYLE_PRESETS = {
    "hormozi": {
        "fontname": "Arial",
        "fontsize": 68,
        "primary_color": "&H00FFFFFF",
        "highlight_color": "&H0000FFFF",
        "outline_color": "&H00000000",
        "back_color": "&H80000000",
        "bold": 1,
        "outline": 5.0,
        "shadow": 2.0,
        "alignment": 2,
        "margin_v": 440,
        "uppercase": True
    },
    "mrbeast": {
        "fontname": "Arial Black",
        "fontsize": 72,
        "primary_color": "&H00FFFFFF",
        "highlight_color": "&H0024E01B",
        "outline_color": "&H00000000",
        "back_color": "&H00000000",
        "bold": 1,
        "outline": 6.0,
        "shadow": 3.0,
        "alignment": 2,
        "margin_v": 460,
        "uppercase": True
    },
    "neon": {
        "fontname": "Trebuchet MS",
        "fontsize": 64,
        "primary_color": "&H00E0E0E0",
        "highlight_color": "&H00FFFF00",
        "outline_color": "&H00800080",
        "back_color": "&H40000000",
        "bold": 1,
        "outline": 4.0,
        "shadow": 0.0,
        "alignment": 2,
        "margin_v": 430,
        "uppercase": False
    },
    "minimal": {
        "fontname": "Helvetica",
        "fontsize": 58,
        "primary_color": "&H00FFFFFF",
        "highlight_color": "&H0070B0FF",
        "outline_color": "&H00101010",
        "back_color": "&HB0000000",
        "bold": 0,
        "outline": 2.5,
        "shadow": 1.0,
        "alignment": 2,
        "margin_v": 420,
        "uppercase": False
    }
}

def format_ass_timestamp(seconds: float) -> str:
    seconds = max(0.0, seconds)
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int(round((seconds - int(seconds)) * 100))
    if centis >= 100:
        centis = 99
    return f"{hrs:d}:{mins:02d}:{secs:02d}.{centis:02d}"

def group_words_into_phrases(words: List[Dict[str, Any]], max_words_per_line: int = 4, max_pause: float = 0.5) -> List[List[Dict[str, Any]]]:
    if not words:
        return []
    
    phrases: List[List[Dict[str, Any]]] = []
    current_phrase: List[Dict[str, Any]] = []

    for i, word in enumerate(words):
        if not current_phrase:
            current_phrase.append(word)
            continue

        prev_word = current_phrase[-1]
        pause = word["start"] - prev_word["end"]

        if len(current_phrase) >= max_words_per_line or pause > max_pause:
            phrases.append(current_phrase)
            current_phrase = [word]
        else:
            current_phrase.append(word)

    if current_phrase:
        phrases.append(current_phrase)

    return phrases

def generate_karaoke_ass(
    words: List[Dict[str, Any]],
    output_path: Path,
    hook_text: Optional[str] = None,
    style_name: str = "hormozi",
    clip_offset: float = 0.0
) -> Path:
    style = STYLE_PRESETS.get(style_name, STYLE_PRESETS["hormozi"])
    output_path.parent.mkdir(parents=True, exist_ok=True)

    header = f"""[Script Info]
Title: AutoClipper Viral Short Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{style['fontname']},{style['fontsize']},{style['primary_color']},{style['highlight_color']},{style['outline_color']},{style['back_color']},{style['bold']},0,0,0,100,100,0,0,1,{style['outline']},{style['shadow']},{style['alignment']},80,80,{style['margin_v']},1
Style: HookPill,Arial Black,54,&H00FFFFFF,&H00000000,&H000000FF,&H80000000,1,0,0,0,100,100,1,0,1,5.0,2.0,8,80,80,290,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogues: List[str] = []

    if hook_text and hook_text.strip():
        clean_hook = hook_text.upper().replace("\n", " ").strip()
        hook_start = format_ass_timestamp(0.0)
        max_dur = (words[-1]["end"] - clip_offset) if (words and len(words) > 0 and "end" in words[-1]) else 3.2
        hook_end = format_ass_timestamp(min(3.2, max(0.5, max_dur)))
        pill_text = f"{{\\an8\\bord5\\shad2\\c&H00FFFFFF&\\3c&H001818EA&}} 🔥 {clean_hook} 🔥"
        dialogues.append(f"Dialogue: 1,{hook_start},{hook_end},HookPill,,0,0,0,,{pill_text}")

    phrases = group_words_into_phrases(words)

    for phrase in phrases:
        phrase_start = phrase[0]["start"] - clip_offset
        phrase_end = phrase[-1]["end"] - clip_offset

        if phrase_end <= 0.0:
            continue
        phrase_start = max(0.0, phrase_start)

        for active_idx, active_word in enumerate(phrase):
            w_start = active_word["start"] - clip_offset
            w_end = active_word["end"] - clip_offset
            
            if w_end <= 0:
                continue
            w_start = max(0.0, w_start)
            if w_end <= w_start:
                w_end = w_start + 0.15

            start_ts = format_ass_timestamp(w_start)
            end_ts = format_ass_timestamp(w_end)

            line_parts = []
            for j, w in enumerate(phrase):
                display_word = w["word"].upper() if style.get("uppercase") else w["word"]
                display_word = display_word.replace("{", "").replace("}", "")

                if j == active_idx:
                    line_parts.append(f"{{\\c{style['highlight_color']}\\fscx110\\fscy110}}{display_word}{{\\r}}")
                else:
                    line_parts.append(f"{{\\c{style['primary_color']}}}{display_word}{{\\r}}")

            full_line_text = " ".join(line_parts)
            dialogues.append(f"Dialogue: 0,{start_ts},{end_ts},Default,,0,0,0,,{full_line_text}")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(header)
        for d in dialogues:
            f.write(d + "\n")

    return output_path

