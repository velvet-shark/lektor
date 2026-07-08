"use client";

import { useEffect, useRef, useState } from "react";

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

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
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const leader = () => (mode === "lektor" ? lekRef.current : origRef.current);
  const follower = () => (mode === "lektor" ? origRef.current : lekRef.current);

  // keep the muted follower from drifting; track time for the progress bar
  useEffect(() => {
    const id = setInterval(() => {
      const l = leader();
      const f = follower();
      if (!l) return;
      setTime(l.currentTime);
      if (l.duration && isFinite(l.duration)) setDuration(l.duration);
      if (!f || l.paused) return;
      if (Math.abs(l.currentTime - f.currentTime) > 0.06) {
        f.currentTime = l.currentTime;
      }
    }, 250);
    return () => clearInterval(id);
  });

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const l = leader();
    const f = follower();
    if (!l || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * duration;
    l.currentTime = t;
    if (f) f.currentTime = t;
    setTime(t);
  };

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
        {/* duration badge before playback starts */}
        {!playing && time === 0 && (
          <span className="mono absolute bottom-2 right-2 z-10 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
            {fmt(duration)}
          </span>
        )}
        {/* progress bar + timecode, click to seek (both videos stay in sync) */}
        {(playing || time > 0) && (
          <div className="absolute inset-x-0 bottom-0 z-10">
            <div className="mono flex items-center justify-between px-2 pb-1 text-[11px] text-white/90">
              <span className="rounded bg-black/60 px-1.5 py-0.5">{fmt(time)}</span>
              <span className="rounded bg-black/60 px-1.5 py-0.5">{fmt(duration)}</span>
            </div>
            <div
              onClick={seek}
              className="group/bar h-2.5 w-full cursor-pointer bg-black/50 pt-1.5"
              role="slider"
              aria-label="seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(time)}
            >
              <div className="relative h-1 w-full bg-white/20">
                <div
                  className="absolute inset-y-0 left-0 bg-pl-red"
                  style={{ width: duration ? `${(time / duration) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>
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
