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
    <div>
      {/* hero — rows 1–6 of the page */}
      <section className="pt-4">
        <h1 className="tt-row tt-row-1 tt-ext tt-dh text-2xl text-tt-white sm:text-4xl">
          THE LEKTOR
        </h1>
        <p className="tt-row tt-row-2 tt-bar bg-tt-blue text-tt-yellow">
          {t("tagline")}
        </p>
        <p className="tt-row tt-row-3 mt-3 max-w-[62ch] leading-relaxed text-tt-white">
          {t("heroLead")}
        </p>
        <div className="tt-row tt-row-4 tt-mosaic mt-5 text-tt-red" aria-hidden />
      </section>

      {/* gallery — instant wow, zero pipeline */}
      <section id="gallery" className="tt-row tt-row-5 scroll-mt-4 pt-8">
        <h2 className="tt-bar bg-tt-green font-bold uppercase text-tt-black">
          {t("galleryTitle")}
        </h2>
        <p className="mt-1 text-[0.85em] text-tt-cyan">{t("galleryHint")}</p>
        <div className="mt-6 grid gap-10 sm:grid-cols-2 sm:gap-x-6">
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
                  className="font-bold uppercase text-tt-cyan hover:bg-tt-cyan hover:text-tt-black"
                >
                  {pl ? clip.titlePl : clip.titleEn}
                </Link>
                <span className="shrink-0 text-[0.7em] text-tt-dim">
                  {clip.license.split("·")[0]?.trim()}
                </span>
              </div>
              <p className="mt-1 text-[0.85em] leading-snug text-tt-white">
                {pl ? clip.blurbPl : clip.blurbEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="tt-mosaic mt-10 text-tt-blue" aria-hidden />

      {/* second act: your own clip */}
      <UploadSection />
    </div>
  );
}
