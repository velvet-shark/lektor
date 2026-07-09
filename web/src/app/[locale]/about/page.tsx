import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates } from "@/lib/site-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("title"),
    description: t("body1"),
    alternates: localizedAlternates(locale, "/about"),
    openGraph: {
      title: t("title"),
      description: t("body1"),
      url: `${locale === "pl" ? "/pl" : ""}/about`,
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function About({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <div className="mx-auto max-w-[66ch] pt-4">
      <h1 className="tt-row tt-row-1 tt-bar bg-tt-blue font-bold text-tt-yellow">
        {t("title")}
      </h1>
      <div className="mt-6 space-y-5 text-[0.95em] leading-relaxed text-tt-white">
        <p className="tt-row tt-row-2">{t("body1")}</p>
        <p className="tt-row tt-row-3">{t("body2")}</p>
        <p className="tt-row tt-row-4 text-tt-cyan">{t("body3")}</p>
        <p className="tt-row tt-row-5 tt-bar bg-tt-white text-tt-black">
          {t("body4")}
        </p>
      </div>
      <div className="tt-mosaic-thin mt-8 text-tt-magenta" aria-hidden />
      <p className="mt-3 text-[0.75em] text-tt-dim">{t("credits")}</p>
    </div>
  );
}
