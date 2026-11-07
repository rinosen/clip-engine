"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Download,
  RefreshCw,
  Scissors,
  ExternalLink,
  FileText,
  CheckCircle2,
  Sliders,
  Layers,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import VideoPlayer9x16 from "@/components/VideoPlayer9x16";
import SubtitleStylePicker from "@/components/SubtitleStylePicker";

interface WordItem {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

interface ClipData {
  id: string;
  project_id: string;
  title: string;
  hook: string;
  virality_score: number;
  virality_explanation: string;
  start_time: number;
  end_time: number;
  duration: number;
  transcript: WordItem[];
  layout_type: string;
  subtitle_style?: string;
  rendered_video_path?: string;
  status: string;
}

interface ProjectData {
  id: string;
  title: string;
  duration: number;
  status: string;
  source_type: string;
  clips: ClipData[];
}

export default function ClipStudio() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const projectId = params?.id as string;
  const initialClipId = searchParams.get("clipId");

  const [project, setProject] = useState<ProjectData | null>(null);
  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);
  const [hookText, setHookText] = useState("");
  const [subtitleStyle, setSubtitleStyle] = useState("hormozi");
  const [transcriptWords, setTranscriptWords] = useState<WordItem[]>([]);
  const [seekTime, setSeekTime] = useState<number | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [newWordText, setNewWordText] = useState("");
  const [renderVersion, setRenderVersion] = useState(Date.now());

  const [rerendering, setRerendering] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchProjectData = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/projects/${projectId}`);
      if (!res.ok) return;
      const data: ProjectData = await res.json();
      setProject(data);

      if (data.clips && data.clips.length > 0) {
        const found = initialClipId
          ? data.clips.find((c) => c.id === initialClipId) || data.clips[0]
          : data.clips[0];
        setSelectedClip(found);
        setHookText(found.hook || "");
        setSubtitleStyle(found.subtitle_style || "hormozi");
        setTranscriptWords(found.transcript || []);
      }
    } catch (err) {
      // loading
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const handleSelectClip = (c: ClipData) => {
    setSelectedClip(c);
    setHookText(c.hook || "");
    setSubtitleStyle(c.subtitle_style || "hormozi");
    setTranscriptWords(c.transcript || []);
    setEditingIndex(null);
    setEditingText("");
    setIsAddingWord(false);
    router.replace(`/project/${projectId}?clipId=${c.id}`);
  };

  const startEditing = (index: number, currentText: string) => {
    setEditingIndex(index);
    setEditingText(currentText);
  };

  const saveEdit = (index: number) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      handleDeleteWord(index);
    } else {
      const updated = [...transcriptWords];
      updated[index] = { ...updated[index], word: trimmed };
      setTranscriptWords(updated);
    }
    setEditingIndex(null);
    setEditingText("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingText("");
  };

  const handleDeleteWord = (index: number) => {
    const updated = transcriptWords.filter((_, i) => i !== index);
    setTranscriptWords(updated);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingText("");
    }
  };

  const handleAddWord = () => {
    if (!newWordText.trim() || !selectedClip) return;
    const lastWord = transcriptWords[transcriptWords.length - 1];
    const start = lastWord ? lastWord.end + 0.05 : selectedClip.start_time;
    const end = start + 0.4;
    setTranscriptWords([
      ...transcriptWords,
      { word: newWordText.trim(), start: Number(start.toFixed(2)), end: Number(end.toFixed(2)) },
    ]);
    setNewWordText("");
    setIsAddingWord(false);
  };

  const handleResetTranscript = () => {
    if (!selectedClip || !selectedClip.transcript) return;
    if (confirm("Kembalikan kata-kata ke hasil transkrip AI awal?")) {
      setTranscriptWords([...selectedClip.transcript]);
      setEditingIndex(null);
      setEditingText("");
    }
  };

  const handleRerender = async () => {
    if (!selectedClip) return;
    setRerendering(true);
    setSuccessToast(null);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/clips/${selectedClip.id}/rerender`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: hookText,
          subtitle_style: subtitleStyle,
          transcript: transcriptWords,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedClip(updated);
        setHookText(updated.hook || "");
        setSubtitleStyle(updated.subtitle_style || "hormozi");
        setTranscriptWords(updated.transcript || []);
        setRenderVersion(Date.now());
        setSuccessToast("Video berhasil di-render ulang dengan hook & subtitle baru!");
        fetchProjectData();
      }
    } catch (e) {
      // rerender error
    } finally {
      setRerendering(false);
    }
  };

  if (!project || !selectedClip) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
        <p className="text-gray-400 font-medium">Loading Clip Studio...</p>
      </div>
    );
  }

  const videoUrl = `http://127.0.0.1:8000/media/outputs/${projectId}/${selectedClip.id}/short.mp4?v=${renderVersion}`;
  const thumbUrl = `http://127.0.0.1:8000/media/outputs/${projectId}/${selectedClip.id}/short.jpg?v=${renderVersion}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white line-clamp-1">{project.title}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {project.status}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Total Duration: {Math.round(project.duration)}s • {project.clips.length} Curated Shorts
            </p>
          </div>
        </div>

        {/* Clip Switcher Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
          {project.clips.map((c, i) => {
            const isActive = selectedClip.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handleSelectClip(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${isActive
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                  : "bg-[#12141c] text-gray-400 border-white/5 hover:border-white/20 hover:text-white"
                  }`}
              >
                <span>Clip {i + 1}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] ${c.virality_score >= 85 ? "bg-emerald-500/30 text-emerald-200" : "bg-amber-500/30 text-amber-200"
                    }`}
                >
                  {c.virality_score}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {successToast && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {successToast}
          </span>
          <button onClick={() => setSuccessToast(null)} className="text-gray-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: 9:16 Video Preview Player */}
        <div className="lg:col-span-5 flex flex-col items-center space-y-4">
          <div className="w-full max-w-[360px]">
            <VideoPlayer9x16
              src={videoUrl}
              poster={thumbUrl}
              words={transcriptWords}
              hookText={hookText}
              subtitleStyle={subtitleStyle}
              clipStartTime={selectedClip.start_time}
              seekTime={seekTime}
            />
          </div>

          <div className="flex items-center gap-2 w-full max-w-[360px]">
            <a
              href={videoUrl}
              download={`${selectedClip.title.replace(/\s+/g, "_")}.mp4`}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download 9:16 Video
            </a>
          </div>
        </div>

        {/* Right Column: AI Director & Editorial Deck */}
        <div className="lg:col-span-7 space-y-6">
          {/* Virality Score Card */}
          <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Virality Prediction
                </span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                  Opus Engine
                </span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Score: {selectedClip.virality_score} / 100
              </span>
            </div>

            <h3 className="text-base font-bold text-white">{selectedClip.title}</h3>
            <p className="text-xs text-gray-400 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
              {selectedClip.virality_explanation ||
                "High initial curiosity gap. Speech energy peaks within the first 3 seconds, retaining retention past the platform drop-off threshold."}
            </p>
          </div>

          {/* Hook Editor */}
          <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block">
              3-Second Opening Hook Banner
            </label>
            <input
              type="text"
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              className="w-full bg-[#090a0f] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-yellow-300 font-bold focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g. 🔥 WAIT TILL YOU SEE THIS 🔥"
            />
            <p className="text-[11px] text-gray-500">
              Rendered as an animated top pill overlay during the first 3.2 seconds to maximize hook-through rate.
            </p>
          </div>

          {/* Subtitle Style Picker */}
          <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5">
            <SubtitleStylePicker
              selectedStyle={subtitleStyle}
              onSelect={(st) => setSubtitleStyle(st)}
            />
          </div>

          {/* Word-Level Karaoke Transcript Editor */}
          <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block">
                  Word Timestamps & Karaoke Alignment ({transcriptWords.length} kata)
                </label>
                <span className="text-[10px] text-gray-400">
                  Klik kata untuk dengar • Double-klik / icon <Pencil className="w-2.5 h-2.5 inline text-yellow-400" /> untuk ubah • Icon <Trash2 className="w-2.5 h-2.5 inline text-red-400" /> untuk hapus
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingWord(!isAddingWord)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Tambah Kata
                </button>
                <button
                  type="button"
                  onClick={handleResetTranscript}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-colors"
                  title="Kembalikan semua kata ke hasil transkrip AI awal"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
            </div>

            {/* Inline Add Word Form */}
            {isAddingWord && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ketik kata baru..."
                  value={newWordText}
                  onChange={(e) => setNewWordText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddWord();
                    if (e.key === "Escape") setIsAddingWord(false);
                  }}
                  autoFocus
                  className="flex-1 bg-black/60 border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  onClick={handleAddWord}
                  disabled={!newWordText.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingWord(false)}
                  className="px-2 py-1.5 text-gray-400 hover:text-white text-xs"
                >
                  Batal
                </button>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto p-3 bg-black/40 rounded-xl border border-white/5 flex flex-wrap gap-1.5">
              {transcriptWords.length === 0 ? (
                <div className="w-full text-center py-6 text-gray-500 text-xs">
                  Semua kata telah dihapus. Klik &quot;Reset&quot; untuk mengembalikan transkrip AI.
                </div>
              ) : (
                transcriptWords.map((item, idx) => {
                  const isEditing = editingIndex === idx;
                  const relTime = Math.max(0, Math.round(item.start - selectedClip.start_time));

                  if (isEditing) {
                    return (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-950/90 border-2 border-indigo-400 px-1.5 py-0.5 text-xs shadow-lg ring-2 ring-indigo-500/30"
                      >
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(idx);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          onBlur={() => saveEdit(idx)}
                          autoFocus
                          className="bg-black text-yellow-300 font-bold px-1.5 py-0.5 rounded outline-none w-24 text-xs border border-white/20"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveEdit(idx);
                          }}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                          title="Simpan (Enter)"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            cancelEdit();
                          }}
                          className="p-1 text-gray-400 hover:text-gray-200"
                          title="Batal (Esc)"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="group relative inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 hover:border-yellow-400/50 hover:bg-white/10 px-2 py-1 text-xs transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setSeekTime(item.start - selectedClip.start_time)}
                        onDoubleClick={() => startEditing(idx, item.word)}
                        className="text-gray-200 hover:text-yellow-400 font-medium transition-colors text-left"
                        title="Klik untuk dengar • Double-klik untuk ubah kata"
                      >
                        {item.word}
                      </button>

                      <span
                        onClick={() => setSeekTime(item.start - selectedClip.start_time)}
                        className="text-[9px] font-mono text-gray-500 hover:text-indigo-400 cursor-pointer"
                        title={`Timestamp: ${relTime}s`}
                      >
                        {relTime}s
                      </span>

                      {/* Action buttons (always visible with soft opacity, full on hover) */}
                      <div className="inline-flex items-center gap-0.5 ml-1 pl-1 border-l border-white/10 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEditing(idx, item.word)}
                          className="p-0.5 text-gray-400 hover:text-yellow-400 rounded transition-colors"
                          title="Ubah kata (atau double-klik kata)"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWord(idx)}
                          className="p-0.5 text-gray-400 hover:text-red-400 rounded transition-colors"
                          title="Hapus kata ini dari subtitle"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Re-render & NLE Export Suite */}
          <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                onClick={handleRerender}
                disabled={rerendering}
                className="py-3 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {rerendering ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    NVENC Re-Rendering Filtergraph...
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" />
                    Re-render with Edits
                  </>
                )}
              </button>

              {/* NLE Exporters */}
              <div className="flex items-center gap-2">
                <a
                  href={`http://127.0.0.1:8000/api/clips/${selectedClip.id}/export/capcut`}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors"
                  title="Export CapCut Draft Content (Direct Import)"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  CapCut Draft
                </a>

                <a
                  href={`http://127.0.0.1:8000/api/clips/${selectedClip.id}/export/remotion`}
                  target="_blank"
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors"
                  title="Export Remotion Composition Props JSON"
                >
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  Remotion JSON
                </a>

                <a
                  href={`http://127.0.0.1:8000/api/clips/${selectedClip.id}/export/fcpxml`}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors"
                  title="Export FCPXML for Premiere / Final Cut"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  FCPXML
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

