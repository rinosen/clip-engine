"use client";

import { CheckCircle2, CircleDashed, AlertCircle, Sparkles, Video, Mic, Brain, Camera, Film } from "lucide-react";

interface ProgressStepperProps {
  stage: string;
  progress: number;
  message: string;
  error?: string;
  isCompleted?: boolean;
}

const STAGES = [
  { key: "ingesting", label: "Ingest", icon: Video, desc: "Probe & Audio Split" },
  { key: "transcribing", label: "Transcribe", icon: Mic, desc: "Whisper & RMS Energy" },
  { key: "curating", label: "AI Director", icon: Brain, desc: "Viral Hook Selection" },
  { key: "tracking", label: "Auto-Framing", icon: Camera, desc: "YuNet Face ASD" },
  { key: "rendering", label: "Render", icon: Film, desc: "NVENC + Karaoke ASS" },
];

export default function ProgressStepper({ stage, progress, message, error, isCompleted }: ProgressStepperProps) {
  const getStageIndex = (s: string) => {
    if (s === "audio_extract") return 0;
    if (s === "ingesting" || s === "queued") return 0;
    if (s === "transcribing") return 1;
    if (s === "curating") return 2;
    if (s === "tracking") return 3;
    if (s === "rendering") return 4;
    if (s === "completed") return 5;
    return 0;
  };

  const currentIndex = isCompleted ? 5 : getStageIndex(stage);

  return (
    <div className="w-full bg-[#12141c] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Pipeline Execution</h3>
            <p className="text-xs text-gray-400">Sequential GPU Lock (Strict 6GB VRAM Management)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {error ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Pipeline Failed
            </span>
          ) : isCompleted ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5 animate-pulse">
              <CircleDashed className="w-3.5 h-3.5 animate-spin" /> Processing
            </span>
          )}
          <span className="text-sm font-bold text-gray-200 tabular-nums">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${error
            ? "bg-red-500"
            : isCompleted
              ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
              : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
            }`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      {/* Stepper Dots */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
        {STAGES.map((s, idx) => {
          const isDone = isCompleted || currentIndex > idx;
          const isCurrent = !isCompleted && currentIndex === idx;
          const Icon = s.icon;

          return (
            <div
              key={s.key}
              className={`p-3 rounded-xl border transition-all ${isDone
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                : isCurrent
                  ? "bg-indigo-950/30 border-indigo-500/40 text-indigo-300 shadow-lg shadow-indigo-500/10"
                  : "bg-white/[0.02] border-white/5 text-gray-500"
                }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${isDone ? "text-emerald-400" : isCurrent ? "text-indigo-400" : "text-gray-600"}`} />
                <span className="text-xs font-semibold">{s.label}</span>
              </div>
              <p className="text-[11px] leading-tight text-gray-400">{s.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Current Log / Message */}
      <div className="px-4 py-3 rounded-xl bg-black/40 border border-white/5 font-mono text-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-gray-300 truncate">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping shrink-0" />
          <span className="text-gray-400">Status:</span>
          <span className="text-white font-sans truncate">{message || "Working on clip pipeline..."}</span>
        </div>
      </div>
    </div>
  );
}

