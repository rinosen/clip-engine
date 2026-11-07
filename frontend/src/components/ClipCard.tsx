"use client";

import Link from "next/link";
import { Play, Download, Sparkles, Layers, Scissors } from "lucide-react";

interface ClipCardProps {
  clip: {
    id: string;
    project_id: string;
    title: string;
    hook: string;
    virality_score: number;
    virality_explanation: string;
    duration: number;
    layout_type: string;
    rendered_video_path?: string;
    status: string;
  };
}

export default function ClipCard({ clip }: ClipCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 70) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-rose-400 bg-rose-500/10 border-rose-500/30";
  };

  const videoUrl = `http://127.0.0.1:8000/media/outputs/${clip.project_id}/${clip.id}/short.mp4`;
  const thumbUrl = `http://127.0.0.1:8000/media/outputs/${clip.project_id}/${clip.id}/short.jpg`;

  return (
    <div className="bg-[#12141c] border border-white/5 rounded-2xl overflow-hidden hover:border-indigo-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between group">
      {/* Top Banner / Hook */}
      <div className="p-4 border-b border-white/5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${getScoreColor(
                clip.virality_score
              )}`}
            >
              <Sparkles className="w-3 h-3" />
              {clip.virality_score}/100
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">
              {Math.round(clip.duration)}s
            </span>
          </div>

          <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            {clip.layout_type.replace("_", " ")}
          </span>
        </div>

        <h4 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-indigo-300 transition-colors">
          {clip.title}
        </h4>
        <p className="text-xs text-amber-300/90 italic line-clamp-2 bg-black/30 p-2 rounded-lg border border-white/5">
          &ldquo;{clip.hook}&rdquo;
        </p>
      </div>

      {/* Middle: Vertical Video Thumbnail with hover play preview */}
      <div className="relative aspect-[9/14] bg-black/60 overflow-hidden flex items-center justify-center">
        <img
          src={thumbUrl}
          alt={clip.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />

        <Link
          href={`/project/${clip.project_id}?clipId=${clip.id}`}
          className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center"
        >
          <div className="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 ml-0.5 fill-white" />
          </div>
        </Link>
      </div>

      {/* Bottom Footer Actions */}
      <div className="p-3 bg-[#0d0f17] border-t border-white/5 flex items-center justify-between gap-2">
        <Link
          href={`/project/${clip.project_id}?clipId=${clip.id}`}
          className="flex-1 py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-indigo-500/30 hover:border-transparent"
        >
          <Scissors className="w-3.5 h-3.5" />
          Clip Studio
        </Link>

        <a
          href={videoUrl}
          download={`${clip.title.replace(/\s+/g, "_")}.mp4`}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 transition-colors"
          title="Download 9:16 Video"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

