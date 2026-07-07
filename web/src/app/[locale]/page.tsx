import { getTranslations, setRequestLocale } from "next-intl/server";
import { GALLERY } from "@/lib/clips";
import ABPlayer from "@/components/ABPlayer";
import UploadSection from "@/components/UploadSection";
import { Link } from "@/i18n/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site");
  const pl = locale === "pl";

  return (
    <main className="mx-auto max-w-5xl px-5">
      {/* hero — the story IS the product */}
      <section className="py-14 text-center sm:py-20">
        <h1 className="display mx-auto max-w-3xl text-4xl leading-tight sm:text-6xl">
          {t("tagline")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-paper-dim sm:text-lg">
          {t("heroLead")}
        </p>
        <a
          href="#upload"
          className="mono mt-8 inline-block rounded-full bg-pl-red px-6 py-3 text-sm text-white transition-transform hover:scale-[1.03]"
        >
          {t("heroCta")} ↓
        </a>
      </section>

      {/* gallery — instant wow, zero pipeline */}
      <section className="py-10">
        <h2 className="display text-2xl sm:text-3xl">{t("galleryTitle")}</h2>
        <p className="mt-1 text-sm text-paper-dim">{t("galleryHint")}</p>
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          {GALLERY.map((clip) => (
            <div key={clip.id}>
              <ABPlayer
                originalUrl={clip.originalUrl}
                lektorUrl={clip.lektorUrl}
                poster={clip.posterUrl}
                labels={{ original: t("original"), lektor: t("lektor") }}
              />
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <Link
                  href={`/clip/${clip.id}`}
                  className="display text-lg hover:underline"
                >
                  {pl ? clip.titlePl : clip.titleEn}
                </Link>
                <span className="mono shrink-0 text-[11px] text-paper-dim">
                  {clip.license}
                </span>
              </div>
              <p className="mt-1 text-sm text-paper-dim">
                {pl ? clip.blurbPl : clip.blurbEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* second act: your own clip */}
      <UploadSection />
    </main>
  );
}
