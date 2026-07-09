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
    id: "his-girl-friday",
    titleEn: "His Girl Friday (1940)",
    titlePl: "Dziewczyna Piętaszek (1940)",
    blurbEn: "The fastest dialogue ever filmed — 402 words in 90 seconds. The lektor is not impressed.",
    blurbPl: "Najszybsze dialogi w historii kina — 402 słowa w 90 sekund. Lektor niewzruszony.",
    originalUrl: "/gallery/his-girl-friday.mp4",
    lektorUrl: "/gallery/his-girl-friday.lektor.mp4",
    posterUrl: "/gallery/his-girl-friday.jpg",
    durationS: 90,
    license: "Public domain · copyright not renewed (1940)",
    licenseUrl: "https://en.wikipedia.org/wiki/His_Girl_Friday",
  },
  {
    id: "mclintock",
    titleEn: "McLintock! (1963)",
    titlePl: "McLintock! (1963)",
    blurbEn: "John Wayne starts a fifty-person mudslide brawl. One voice keeps its composure.",
    blurbPl: "John Wayne wywołuje bijatykę na pięćdziesiąt osób. Jeden głos zachowuje spokój.",
    originalUrl: "/gallery/mclintock.mp4",
    lektorUrl: "/gallery/mclintock.lektor.mp4",
    posterUrl: "/gallery/mclintock.jpg",
    durationS: 90,
    license: "Public domain · copyright not renewed (1963)",
    licenseUrl: "https://en.wikipedia.org/wiki/McLintock!",
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
    id: "fast-furious",
    titleEn: "The Fast and the Furious (1955)",
    titlePl: "The Fast and the Furious (1955)",
    blurbEn: "Yes, that title — the 1955 original. Race day, barked orders, one unhurried voice.",
    blurbPl: "Tak, ten tytuł — oryginał z 1955. Dzień wyścigu, krzyki, jeden niespieszny głos.",
    originalUrl: "/gallery/fast-furious.mp4",
    lektorUrl: "/gallery/fast-furious.lektor.mp4",
    posterUrl: "/gallery/fast-furious.jpg",
    durationS: 84,
    license: "Public domain · copyright not renewed (1955)",
    licenseUrl: "https://en.wikipedia.org/wiki/The_Fast_and_the_Furious_(1955_film)",
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
