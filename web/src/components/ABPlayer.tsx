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
 *
 * Visually: a broadcast window inset in the teletext page — hard white frame,
 * square red play block, cell-blocky progress row. No curve survives.
 */
export default function ABPlayer({
  originalUrl,
  lektorUrl,
  poster,
  durationS,
  labels,
  autoLektor = true,
  className = "",
}: {
  originalUrl: string;
  lektorUrl: string;
  poster?: string;
  durationS?: number;
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
  const [duration, setDuration] = useState(durationS ?? 0);

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
  }, [mode]);

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

  const seekBy = (deltaS: number) => {
    const l = leader();
    const f = follower();
    if (!l || !duration) return;
    const next = Math.min(duration, Math.max(0, l.currentTime + deltaS));
    l.currentTime = next;
    if (f) f.currentTime = next;
    setTime(next);
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

  const playPause = async () => {
    const l = leader();
    const f = follower();
    if (!l) return;
    if (l.paused) {
      for (const video of [l, f]) {
        if (video) video.preload = "auto";
      }
      if (f) f.currentTime = l.currentTime;
      try {
        await l.play();
        setPlaying(true);
        if (f) {
          f.currentTime = l.currentTime;
          void f.play().catch(() => {});
        }
      } catch {
        l.pause();
        f?.pause();
        setPlaying(false);
      }
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
    preload: durationS ? ("none" as const) : ("metadata" as const),
    poster,
    muted: mode !== which,
    onClick: playPause,
    onEnded: () => setPlaying(false),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const d = e.currentTarget.duration;
      if (isFinite(d)) setDuration(d);
    },
  });

  return (
    <div className={`group relative ${className}`}>
      {/* the broadcast window, inset in the page */}
      <div className="relative aspect-video w-full overflow-hidden border-2 border-tt-white bg-tt-black">
        <video ref={origRef} src={originalUrl} {...vid("original")} />
        <video ref={lekRef} src={lektorUrl} {...vid("lektor")} />
        {!playing && (
          <button
            onClick={playPause}
            aria-label="play"
            className="absolute inset-0 z-10 grid place-items-center"
          >
            <span className="grid h-14 w-14 place-items-center bg-tt-red pl-1 text-2xl text-tt-white group-hover:bg-tt-yellow group-hover:text-tt-black">
              ▶
            </span>
          </button>
        )}
        {/* duration badge before playback starts */}
        {!playing && time === 0 && (
          <span className="absolute bottom-1 right-1 z-10 bg-tt-black px-2 text-[0.75em] text-tt-white">
            {fmt(duration)}
          </span>
        )}
        {/* progress row + timecode, click to seek (both videos stay in sync) */}
        {(playing || time > 0) && (
          <div className="absolute inset-x-0 bottom-0 z-10">
            <div className="flex items-center justify-between px-1 pb-0.5 text-[0.7em]">
              <span className="bg-tt-black px-1 text-tt-green">{fmt(time)}</span>
              <span className="bg-tt-black px-1 text-tt-white">{fmt(duration)}</span>
            </div>
            <div
              onClick={seek}
              className="h-3 w-full cursor-pointer bg-tt-black pt-1"
              role="slider"
              tabIndex={0}
              aria-label="seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(time)}
              aria-valuetext={`${fmt(time)} / ${fmt(duration)}`}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  seekBy(e.key === "ArrowLeft" ? -5 : 5);
                }
              }}
            >
              <div className="relative h-2 w-full bg-tt-blue">
                <div
                  className="absolute inset-y-0 left-0 bg-tt-yellow"
                  style={{ width: duration ? `${(time / duration) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* the switch: two hard teletext keys, active = solid block */}
      <div className="mt-2 grid grid-cols-2 border border-tt-dim text-center text-[0.85em] uppercase">
        <button
          onClick={() => toggle("original")}
          className={`cursor-pointer px-2 py-1.5 ${
            mode === "original"
              ? "bg-tt-cyan text-tt-black"
              : "text-tt-cyan hover:text-tt-white"
          }`}
        >
          {labels.original}
        </button>
        <button
          onClick={() => toggle("lektor")}
          className={`cursor-pointer px-2 py-1.5 ${
            mode === "lektor"
              ? "bg-tt-yellow text-tt-black"
              : "text-tt-yellow hover:text-tt-white"
          }`}
        >
          {labels.lektor}
        </button>
      </div>
    </div>
  );
}
