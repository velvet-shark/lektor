"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const MAX = 280;

export default function Powiedz() {
  const t = useTranslations("powiedz");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const speak = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/powiedz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      void new Audio(url).play();
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[66ch] pt-4">
      <h1 className="tt-row tt-row-1 tt-bar bg-tt-blue font-bold text-tt-yellow">
        {t("title")}
      </h1>
      <p className="tt-row tt-row-2 mt-3 text-[0.85em] leading-relaxed text-tt-cyan">
        {t("hint")}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder={t("placeholder")}
        rows={3}
        className="tt-row tt-row-3 mt-6 w-full border-2 border-tt-white bg-tt-black p-3 text-tt-white outline-none placeholder:text-tt-dim focus:border-tt-yellow"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void speak();
        }}
      />
      <div className="mt-1 text-right text-[0.75em] tabular-nums text-tt-dim">
        {text.length}/{MAX}
      </div>

      <div className="tt-row tt-row-4 mt-3 flex flex-wrap items-center gap-4">
        <button
          onClick={() => void speak()}
          disabled={busy || !text.trim()}
          className="cursor-pointer bg-tt-green px-5 py-2 text-[0.85em] uppercase text-tt-black hover:bg-tt-yellow disabled:cursor-default disabled:bg-tt-dim"
        >
          {busy ? t("generating") : t("button")}
        </button>
        {audioUrl && !busy && (
          <audio controls src={audioUrl} className="h-10 max-w-56" />
        )}
      </div>
      {error && (
        <p className="tt-bar mt-4 inline-block bg-tt-red text-[0.85em] text-tt-white">
          {error}
        </p>
      )}
    </div>
  );
}
