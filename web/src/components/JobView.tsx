"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ABPlayer from "./ABPlayer";

interface JobJson {
  status: string;
  input_url: string | null;
  result_url: string | null;
  download_url: string | null;
  error: string | null;
  position: number | null;
}

export default function JobView({
  jobId,
  labels,
}: {
  jobId: string;
  labels: { original: string; lektor: string };
}) {
  const t = useTranslations("upload");
  const [job, setJob] = useState<JobJson | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.status === 404) {
        setMissing(true);
        return true;
      }
      if (res.ok) {
        const j = (await res.json()) as JobJson;
        setJob(j);
        return j.status === "done" || j.status === "error";
      }
      return false;
    };
    const tick = async () => {
      if (stop) return;
      const finished = await load().catch(() => false);
      if (!finished && !stop) setTimeout(tick, 2500);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [jobId]);

  if (missing)
    return <p className="text-tt-dim">{t("failed", { reason: "404" })}</p>;
  if (!job) return <p className="tt-pulse text-tt-green">…</p>;

  if (job.status === "done" && job.result_url) {
    return (
      <div>
        <p className="tt-bar mb-4 inline-block bg-tt-green text-[0.85em] text-tt-black">
          {t("done")}
        </p>
        <ABPlayer
          originalUrl={job.input_url ?? job.result_url}
          lektorUrl={job.result_url}
          labels={labels}
        />
        <div className="mt-4 flex gap-3 text-[0.85em] uppercase">
          <a
            href={job.download_url ?? job.result_url}
            download
            className="bg-tt-red px-4 py-1.5 text-tt-white hover:bg-tt-yellow hover:text-tt-black"
          >
            {t("download")}
          </a>
        </div>
      </div>
    );
  }

  if (job.status === "error")
    return (
      <p className="tt-bar bg-tt-red text-[0.85em] text-tt-white">
        {/no speech/i.test(job.error ?? "")
          ? t("noSpeech")
          : t("failed", { reason: job.error ?? "?" })}
      </p>
    );

  const stateKey = ({
    transcribing: "transcribing",
    translating: "translating",
    summoning: "summoning",
    mixing: "mixing",
  } as Record<string, string>)[job.status];

  return (
    <div className="border-2 border-tt-white px-6 py-10 text-center">
      <p className="tt-pulse text-[0.9em] text-tt-green">
        {job.status === "queued"
          ? `${t("queued")} ${t("queuePosition", { n: job.position ?? 1 })}`
          : stateKey
            ? t(`states.${stateKey}`)
            : job.status}
      </p>
    </div>
  );
}
