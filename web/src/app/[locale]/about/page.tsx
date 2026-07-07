import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function About({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="display text-3xl leading-tight sm:text-4xl">{t("title")}</h1>
      <div className="mt-8 space-y-6 leading-relaxed text-paper/90">
        <p>{t("body1")}</p>
        <p>{t("body2")}</p>
        <p>{t("body3")}</p>
        <p className="border-l-2 border-pl-red pl-4 text-paper-dim">{t("body4")}</p>
      </div>
      <p className="mono mt-12 text-xs text-paper-dim">{t("credits")}</p>
    </main>
  );
}
