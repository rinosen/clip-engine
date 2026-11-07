"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

interface WordItem {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

interface VideoPlayer9x16Props {
  src: string;
  poster?: string;
  words?: WordItem[];
  hookText?: string;
  subtitleStyle?: string;
  clipStartTime?: number;
  onTimeUpdate?: (currentTime: number) => void;
  seekTime?: number | null;
}

export default function VideoPlayer9x16({
  src,
  poster,
  words = [],
  hookText,
  subtitleStyle = "hormozi",
  clipStartTime = 0,
  onTimeUpdate,
  seekTime,
}: VideoPlayer9x16Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Force video reload when src changes (handles cache-busting v=timestamp after re-render)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [src]);

  // Handle seeking from outside (e.g. clicking a word pill)
  useEffect(() => {
    if (seekTime !== null && seekTime !== undefined && videoRef.current) {
      const targetTime = Math.max(0, seekTime);
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  }, [seekTime]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    onTimeUpdate?.(t);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Convert current relative video time to absolute timestamp in original source video
  const absTime = currentTime + (clipStartTime || 0);

  // Group active phrase and highlight active word in real time
  const activeData = useMemo(() => {
    if (!words || words.length === 0) return null;

    // Find the word matching absTime
    let targetIdx = words.findIndex((w) => absTime >= w.start && absTime <= w.end);

    // If between words or paused at start, find the nearest word
    if (targetIdx === -1) {
      if (currentTime <= 0.2) {
        targetIdx = 0;
      } else {
        const nextIdx = words.findIndex((w) => w.start >= absTime);
        if (nextIdx !== -1 && words[nextIdx].start - absTime <= 0.6) {
          targetIdx = nextIdx;
        } else if (nextIdx > 0 && absTime - words[nextIdx - 1].end <= 0.6) {
          targetIdx = nextIdx - 1;
        } else if (nextIdx !== -1) {
          targetIdx = nextIdx;
        } else {
          targetIdx = words.length - 1;
        }
      }
    }

    if (targetIdx === -1 || !words[targetIdx]) return null;

    // Expand to phrase (up to 4 words max with tight pause threshold)
    let startIdx = targetIdx;
    while (
      startIdx > 0 &&
      targetIdx - startIdx < 2 &&
      words[startIdx].start - words[startIdx - 1].end <= 0.6
    ) {
      startIdx--;
    }
    let endIdx = targetIdx;
    while (
      endIdx < words.length - 1 &&
      endIdx - startIdx < 3 &&
      words[endIdx + 1].start - words[endIdx].end <= 0.6
    ) {
      endIdx++;
    }

    return {
      phrase: words.slice(startIdx, endIdx + 1),
      activeWord: words[targetIdx].word,
      activeIndexInPhrase: targetIdx - startIdx,
    };
  }, [words, absTime, currentTime]);

  // Render individual word in accordance with selected subtitle preset style
  const renderStyledWord = (wordText: string, isCurrent: boolean) => {
    const style = subtitleStyle || "hormozi";
    switch (style) {
      case "mrbeast":
        return (
          <span
            className={`font-black uppercase tracking-wide transition-all ${
              isCurrent
                ? "text-[#24E01B] scale-110 inline-block drop-shadow-[0_4px_6px_rgba(0,0,0,1)] [text-shadow:_0_0_8px_rgba(36,224,27,0.7)]"
                : "text-white drop-shadow-[0_3px_4px_rgba(0,0,0,0.9)]"
            }`}
            style={{
              WebkitTextStroke: isCurrent ? "1.5px black" : "1px black",
            }}
          >
            {wordText}
          </span>
        );
      case "neon":
        return (
          <span
            className={`font-bold tracking-normal transition-all ${
              isCurrent
                ? "text-[#00FFFF] scale-110 inline-block drop-shadow-[0_0_12px_rgba(0,255,255,0.9)] [text-shadow:_0_0_10px_#a855f7]"
                : "text-[#E0E0E0] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            }`}
          >
            {wordText}
          </span>
        );
      case "minimal":
        return (
          <span
            className={`font-medium transition-all ${
              isCurrent
                ? "text-[#70B0FF] font-bold scale-105 inline-block"
                : "text-white"
            }`}
          >
            {wordText}
          </span>
        );
      case "hormozi":
      default:
        return (
          <span
            className={`font-black uppercase tracking-wide transition-all ${
              isCurrent
                ? "text-[#FFFF00] scale-110 inline-block drop-shadow-[0_4px_6px_rgba(0,0,0,1)]"
                : "text-white drop-shadow-[0_3px_4px_rgba(0,0,0,0.9)]"
            }`}
            style={{
              WebkitTextStroke: isCurrent ? "1.5px black" : "1px black",
            }}
          >
            {wordText}
          </span>
        );
    }
  };

  const isHookActive =
    Boolean(hookText && hookText.trim()) &&
    (currentTime <= 3.2 || (!isPlaying && currentTime <= 0.4));

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl group w-full max-w-[360px] mx-auto select-none"
    >
      {/* 9:16 Aspect Video Container */}
      <div className="relative w-full aspect-[9/16] bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-cover cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          playsInline
          loop
        />

        {/* Big Center Play/Pause Overlay Button */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute z-30 w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform"
          >
            <Play className="w-8 h-8 ml-1 fill-white" />
          </button>
        )}

        {/* 3-Second Opening Hook Banner Live Preview */}
        {showLivePreview && isHookActive && hookText && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-[320px] pointer-events-none animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 border-2 border-white/90 shadow-[0_8px_25px_rgba(225,29,72,0.6)] backdrop-blur-md text-center">
              <span className="text-sm">🔥</span>
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {hookText.toUpperCase()}
              </span>
              <span className="text-sm">🔥</span>
            </div>
            <div className="text-center mt-1">
              <span className="text-[9px] font-mono font-bold tracking-widest text-red-200 bg-black/80 px-2.5 py-0.5 rounded-full border border-red-500/40">
                HOOK BANNER • {currentTime.toFixed(1)}s / 3.2s
              </span>
            </div>
          </div>
        )}

