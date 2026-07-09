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
    <section id="upload" className="scroll-mt-4 pt-8">
      <h2 className="tt-bar bg-tt-red font-bold uppercase text-tt-white">
        {t("title")}
      </h2>
      <p className="mt-1 text-[0.75em] text-tt-cyan">{t("hint")}</p>

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
            className={`mt-4 grid h-40 cursor-pointer place-items-center border-2 ${
              drag
                ? "border-tt-yellow bg-tt-blue"
                : "border-tt-white hover:border-tt-yellow"
            }`}
          >
            <span className="px-6 text-center text-[0.85em] text-tt-white">
              <span className="tt-blink text-tt-yellow">▮</span> {t("drop")}
            </span>
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
          <p className="mt-2 text-[0.75em] text-tt-dim">{t("consent")}</p>
          {phase.k === "error" && (
            <p className="tt-bar mt-3 bg-tt-red text-[0.85em] text-tt-white">
              {phase.msg}
            </p>
          )}
        </>
      ) : phase.k === "done" ? (
        <div className="mt-4">
          <p className="tt-bar mb-4 inline-block bg-tt-green text-[0.85em] text-tt-black">
            {t("done")}
          </p>
          <ABPlayer
            originalUrl={phase.originalUrl}
            lektorUrl={phase.resultUrl}
            labels={{ original: ts("original"), lektor: ts("lektor") }}
            className="max-w-2xl"
          />
          <div className="mt-4 flex flex-wrap gap-3 text-[0.85em] uppercase">
            <a
              href={phase.downloadUrl}
              download
              className="bg-tt-red px-4 py-1.5 text-tt-white hover:bg-tt-yellow hover:text-tt-black"
            >
              {t("download")}
            </a>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(
                  `${location.origin}/job/${phase.jobId}`
                );
              }}
              className="cursor-pointer border border-tt-cyan px-4 py-1.5 text-tt-cyan hover:bg-tt-cyan hover:text-tt-black"
            >
              {t("share")}
            </button>
            <button
              onClick={() => setPhase({ k: "idle" })}
              className="cursor-pointer px-2 py-1.5 text-tt-dim hover:text-tt-white"
            >
              {t("another")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 border-2 border-tt-white px-6 py-8 text-center">
          <p className="tt-pulse text-[0.9em] text-tt-green">
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
