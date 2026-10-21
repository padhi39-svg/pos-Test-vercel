"use client";

import { useState, useEffect } from "react";
import { ArrowsPointingOutIcon, ArrowsPointingInIcon } from "@heroicons/react/24/outline";

export default function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  return (
    <button
      onClick={toggle}
      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      className="fixed bottom-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-white border border-slate-300 shadow-md text-slate-600 hover:text-slate-900 transition-all"
    >
      {isFullscreen ? (
        <ArrowsPointingInIcon className="w-5 h-5" />
      ) : (
        <ArrowsPointingOutIcon className="w-5 h-5" />
      )}
    </button>
  );
}
