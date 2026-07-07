"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import ABPlayer from "./ABPlayer";

type Phase =
  | { k: "idle" }
  | { k: "error"; msg: string }
  | { k: "uploading" }
  | { k: "queued"; jobId: string; position: number }
  | { k: "working"; jobId: string; state: string }
  | {
      k: "done";
      jobId: string;
      resultUrl: string;
      downloadUrl: string;
      originalUrl: string;
    };

const MAX_BYTES = 150 * 1024 * 1024;
const MAX_SECONDS = 90;
const TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export default function UploadSection() {
  const t = useTranslations("upload");
  const ts = useTranslations("site");
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const fail = (msg: string) => setPhase({ k: "error", msg });

  const probeDuration = (file: File) =>
    new Promise<number>((resolveDur, reject) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(v.src);
        resolveDur(v.duration);
      };
      v.onerror = () => reject(new Error("unreadable"));
      v.src = URL.createObjectURL(file);
    });

  const handleFile = useCallback(async (file: File) => {
    if (!TYPES.includes(file.type)) return fail(t("badType"));
    if (file.size > MAX_BYTES) return fail(t("tooBig"));
    let duration = 0;
    try {
      duration = await probeDuration(file);
    } catch {
      return fail(t("badType"));
    }
    if (duration > MAX_SECONDS + 0.5) return fail(t("tooLong"));

    setPhase({ k: "uploading" });
    try {
      const presign = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          size: file.size,
          durationS: Math.round(duration),
        }),
      });
      if (!presign.ok) throw new Error(await presign.text());
      const { putUrl, key } = await presign.json();

      const put = await fetch(putUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload ${put.status}`);

      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, durationS: Math.round(duration) }),
      });
      if (!jobRes.ok) throw new Error(await jobRes.text());
      const { id, position } = await jobRes.json();
      setPhase({ k: "queued", jobId: id, position });
    } catch (e) {
      fail(t("failed", { reason: e instanceof Error ? e.message : "?" }));
    }
  }, [t]);

  // poll job status
  const jobId =
    phase.k === "queued" || phase.k === "working" ? phase.jobId : null;
  useEffect(() => {
    if (!jobId) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const j = await res.json();
        if (j.status === "done") {
          setPhase({
            k: "done",
            jobId,
            resultUrl: j.result_url,
            downloadUrl: j.download_url ?? j.result_url,
            originalUrl: j.input_url,
          });
        } else if (j.status === "error") {
          fail(
            j.error === "NO_SPEECH" || /no speech/i.test(j.error ?? "")
              ? t("noSpeech")
              : t("failed", { reason: j.error ?? "?" })
          );
        } else if (j.status === "queued") {
          setPhase({ k: "queued", jobId, position: j.position ?? 1 });
        } else {
          setPhase({ k: "working", jobId, state: j.status });
        }
      } catch {
        /* transient — keep polling */
      }
    }, 2500);
    return () => clearInterval(id);
  }, [jobId, t]);

  const stateLabel = (s: string) => {
    const key = ({
      transcribing: "transcribing",
      translating: "translating",
      summoning: "summoning",
      mixing: "mixing",
    } as Record<string, string>)[s];
    return key ? t(`states.${key}`) : s;
  };

  return (
    <section id="upload" className="py-16">
      <h2 className="display text-2xl sm:text-3xl">{t("title")}</h2>
      <p className="mono mt-1 text-xs text-paper-dim">{t("hint")}</p>

      {phase.k === "idle" || phase.k === "error" ? (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
            onClick={() => fileInput.current?.click()}
            className={`mt-6 grid h-44 cursor-pointer place-items-center rounded-xl border-2 border-dashed transition-colors ${
              drag ? "border-pl-red bg-pl-red/5" : "border-paper/20 hover:border-paper/40"
            }`}
          >
            <span className="px-6 text-center text-sm text-paper-dim">{t("drop")}</span>
            <input
              ref={fileInput}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>
          <p className="mt-2 text-xs text-paper-dim">{t("consent")}</p>
          {phase.k === "error" && (
            <p className="mt-3 rounded-lg border border-pl-red/40 bg-pl-red/10 px-4 py-3 text-sm">
              {phase.msg}
            </p>
          )}
        </>
      ) : phase.k === "done" ? (
        <div className="mt-6">
          <p className="mb-4 text-sm">{t("done")}</p>
          <ABPlayer
            originalUrl={phase.originalUrl}
            lektorUrl={phase.resultUrl}
            labels={{ original: ts("original"), lektor: ts("lektor") }}
            className="max-w-2xl"
          />
          <div className="mono mt-4 flex gap-4 text-sm">
            <a href={phase.downloadUrl} download className="rounded-full bg-pl-red px-5 py-2 text-white">
              {t("download")}
            </a>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(
                  `${location.origin}/job/${phase.jobId}`
                );
              }}
              className="rounded-full border border-paper/30 px-5 py-2 hover:border-paper/60"
            >
              {t("share")}
            </button>
            <button
              onClick={() => setPhase({ k: "idle" })}
              className="px-3 py-2 text-paper-dim hover:text-paper"
            >
              {t("another")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-paper/15 px-6 py-8 text-center">
          <p className="pulse-dim mono text-sm">
            {phase.k === "uploading"
              ? t("uploading")
              : phase.k === "queued"
                ? `${t("queued")} ${t("queuePosition", { n: phase.position })}`
                : stateLabel(phase.state)}
          </p>
        </div>
      )}
    </section>
  );
}
