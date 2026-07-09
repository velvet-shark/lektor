const FALLBACK_SITE_URL = "https://lektor-velvetsharks-projects.vercel.app";

export function getSiteUrl(): URL {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    FALLBACK_SITE_URL;
  return new URL(/^https?:\/\//.test(configured) ? configured : `https://${configured}`);
}

export function localizedAlternates(locale: string, path = "") {
  const en = path || "/";
  const pl = `/pl${path}`;
  return {
    canonical: locale === "pl" ? pl : en,
    languages: { en, pl, "x-default": en },
  };
}
