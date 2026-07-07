import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import LangToggle from "@/components/LangToggle";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    title: { default: `${t("title")} — ${t("tagline")}`, template: "%s — The Lektor" },
    description: t("heroLead"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "site" });

  return (
    <html lang={locale}>
      <body className="scanlines">
        <NextIntlClientProvider>
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/" className="display text-lg tracking-tight">
            <span className="text-pl-red">●</span> the lektor
          </Link>
          <nav className="mono flex items-center gap-5 text-sm text-paper-dim">
            <Link href="/powiedz" className="hover:text-paper">{t("powiedz")}</Link>
            <Link href="/about" className="hover:text-paper">{t("about")}</Link>
            <LangToggle />
          </nav>
        </header>
        {children}
        <footer className="mx-auto mt-24 max-w-5xl space-y-2 border-t border-paper/10 px-5 py-10 text-center text-xs text-paper-dim">
          <p>{t("footerHomage")} · <a className="underline hover:text-paper" href="https://velvetshark.com">velvetshark.com</a></p>
          <p>{t("footerNoClone")}</p>
          <p>
            {t("footerUploads")} · {t("footerDmca")}:{" "}
            <a className="underline hover:text-paper" href="mailto:dmca@velvetshark.com">dmca@velvetshark.com</a>
          </p>
        </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
