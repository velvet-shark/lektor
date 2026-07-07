/**
 * Static gallery manifest — the landing page has zero runtime dependencies
 * (no DB, no storage API): if launch traffic spikes, the wow still loads.
 * URLs are same-origin (files in public/gallery) until/unless moved to a CDN.
 */
export interface GalleryClip {
  id: string;
  titleEn: string;
  titlePl: string;
  blurbEn: string;
  blurbPl: string;
  originalUrl: string;
  lektorUrl: string;
  posterUrl: string;
  durationS: number;
  license: string;
  licenseUrl?: string;
}

export const GALLERY: GalleryClip[] = [
  {
    id: "charade",
    titleEn: "Charade (1963)",
    titlePl: "Szarada (1963)",
    blurbEn: "Cary Grant and Audrey Hepburn flirt in Megève. One bored voice reads them both.",
    blurbPl: "Cary Grant i Audrey Hepburn flirtują w Megève. Oboje czytani jednym znudzonym głosem.",
    originalUrl: "/gallery/charade.mp4",
    lektorUrl: "/gallery/charade.lektor.mp4",
    posterUrl: "/gallery/charade.jpg",
    durationS: 81,
    license: "Public domain · defective copyright notice (1963)",
    licenseUrl: "https://en.wikipedia.org/wiki/Charade_(1963_film)",
  },
  {
    id: "notld",
    titleEn: "Night of the Living Dead (1968)",
    titlePl: "Noc żywych trupów (1968)",
    blurbEn: "\"They're coming to get you, Barbara!\" — delivered with the enthusiasm of a weather report.",
    blurbPl: "\"Idą po ciebie, Barbaro!\" — z entuzjazmem prognozy pogody.",
    originalUrl: "/gallery/notld.mp4",
    lektorUrl: "/gallery/notld.lektor.mp4",
    posterUrl: "/gallery/notld.jpg",
    durationS: 72,
    license: "Public domain · notice omitted on release (1968)",
    licenseUrl: "https://en.wikipedia.org/wiki/Night_of_the_Living_Dead",
  },
  {
    id: "superman",
    titleEn: "Superman (1941)",
    titlePl: "Superman (1941)",
    blurbEn: "Faster than a speeding bullet. The lektor, famously, is not in a hurry.",
    blurbPl: "Szybszy niż pędząca kula. Lektorowi, jak wiadomo, się nie spieszy.",
    originalUrl: "/gallery/superman.mp4",
    lektorUrl: "/gallery/superman.lektor.mp4",
    posterUrl: "/gallery/superman.jpg",
    durationS: 80,
    license: "Public domain · Fleischer Studios, not renewed (1941)",
    licenseUrl: "https://en.wikipedia.org/wiki/Superman_(1941_film)",
  },
  {
    id: "plan9",
    titleEn: "Plan 9 from Outer Space (1959)",
    titlePl: "Plan 9 z kosmosu (1959)",
    blurbEn: "The worst film ever made meets the flattest voice ever designed. Criswell predicts.",
    blurbPl: "Najgorszy film świata spotyka najbardziej płaski głos świata. Criswell przepowiada.",
    originalUrl: "/gallery/plan9.mp4",
    lektorUrl: "/gallery/plan9.lektor.mp4",
    posterUrl: "/gallery/plan9.jpg",
    durationS: 70,
    license: "Public domain · copyright not renewed (1959)",
    licenseUrl: "https://en.wikipedia.org/wiki/Plan_9_from_Outer_Space",
  },
  {
    id: "radek",
    titleEn: "Radek, lektor'd",
    titlePl: "Radek z lektorem",
    blurbEn: "The builder of this site, read by the voice he built. Full circle, twice.",
    blurbPl: "Autor tej strony, czytany przez głos, który sam zbudował. Pętla domknięta podwójnie.",
    originalUrl: "/gallery/radek.mp4",
    lektorUrl: "/gallery/radek.lektor.mp4",
    posterUrl: "/gallery/radek.jpg",
    durationS: 90,
    license: "Own content · velvetshark (2026)",
    licenseUrl: "https://www.youtube.com/watch?v=NZ1mKAWJPr4",
  },
];

export const getClip = (id: string) => GALLERY.find((c) => c.id === id);
