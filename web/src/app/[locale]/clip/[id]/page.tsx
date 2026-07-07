import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GALLERY, getClip } from "@/lib/clips";
import ABPlayer from "@/components/ABPlayer";
import { Link } from "@/i18n/navigation";

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
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lektor.velvetshark.com";
  return {
    title,
    description,
    openGraph: {
      title: `${title} — The Lektor`,
      description,
      videos: [{ url: `${base}${clip.lektorUrl}`, type: "video/mp4" }],
      images: [{ url: `${base}${clip.posterUrl}` }],
    },
    twitter: {
      card: "player",
      title: `${title} — The Lektor`,
      description,
      images: [`${base}${clip.posterUrl}`],
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
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="display text-3xl">{pl ? clip.titlePl : clip.titleEn}</h1>
      <p className="mt-1 text-sm text-paper-dim">{pl ? clip.blurbPl : clip.blurbEn}</p>
      <ABPlayer
        className="mt-8"
        originalUrl={clip.originalUrl}
        lektorUrl={clip.lektorUrl}
        poster={clip.posterUrl}
        labels={{ original: t("original"), lektor: t("lektor") }}
      />
      <p className="mono mt-6 text-xs text-paper-dim">
        {tc("license")}: {clip.license}
        {clip.licenseUrl && (
          <>
            {" · "}
            <a href={clip.licenseUrl} className="underline">{clip.licenseUrl}</a>
          </>
        )}
      </p>
      <p className="mt-8">
        <Link href="/" className="mono text-sm text-paper-dim hover:text-paper">
          ← {tc("backHome")}
        </Link>
      </p>
    </main>
  );
}
