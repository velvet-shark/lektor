"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Both languages visible, active one as a solid teletext block. */
export default function LangToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const btn = (target: "en" | "pl") => (
    <button
      key={target}
      onClick={() => locale !== target && router.replace(pathname, { locale: target })}
      aria-pressed={locale === target}
      aria-label={`language: ${target}`}
      className={
        "px-2 uppercase " +
        (locale === target
          ? "bg-tt-white text-tt-black"
          : "cursor-pointer text-tt-cyan hover:bg-tt-cyan hover:text-tt-black")
      }
    >
      {target}
    </button>
  );

  return (
    <span className="inline-flex border border-tt-dim">
      {btn("en")}
      {btn("pl")}
    </span>
  );
}