        {/* Subtitle Style & Word Live Preview Overlay */}
        {showLivePreview && activeData && activeData.phrase.length > 0 && (
          <div className="absolute bottom-[23%] left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
            {subtitleStyle === "minimal" ? (
              <div className="bg-black/75 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-sm shadow-xl flex items-center justify-center gap-2 flex-wrap text-center max-w-[90%]">
                {activeData.phrase.map((w, idx) => (
                  <span key={idx}>
                    {renderStyledWord(w.word, idx === activeData.activeIndexInPhrase)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="px-3 py-1.5 flex items-center justify-center gap-2 flex-wrap text-center max-w-[92%]">
                {activeData.phrase.map((w, idx) => (
                  <span key={idx}>
                    {renderStyledWord(w.word, idx === activeData.activeIndexInPhrase)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Safe Zones Overlay (TikTok / IG Reels Guides) */}
        {showSafeZones && (
          <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between border-2 border-red-500/40">
            {/* Top Bar Safe Zone */}
            <div className="h-[15%] w-full bg-red-500/10 border-b border-red-500/30 flex items-center justify-center">
              <span className="text-[10px] font-mono text-red-300 bg-red-950/80 px-2 py-0.5 rounded">
                TOP DANGER ZONE (Header & Tabs)
              </span>
            </div>

            {/* Right Buttons Safe Zone */}
            <div className="absolute right-0 top-[35%] bottom-[25%] w-16 bg-red-500/10 border-l border-red-500/30 flex items-center justify-center">
              <span className="text-[9px] font-mono text-red-300 -rotate-90">
                RIGHT ICONS
              </span>
            </div>

            {/* Bottom Bar Safe Zone */}
            <div className="h-[22%] w-full bg-red-500/10 border-t border-red-500/30 flex items-center justify-center">
              <span className="text-[10px] font-mono text-red-300 bg-red-950/80 px-2 py-0.5 rounded">
                BOTTOM DANGER ZONE (Captions & Music)
              </span>
            </div>
          </div>
        )}

        {/* Top Floating Control Badges */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-auto">
          {/* Live Preview Toggle */}
          <button
            onClick={() => setShowLivePreview(!showLivePreview)}
            className={`px-2 py-1 rounded-lg border backdrop-blur-md transition-colors text-[10px] font-semibold flex items-center gap-1.5 ${
              showLivePreview
                ? "bg-indigo-600/80 border-indigo-400 text-white shadow-sm"
                : "bg-black/60 border-white/10 text-gray-400 hover:text-white"
            }`}
            title="Toggle Live Subtitle & Hook Preview Overlay"
          >
            <Sparkles className="w-3 h-3 text-yellow-300" />
            <span>{showLivePreview ? "Live Preview ON" : "Live Preview OFF"}</span>
          </button>

          {/* Safe Zone Toggle */}
          <button
            onClick={() => setShowSafeZones(!showSafeZones)}
            className={`p-1.5 rounded-lg border backdrop-blur-md transition-colors text-xs flex items-center gap-1 ${
              showSafeZones
                ? "bg-red-500/20 border-red-500 text-red-300"
                : "bg-black/50 border-white/10 text-gray-400 hover:text-white"
            }`}
            title="Toggle 9:16 Social Safe Zones"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium hidden sm:inline">SafeZone</span>
          </button>
        </div>
      </div>

      {/* Modern Control Bar */}
      <div className="w-full bg-[#10121a]/95 border-t border-white/5 p-3 space-y-2">
        {/* Scrubber */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-gray-400 min-w-[32px]">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-[11px] font-mono text-gray-400 min-w-[32px]">
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400 hidden group-hover/vol:inline-block"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleSpeed}
              className="px-2 py-1 rounded text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-gray-300"
            >
              {playbackSpeed}x
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
