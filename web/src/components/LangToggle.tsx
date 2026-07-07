"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LangToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === "pl" ? "en" : "pl";
  return (
    <button
      onClick={() => router.replace(pathname, { locale: other })}
      className="mono rounded-full border border-paper/25 px-3 py-1 text-xs uppercase hover:border-paper/60"
      aria-label={`switch language to ${other}`}
    >
      {locale === "pl" ? "en" : "pl"}
    </button>
  );
}
