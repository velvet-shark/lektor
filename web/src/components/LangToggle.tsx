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
      className="bg-tt-white px-2 uppercase text-tt-black hover:bg-tt-yellow"
      aria-label={`switch language to ${other}`}
    >
      {other}
    </button>
  );
}
