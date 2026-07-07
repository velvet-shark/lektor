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
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="display text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 text-sm text-paper-dim">{t("hint")}</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder={t("placeholder")}
        rows={3}
        className="mt-8 w-full rounded-xl border border-paper/20 bg-crt-2 p-4 text-lg outline-none placeholder:text-paper-dim/50 focus:border-pl-red/60"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void speak();
        }}
      />
      <div className="mono mt-1 text-right text-xs text-paper-dim">
        {text.length}/{MAX}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => void speak()}
          disabled={busy || !text.trim()}
          className="mono rounded-full bg-pl-red px-6 py-3 text-sm text-white disabled:opacity-40"
        >
          {busy ? t("generating") : t("button")}
        </button>
        {audioUrl && !busy && (
          <audio controls src={audioUrl} className="h-10 max-w-56" />
        )}
      </div>
      {error && <p className="mt-4 text-sm text-pl-red">{error}</p>}
    </main>
  );
}
