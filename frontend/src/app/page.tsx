"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Link2, UploadCloud, Sparkles, Film, ArrowRight, Play, Clock, CheckCircle2, AlertCircle, RefreshCw, Trash2, X, RotateCcw } from "lucide-react";
import ProgressStepper from "@/components/ProgressStepper";

interface ProjectItem {
  id: string;
  title: string;
  source_type: string;
  source_url?: string;
  duration: number;
  status: string;
  progress: number;
  current_stage: string;
  created_at: string;
  clips_count: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"url" | "upload">("url");
  const [urlInput, setUrlInput] = useState("");
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProgress, setActiveProgress] = useState<{
    stage: string;
    progress: number;
    message: string;
    error?: string;
    isCompleted?: boolean;
  }>({
    stage: "queued",
    progress: 0,
    message: "Waiting in queue...",
  });

  const wsRef = useRef<WebSocket | null>(null);

  const fetchProjects = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);

        const inProgress = data.find((p: ProjectItem) => p.status === "processing" || p.status === "queued");
        if (inProgress && !activeProjectId) {
          setActiveProjectId(inProgress.id);
          connectWs(inProgress.id);
        }
      }
    } catch (err) {
      // offline or loading
    }
  };

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 10000);
    return () => clearInterval(interval);
  }, []);

  const connectWs = (projectId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/progress/${projectId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setActiveProgress({
          stage: data.stage || "processing",
          progress: data.progress || 0,
          message: data.message || "",
          error: data.error,
          isCompleted: data.completed,
        });

        if (data.completed || data.error) {
          fetchProjects();
        }
      } catch (e) {
        // parsing error
      }
    };
  };

  const handleDismissActive = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setActiveProjectId(null);
  };

  const handleDeleteProject = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (activeProjectId === id) {
          handleDismissActive();
        }
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const handleRetryProject = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${id}/retry`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setActiveProjectId(data.id);
        setActiveProgress({ stage: "queued", progress: 0, message: "Restarting pipeline..." });
        connectWs(data.id);
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to retry project:", err);
    }
  };

  const handleSubmitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/projects/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to submit URL");
      }
      const data = await res.json();
      setActiveProjectId(data.id);
      setActiveProgress({ stage: "ingesting", progress: 5, message: "Ingesting video..." });
      connectWs(data.id);
      setUrlInput("");
      fetchProjects();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process URL");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileInput) return;
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", fileInput);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/projects/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to upload file");
      }
      const data = await res.json();
      setActiveProjectId(data.id);
      setActiveProgress({ stage: "ingesting", progress: 5, message: "Uploaded, starting pipeline..." });
      connectWs(data.id);
      setFileInput(null);
      fetchProjects();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Local-First AI Video Clipper • 6GB VRAM & NVENC</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Turn 16:9 Long Videos into <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Viral 9:16 Shorts</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base">
          OpusClip alternative running 100% locally. Automatic active speaker detection, word-level karaoke subtitles, dynamic punch-in zoom, and CapCut draft export.
        </p>
      </div>

      {/* Input Card */}
      <div className="max-w-2xl mx-auto bg-[#12141c] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Tabs */}
        <div className="flex rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === "url"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Link2 className="w-4 h-4" />
            YouTube / Video URL
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === "upload"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Local Video Upload
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: URL Form */}
        {activeTab === "url" && (
          <form onSubmit={handleSubmitUrl} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Video Link</label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  required
                  className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors pl-10"
                />
                <Link2 className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              </div>
              <p className="text-[11px] text-gray-500">
                Supports YouTube, podcasts, and video links. Automatically extracts audience heatmaps.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !urlInput.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Starting AI Pipeline...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Viral Shorts
                </>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: Upload Form */}
        {activeTab === "upload" && (
          <form onSubmit={handleSubmitUpload} className="space-y-4">
            <div className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer transition-colors relative bg-black/20">
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                onChange={(e) => setFileInput(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-medium text-white">
                  {fileInput ? fileInput.name : "Choose a 16:9 video file or drag & drop"}
                </div>
                <p className="text-xs text-gray-500">MP4, MOV, MKV up to 1080p</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !fileInput}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Uploading & Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Upload & Clip Video
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Live Pipeline Stepper if active */}
      {activeProjectId && (
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Active Job Progress
            </h3>
            <div className="flex items-center gap-3">
              <Link
                href={`/project/${activeProjectId}`}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                Open Studio <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={handleDismissActive}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                title="Dismiss active progress view"
              >
                <X className="w-3.5 h-3.5" /> Dismiss
              </button>
            </div>
          </div>
          <ProgressStepper
            stage={activeProgress.stage}
            progress={activeProgress.progress}
            message={activeProgress.message}
            error={activeProgress.error}
            isCompleted={activeProgress.isCompleted}
          />
        </div>
      )}

      {/* Projects Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Processed Projects</h2>
            <p className="text-xs text-gray-400">Your AI-curated vertical short libraries</p>
          </div>
          <button
            onClick={fetchProjects}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="p-12 text-center border border-white/5 rounded-2xl bg-[#12141c]/50 space-y-3">
            <Film className="w-8 h-8 text-gray-600 mx-auto" />
            <p className="text-sm font-medium text-gray-400">No projects yet</p>
            <p className="text-xs text-gray-600">
              Paste a YouTube URL above or upload a video to generate your first shorts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {projects.map((p) => {
              const isDone = p.status === "completed";
              return (
                <div
                  key={p.id}
                  className="bg-[#12141c] border border-white/5 rounded-2xl p-5 hover:border-indigo-500/30 transition-all space-y-4 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-gray-500 uppercase tracking-wider text-[10px]">
                        {p.source_type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isDone
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : p.status === "failed"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <h3 className="font-semibold text-white text-base line-clamp-2 group-hover:text-indigo-300 transition-colors">
                      {p.title}
                    </h3>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        {Math.round(p.duration)}s
                      </span>
                      <span className="text-indigo-400 font-semibold">
                        {p.clips_count} {p.clips_count === 1 ? "clip" : "clips"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {p.status === "failed" && (
                        <button
                          type="button"
                          onClick={(e) => handleRetryProject(p.id, e)}
                          className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                          title="Retry pipeline"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(p.id, e)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        href={`/project/${p.id}`}
                        className="py-1.5 px-3 rounded-lg bg-white/5 hover:bg-indigo-600 hover:text-white transition-all text-xs font-semibold flex items-center gap-1"
                      >
                        Studio <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

