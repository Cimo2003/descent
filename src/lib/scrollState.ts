/**
 * Mutable, non-reactive scroll state shared between the DOM (GSAP/Lenis) and the
 * render loop (R3F useFrame). Kept outside React so scrolling never triggers re-renders.
 */
export const scroll = {
  /** raw progress 0..1 from ScrollTrigger */
  target: 0,
  /** damped progress 0..1 that actually drives the camera */
  smooth: 0,
  /** damped progress velocity (per second), used for the FOV "speed kick" */
  velocity: 0,
  /** current camera world Y, written by the camera rig */
  camY: 330,
  /** pointer in -1..1, damped (used for camera parallax) */
  px: 0,
  py: 0,
};

/** raw pointer position in -1..1 */
export const pointer = { x: 0, y: 0 };

export const reducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const isMobile =
  typeof window !== "undefined" &&
  (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760);
