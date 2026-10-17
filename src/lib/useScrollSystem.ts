import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scroll, pointer, reducedMotion } from "./scrollState";

gsap.registerPlugin(ScrollTrigger);

/** Total height of the scroll track, in viewport heights. */
export const SCROLL_VH = 1000;

let lenis: Lenis | null = null;

/** Smoothly scroll the page so the camera lands on a given progress (0..1). */
export function scrollToProgress(p: number, immediate = false) {
  const range = document.documentElement.scrollHeight - window.innerHeight;
  const y = Math.min(1, Math.max(0, p)) * range;
  if (lenis && !immediate) {
    lenis.scrollTo(y, { duration: 2.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  } else {
    window.scrollTo({ top: y, behavior: "auto" });
  }
}

/**
 * Lenis (inertia) → ScrollTrigger (progress) → shared mutable `scroll.target`.
 * The render loop damps `scroll.target` into `scroll.smooth`, so even a hard
 * trackpad flick turns into a cinematic camera move.
 */
export function useScrollSystem() {
  useEffect(() => {
    lenis = new Lenis({
      lerp: reducedMotion ? 1 : 0.1,
      smoothWheel: !reducedMotion,
      wheelMultiplier: 0.9,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const st = ScrollTrigger.create({
      trigger: "#scroll",
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        scroll.target = self.progress;
      },
    });

    // Restore position on reload / deep link so the camera doesn't fly from the top.
    requestAnimationFrame(() => {
      scroll.target = st.progress;
      scroll.smooth = st.progress;
    });

    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointer);
      st.kill(); // never leak ScrollTriggers
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenis = null;
    };
  }, []);
}
