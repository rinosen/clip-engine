"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scissors, Settings, LayoutGrid, Cpu } from "lucide-react";
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [hwStatus, setHwStatus] = useState<{ nvenc: boolean; device: string } | null>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/health")
      .then((res) => res.json())
      .then((data) => {
        setHwStatus({
          nvenc: data.hardware?.nvenc_available || false,
          device: data.hardware?.device_name || "CPU Mode",
        });
      })
      .catch(() => {
        setHwStatus({ nvenc: false, device: "Offline / Standby" });
      });
  }, []);

  return (
    <header className="border-b border-white/5 bg-[#0d0f18]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Scissors className="w-5 h-5 text-white transform -rotate-45" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                AutoClipper<span className="text-indigo-400">.ai</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20">
                Local VRAM
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pathname === "/"
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              href="/settings"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pathname === "/settings"
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-xs text-gray-300">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline font-medium">Hardware:</span>
            <span className="text-gray-400 truncate max-w-[140px]">
              {hwStatus?.device || "Detecting..."}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                hwStatus?.nvenc ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-amber-400"
              }`}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

