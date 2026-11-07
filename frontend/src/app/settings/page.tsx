"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Key, Cpu, Mic, Film, CheckCircle2, Sliders, Sparkles, HardDrive } from "lucide-react";
import SubtitleStylePicker from "@/components/SubtitleStylePicker";

interface SettingsState {
  gemini_api_key: string;
  pexels_api_key: string;
  whisper_model: string;
  subtitle_style: string;
  hardware_mode: string;
  max_clips: number;
  min_duration: number;
  max_duration: number;
}

interface HardwareState {
  cuda_available: boolean;
  device_name: string;
  total_vram_gb: number;
  nvenc_available: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    gemini_api_key: "",
    pexels_api_key: "",
    whisper_model: "base",
    subtitle_style: "hormozi",
    hardware_mode: "auto",
    max_clips: 4,
    min_duration: 20,
    max_duration: 60,
  });

  const [hardware, setHardware] = useState<HardwareState | null>(null);
  const [ffmpegPath, setFfmpegPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch(() => {});

    fetch("http://127.0.0.1:8000/api/health")
      .then((res) => res.json())
      .then((data) => {
        setHardware(data.hardware);
        setFfmpegPath(data.ffmpeg_path || "Default PATH");
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (e) {
      // save error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">System & AI Settings</h1>
            <p className="text-xs text-gray-400">Configure LLM keys, Whisper model, and local GPU acceleration</p>
          </div>
        </div>

        {savedSuccess && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Hardware Status Card */}
        <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Local Hardware & Execution Environment
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">Device</span>
              <p className="text-sm font-semibold text-white truncate">
                {hardware?.device_name || "Detecting..."}
              </p>
            </div>

            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">VRAM Budget</span>
              <p className="text-sm font-semibold text-white">
                {hardware?.total_vram_gb ? `${hardware.total_vram_gb} GB VRAM` : "Dynamic RAM"}
              </p>
            </div>

            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">NVENC Acceleration</span>
              <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    hardware?.nvenc_available ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />
                {hardware?.nvenc_available ? "Enabled (h264_nvenc)" : "CPU (libx264)"}
              </p>
            </div>
          </div>

          <div className="p-3 bg-black/20 rounded-xl border border-white/5 text-[11px] font-mono text-gray-400 truncate">
            <span className="text-gray-500">FFmpeg Path: </span>
            {ffmpegPath}
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-yellow-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              AI & Media API Keys
            </h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>Google Gemini API Key</span>
                <span className="text-[10px] text-indigo-400 font-mono">gemini-2.5-flash</span>
              </label>
              <input
                type="password"
                value={settings.gemini_api_key}
                onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-gray-500">
                Powers the AI Director viral curation and 3-second hook evaluation. Falls back to algorithmic scoring if empty.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>Pexels API Key (Optional B-Roll)</span>
                <span className="text-[10px] text-gray-500">Auto Stock Video</span>
              </label>
              <input
                type="password"
                value={settings.pexels_api_key}
                onChange={(e) => setSettings({ ...settings, pexels_api_key: e.target.value })}
                placeholder="Enter Pexels API key..."
                className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Model & Generation Parameters */}
        <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Transcription & Video Constraints
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Whisper Model Size</label>
              <select
                value={settings.whisper_model}
                onChange={(e) => setSettings({ ...settings, whisper_model: e.target.value })}
                className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="tiny">tiny (Fastest, ~1GB VRAM)</option>
                <option value="base">base (Recommended, ~1.5GB VRAM)</option>
                <option value="small">small (Balanced, ~2.5GB VRAM)</option>
                <option value="medium">medium (High Accuracy, ~5GB VRAM)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Hardware Render Acceleration</label>
              <select
                value={settings.hardware_mode}
                onChange={(e) => setSettings({ ...settings, hardware_mode: e.target.value })}
                className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="auto">auto (Detects NVENC, fallback to CPU)</option>
                <option value="nvenc">nvenc (Force NVIDIA NVENC)</option>
                <option value="cpu">cpu (Force CPU libx264)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Max Clips Generated</label>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.max_clips}
                onChange={(e) => setSettings({ ...settings, max_clips: parseInt(e.target.value) || 4 })}
                className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Target Duration (Min / Max Secs)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={60}
                  value={settings.min_duration}
                  onChange={(e) => setSettings({ ...settings, min_duration: parseInt(e.target.value) || 20 })}
                  className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 text-center"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  min={20}
                  max={120}
                  value={settings.max_duration}
                  onChange={(e) => setSettings({ ...settings, max_duration: parseInt(e.target.value) || 60 })}
                  className="w-full bg-[#0a0b10] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 text-center"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Default Subtitle Preset */}
        <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6">
          <SubtitleStylePicker
            selectedStyle={settings.subtitle_style}
            onSelect={(st) => setSettings({ ...settings, subtitle_style: st })}
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Changes..." : "Save Configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}

