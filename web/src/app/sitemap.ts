import type { MetadataRoute } from "next";
import { GALLERY } from "@/lib/clips";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  const localizedPaths = ["", "/about", "/powiedz", ...GALLERY.map((clip) => `/clip/${clip.id}`)];
  const now = new Date();

  return localizedPaths.flatMap((path) =>
    [
      path || "/",
      `/pl${path}`,
    ].map((localizedPath) => ({
      url: new URL(localizedPath, site).toString(),
      lastModified: now,
      changeFrequency: path.startsWith("/clip/") ? "monthly" : "weekly",
      priority: path === "" ? 1 : path.startsWith("/clip/") ? 0.7 : 0.8,
    }))
  );
}
