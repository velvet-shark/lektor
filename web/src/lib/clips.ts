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
    id: "sintel",
    titleEn: "Sintel",
    titlePl: "Sintel",
    blurbEn: "Blender Foundation's open movie. A girl, a dragon, a shaman with opinions.",
    blurbPl: "Otwarty film Blender Foundation. Dziewczyna, smok i szaman z opiniami.",
    originalUrl: "/gallery/sintel.mp4",
    lektorUrl: "/gallery/sintel.lektor.mp4",
    posterUrl: "/gallery/sintel.jpg",
    durationS: 75,
    license: "CC-BY 3.0 · Blender Foundation (2010)",
    licenseUrl: "https://durian.blender.org/",
  },
  {
    id: "elephants-dream",
    titleEn: "Elephants Dream",
    titlePl: "Elephants Dream",
    blurbEn: "The first open movie. Two men in a machine, talking past each other.",
    blurbPl: "Pierwszy otwarty film. Dwóch ludzi w maszynie, każdy mówi o czymś innym.",
    originalUrl: "/gallery/elephants-dream.mp4",
    lektorUrl: "/gallery/elephants-dream.lektor.mp4",
    posterUrl: "/gallery/elephants-dream.jpg",
    durationS: 85,
    license: "CC-BY 2.5 · Blender Foundation (2006)",
    licenseUrl: "https://orange.blender.org/",
  },
  {
    id: "apollo11",
    titleEn: "Apollo 11 launch",
    titlePl: "Start Apollo 11",
    blurbEn: "July 16, 1969. Jack King counts down. The lektor stays calm — but so did Jack.",
    blurbPl: "16 lipca 1969. Jack King odlicza. Lektor zachowuje spokój — Jack zresztą też.",
    originalUrl: "/gallery/nasa-apollo11.mp4",
    lektorUrl: "/gallery/nasa-apollo11.lektor.mp4",
    posterUrl: "/gallery/nasa-apollo11.jpg",
    durationS: 80,
    license: "Public domain · NASA (1969)",
  },
  {
    id: "newsreel",
    titleEn: "First U.S. satellite (1958)",
    titlePl: "Pierwszy satelita USA (1958)",
    blurbEn: "A Universal Newsreel narrator meets his Polish counterpart, 68 years later.",
    blurbPl: "Narrator kroniki Universal spotyka polskiego kolegę po fachu, 68 lat później.",
    originalUrl: "/gallery/newsreel.mp4",
    lektorUrl: "/gallery/newsreel.lektor.mp4",
    posterUrl: "/gallery/newsreel.jpg",
    durationS: 75,
    license: "Public domain · Universal Newsreel (1958)",
  },
];

export const getClip = (id: string) => GALLERY.find((c) => c.id === id);
