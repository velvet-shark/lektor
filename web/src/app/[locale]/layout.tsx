import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import LangToggle from "@/components/LangToggle";
import Clock from "@/components/Clock";
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
          {/* the captured page: everything lives inside this screen column */}
          <div className="mx-auto flex min-h-dvh w-full max-w-[820px] flex-col px-2 sm:px-4">
            {/* row 0: header strip — channel ident + the real clock */}
            <header className="flex items-baseline justify-between gap-2 py-2 text-[0.8em]">
              <Link href="/" className="whitespace-nowrap hover:text-tt-yellow">
                <span className="text-tt-white">THE LEKTOR</span>{" "}
                <span className="text-tt-cyan">{t("ident")}</span>
              </Link>
              <span className="flex items-baseline gap-3">
                <Clock />
                <LangToggle />
              </span>
            </header>

            {/* top row of the screen: the fastext keys are the nav */}
            <nav className="fastext sticky top-0 z-40 -mx-2 sm:-mx-4" aria-label="fastext">
              <Link href="/#upload" className="bg-tt-red">
                {t("fastRed")}
              </Link>
              <Link href="/#gallery" className="bg-tt-green">
                {t("fastGreen")}
              </Link>
              <Link href="/powiedz" className="bg-tt-yellow">
                {t("fastYellow")}
              </Link>
              <Link href="/about" className="bg-tt-cyan">
                {t("fastCyan")}
              </Link>
            </nav>

            <main className="flex-1 pb-4">{children}</main>

            {/* telegazeta page 888 — the credits bar every TV had */}
            <footer className="mt-14 pb-2 text-[0.75em] leading-relaxed">
              <div className="tt-bar bg-tt-blue text-center text-tt-white">
                888 <span className="text-tt-yellow">{t("ident")}</span> 888
              </div>
              <div className="space-y-1 py-3">
                <p className="text-tt-cyan">
                  {t("footerHomage")} ·{" "}
                  <a className="underline hover:text-tt-yellow" href="https://velvetshark.com">
                    velvetshark.com
                  </a>
                </p>
                <p className="text-tt-dim">{t("footerNoClone")}</p>
                <p className="text-tt-dim">
                  {t("footerUploads")} · {t("footerDmca")}:{" "}
                  <a className="underline hover:text-tt-yellow" href="mailto:dmca@velvetshark.com">
                    dmca@velvetshark.com
                  </a>
                </p>
                <p className="pt-2 text-tt-dim">{t("endOfPage")}</p>
              </div>
            </footer>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
