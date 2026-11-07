"use client";

import { Check } from "lucide-react";

interface SubtitleStylePickerProps {
  selectedStyle: string;
  onSelect: (style: string) => void;
}

const STYLES = [
  {
    id: "hormozi",
    name: "Hormozi Viral",
    desc: "Bold yellow word pop with heavy black outline",
    badgeBg: "bg-yellow-400 text-black",
    preview: (
      <div className="font-black text-center text-sm uppercase tracking-wide">
        <span className="text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">THIS IS </span>
        <span className="text-yellow-400 scale-110 inline-block drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">INSANE</span>
      </div>
    ),
  },
  {
    id: "mrbeast",
    name: "MrBeast Punch",
    desc: "Electric neon green highlight with high contrast shadow",
    badgeBg: "bg-emerald-400 text-black",
    preview: (
      <div className="font-extrabold text-center text-sm uppercase tracking-wide">
        <span className="text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">WATCH THIS </span>
        <span className="text-emerald-400 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">NOW</span>
      </div>
    ),
  },
  {
    id: "neon",
    name: "Cyber Neon",
    desc: "Cyan glow with vivid magenta stroke and rounded font",
    badgeBg: "bg-cyan-400 text-black",
    preview: (
      <div className="font-bold text-center text-sm tracking-wide">
        <span className="text-gray-200">The secret </span>
        <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">method</span>
      </div>
    ),
  },
  {
    id: "minimal",
    name: "Minimalist Pill",
    desc: "Clean white typography with subtle pill contrast",
    badgeBg: "bg-white text-black",
    preview: (
      <div className="font-medium text-center text-sm">
        <span className="bg-black/60 px-2 py-0.5 rounded text-white border border-white/10">
          Clean & Crisp Subtitles
        </span>
      </div>
    ),
  },
];

export default function SubtitleStylePicker({ selectedStyle, onSelect }: SubtitleStylePickerProps) {
  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
        Subtitle Preset Style
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STYLES.map((st) => {
          const isSelected = selectedStyle === st.id;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => onSelect(st.id)}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-28 ${
                isSelected
                  ? "bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/20"
                  : "bg-[#161926] border-white/5 hover:border-white/20 hover:bg-[#1c2030]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-white">{st.name}</span>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Style live visual representation */}
              <div className="py-2 flex items-center justify-center bg-black/40 rounded-lg border border-white/5 my-1">
                {st.preview}
              </div>

              <span className="text-[10px] text-gray-400 truncate">{st.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

