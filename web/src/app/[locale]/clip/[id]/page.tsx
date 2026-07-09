import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GALLERY, getClip } from "@/lib/clips";
import ABPlayer from "@/components/ABPlayer";
import { Link } from "@/i18n/navigation";
import { getSiteUrl, localizedAlternates } from "@/lib/site-url";

export function generateStaticParams() {
  return GALLERY.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const clip = getClip(id);
  if (!clip) return {};
  const title = locale === "pl" ? clip.titlePl : clip.titleEn;
  const description = locale === "pl" ? clip.blurbPl : clip.blurbEn;
  const site = getSiteUrl();
  const path = `${locale === "pl" ? "/pl" : ""}/clip/${id}`;
  const videoUrl = new URL(clip.lektorUrl, site);
  const posterUrl = new URL(clip.posterUrl, site);
  const playerUrl = new URL(path, site);
  return {
    title,
    description,
    alternates: localizedAlternates(locale, `/clip/${id}`),
    openGraph: {
      title: `${title} — The Lektor`,
      description,
      url: path,
      videos: [{ url: videoUrl, type: "video/mp4", width: 1280, height: 720 }],
      images: [{ url: posterUrl, width: 1280, height: 720 }],
    },
    twitter: {
      card: "player",
      title: `${title} — The Lektor`,
      description,
      images: [posterUrl],
      players: [{ playerUrl, streamUrl: videoUrl, width: 1280, height: 720 }],
    },
  };
}

export default async function ClipPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const clip = getClip(id);
  if (!clip) notFound();
  const t = await getTranslations("site");
  const tc = await getTranslations("clip");
  const pl = locale === "pl";

  return (
    <div className="mx-auto max-w-[72ch] pt-4">
      <h1 className="tt-row tt-row-1 tt-bar bg-tt-blue font-bold uppercase text-tt-yellow">
        {pl ? clip.titlePl : clip.titleEn}
      </h1>
      <p className="tt-row tt-row-2 mt-2 text-[0.85em] text-tt-white">
        {pl ? clip.blurbPl : clip.blurbEn}
      </p>
      <ABPlayer
        className="tt-row tt-row-3 mt-5"
        originalUrl={clip.originalUrl}
        lektorUrl={clip.lektorUrl}
        poster={clip.posterUrl}
        labels={{ original: t("original"), lektor: t("lektor") }}
      />
      <p className="tt-row tt-row-4 mt-5 break-words text-[0.75em] text-tt-dim">
        {tc("license")}: {clip.license}
        {clip.licenseUrl && (
          <>
            {" · "}
            <a href={clip.licenseUrl} className="underline hover:text-tt-cyan">
              {clip.licenseUrl}
            </a>
          </>
        )}
      </p>
      <p className="tt-row tt-row-5 mt-6">
        <Link href="/" className="text-[0.85em] text-tt-cyan hover:bg-tt-cyan hover:text-tt-black">
          ← {tc("backHome")}
        </Link>
      </p>
    </div>
  );
}
