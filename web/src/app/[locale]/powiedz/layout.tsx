import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localizedAlternates } from "@/lib/site-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "powiedz" });
  return {
    title: t("title"),
    description: t("hint"),
    alternates: localizedAlternates(locale, "/powiedz"),
    openGraph: {
      title: t("title"),
      description: t("hint"),
      url: `${locale === "pl" ? "/pl" : ""}/powiedz`,
    },
  };
}

export default function PowiedzLayout({ children }: { children: React.ReactNode }) {
  return children;
}
