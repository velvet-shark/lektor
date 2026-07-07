"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The A-B magic: both versions are mounted and kept in sync; switching only
 * flips muted/opacity — no loading, no seek in the common case (<100ms).
 * The lagging element is nudged to the leader's currentTime on every toggle
 * and re-synced when drift exceeds 60ms.
 */
export default function ABPlayer({
  originalUrl,
  lektorUrl,
  poster,
  labels,
  autoLektor = true,
  className = "",
}: {
  originalUrl: string;
  lektorUrl: string;
  poster?: string;
  labels: { original: string; lektor: string };
  autoLektor?: boolean;
  className?: string;
}) {
  const origRef = useRef<HTMLVideoElement>(null);
  const lekRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"original" | "lektor">(
    autoLektor ? "lektor" : "original"
  );
  const [playing, setPlaying] = useState(false);

  const leader = () => (mode === "lektor" ? lekRef.current : origRef.current);
  const follower = () => (mode === "lektor" ? origRef.current : lekRef.current);

  // keep the muted follower from drifting
  useEffect(() => {
    const id = setInterval(() => {
      const l = leader();
      const f = follower();
      if (!l || !f || l.paused) return;
      if (Math.abs(l.currentTime - f.currentTime) > 0.06) {
        f.currentTime = l.currentTime;
      }
    }, 500);
    return () => clearInterval(id);
  });

  const toggle = (next: "original" | "lektor") => {
    if (next === mode) return;
    const from = leader();
    const to = next === "lektor" ? lekRef.current : origRef.current;
    if (from && to) {
      to.currentTime = from.currentTime; // same timeline position — the point
      to.muted = false;
      from.muted = true;
      if (!from.paused) void to.play();
    }
    setMode(next);
  };

  const playPause = () => {
    const l = leader();
    const f = follower();
    if (!l) return;
    if (l.paused) {
      if (f) f.currentTime = l.currentTime;
      void l.play();
      void f?.play();
      setPlaying(true);
    } else {
      l.pause();
      f?.pause();
      setPlaying(false);
    }
  };

  const vid = (which: "original" | "lektor") => ({
    className:
      "absolute inset-0 h-full w-full object-contain transition-opacity duration-100 " +
      (mode === which ? "opacity-100" : "opacity-0"),
    playsInline: true,
    preload: "auto" as const,
    poster,
    muted: mode !== which,
    onClick: playPause,
    onEnded: () => setPlaying(false),
  });

  return (
    <div className={`group relative ${className}`}>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <video ref={origRef} src={originalUrl} {...vid("original")} />
        <video ref={lekRef} src={lektorUrl} {...vid("lektor")} />
        {!playing && (
          <button
            onClick={playPause}
            aria-label="play"
            className="absolute inset-0 z-10 grid place-items-center"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-pl-red/90 pl-1 text-2xl text-white shadow-lg transition-transform group-hover:scale-105">
              ▶
            </span>
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center">
        <div className="ab-switch bg-crt-2">
          <span
            className="thumb"
            style={{
              transform: mode === "original" ? "translateX(0)" : "translateX(100%)",
              zIndex: 0,
            }}
          />
          <button
            onClick={() => toggle("original")}
            className={`relative z-10 ${mode === "original" ? "text-white" : "text-paper-dim"}`}
          >
            {labels.original}
          </button>
          <button
            onClick={() => toggle("lektor")}
            className={`relative z-10 ${mode === "lektor" ? "text-white" : "text-paper-dim"}`}
          >
            {labels.lektor}
          </button>
        </div>
      </div>
    </div>
  );
}
