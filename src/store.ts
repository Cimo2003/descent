import { create } from "zustand";

interface UI {
  chapter: number;
  ready: boolean;
  quality: 0 | 1 | 2; // 0 = low, 1 = medium, 2 = high
  setChapter: (c: number) => void;
  setReady: () => void;
  setQuality: (q: 0 | 1 | 2) => void;
}

export const useUI = create<UI>((set) => ({
  chapter: 0,
  ready: false,
  quality: 2,
  setChapter: (chapter) => set({ chapter }),
  setReady: () => set({ ready: true }),
  setQuality: (quality) => set({ quality }),
}));
