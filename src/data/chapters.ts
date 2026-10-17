import { chapterBounds } from "./cameraPath";

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
  line: string;
  body: string;
  /** bright UI colour for this stratum (ruler band, flag, accents) */
  tone: string;
  side: "left" | "right";
  range: [number, number];
}

const copy = [
  {
    id: "cloudtops",
    tone: "#ffd0b8",
    numeral: "I",
    title: "Cloudtops",
    line: "Above the weather",
    body: "Dusk is still falling. The clouds lie like a second ground: soft, endless, and about to give way.",
    side: "left",
  },
  {
    id: "city",
    tone: "#d7b4ff",
    numeral: "II",
    title: "The Sunken City",
    line: "Towers standing in water",
    body: "Someone built this to touch the sky. The tide had other plans. Every window still remembers its light.",
    side: "right",
  },
  {
    id: "sea",
    tone: "#8ff3ff",
    numeral: "III",
    title: "The Sunlit Sea",
    line: "Light, but borrowed",
    body: "The surface closes overhead. Silver schools turn as one, and something vast moves just out of sight.",
    side: "left",
  },
  {
    id: "bedrock",
    tone: "#ff9ec4",
    numeral: "IV",
    title: "Bedrock",
    line: "Through the floor",
    body: "The seabed opens like a throat. Crystals lean toward whatever light there is, and every layer is older than the last.",
    side: "right",
  },
  {
    id: "ember",
    tone: "#ffb23d",
    numeral: "V",
    title: "The Ember",
    line: "The warm center",
    body: "At the bottom of everything, something is still burning. It has been waiting longer than the sea has had a name.",
    side: "left",
  },
] as const;

export const chapters: Chapter[] = copy.map((c, i) => ({
  ...c,
  range: [chapterBounds[i], chapterBounds[i + 1]],
}));

export function chapterAt(progress: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (progress >= chapters[i].range[0]) return i;
  }
  return 0;
}
