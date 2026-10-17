import * as THREE from "three";

/**
 * The look of the world is a function of camera height (Y), not scroll progress.
 * That keeps fog/light locked to the geometry (e.g. the exact moment you cross the
 * waterline) no matter how the camera path is re-tuned.
 */
interface Key {
  y: number;
  bottom: string; // horizon / fog colour
  top: string; // zenith colour
  density: number; // FogExp2
  hemi: number;
  sun: number;
  lamp: number; // camera headlamp
  lampColor: string;
  pColor: string; // ambient particles
  pSize: number;
  pOpacity: number;
  pDrift: number;
  stars: number;
}

const K = (
  y: number,
  bottom: string,
  top: string,
  density: number,
  hemi: number,
  sun: number,
  lamp: number,
  lampColor: string,
  pColor: string,
  pSize: number,
  pOpacity: number,
  pDrift: number,
  stars: number,
): Key => ({ y, bottom, top, density, hemi, sun, lamp, lampColor, pColor, pSize, pOpacity, pDrift, stars });

const KEYS: Key[] = [
  //  y     horizon    zenith     fog     hemi sun lamp lampColor  particle   size  op   drift stars
  K(345, "#ff9f6e", "#1b1f4d", 0.0011, 0.85, 2.4, 0, "#ffffff", "#ffd9a8", 1.2, 0.55, 0.4, 0.9),
  K(316, "#ffa985", "#25265b", 0.0015, 0.85, 2.3, 0, "#ffffff", "#ffd9a8", 1.2, 0.55, 0.4, 0.8),
  K(300, "#dba1a8", "#a77a9e", 0.0055, 0.9, 1.9, 0, "#ffffff", "#ffe6d0", 1.4, 0.4, 0.2, 0.3),
  K(286, "#c293a8", "#c293a8", 0.0098, 0.95, 1.3, 0, "#ffffff", "#ffe6d0", 1.5, 0.35, 0.2, 0),
  K(268, "#c98f9f", "#5a4a85", 0.0045, 0.85, 1.6, 0, "#ffffff", "#ffd2b0", 1.2, 0.5, 0.3, 0.2),
  K(250, "#c293a8", "#c293a8", 0.0098, 0.95, 1.2, 0, "#ffffff", "#ffe6d0", 1.5, 0.35, 0.2, 0),
  K(226, "#c58b9c", "#443a78", 0.0052, 0.85, 1.6, 0, "#ffffff", "#ffd2b0", 1.2, 0.5, 0.3, 0.3),
  K(170, "#b9788f", "#2d2a62", 0.0042, 0.75, 1.5, 0, "#ffffff", "#ffbf90", 1.1, 0.55, 0.5, 0.6),
  K(102, "#8f6b98", "#272a5e", 0.005, 0.7, 1.2, 0, "#ffffff", "#ffbf90", 1.1, 0.5, 0.5, 0.5),
  // ── waterline ──
  K(100.2, "#8f6b98", "#272a5e", 0.005, 0.7, 1.2, 0, "#ffffff", "#ffbf90", 1.1, 0.5, 0.5, 0.5),
  K(99.2, "#3fb2c0", "#3fb2c0", 0.0095, 0.95, 0.8, 0, "#9fe8ff", "#d8fff6", 1.1, 0.55, 0.1, 0),
  K(60, "#1f90ac", "#1f90ac", 0.0115, 0.8, 0.55, 0.3, "#9fe8ff", "#d8fff6", 1.1, 0.55, 0.1, 0),
  K(0, "#0f6385", "#0f6385", 0.0145, 0.6, 0.25, 0.7, "#9fe8ff", "#bff6ff", 1.2, 0.55, 0.1, 0),
  K(-60, "#094262", "#094262", 0.017, 0.5, 0.05, 1.5, "#8fe0ff", "#9fe8ff", 1.3, 0.6, 0.05, 0),
  K(-92, "#0c3354", "#0c3354", 0.02, 0.5, 0, 2.6, "#8fe0ff", "#9fe8ff", 1.3, 0.6, 0.05, 0),
  K(-106, "#1d1232", "#1d1232", 0.03, 0.3, 0, 2.3, "#ffd2a0", "#c9a8ff", 1.2, 0.6, 0.05, 0),
  K(-150, "#261238", "#261238", 0.03, 0.3, 0, 2.4, "#ffd2a0", "#c9a8ff", 1.2, 0.6, 0.1, 0),
  K(-200, "#3a1218", "#3a1218", 0.03, 0.32, 0, 2.2, "#ffc08a", "#ffb27a", 1.3, 0.7, 0.6, 0),
  K(-256, "#5a1c0a", "#5a1c0a", 0.026, 0.4, 0, 1.0, "#ffb070", "#ffb050", 1.5, 0.85, 2.2, 0),
];

export interface Env {
  bottom: THREE.Color;
  top: THREE.Color;
  lampColor: THREE.Color;
  pColor: THREE.Color;
  density: number;
  hemi: number;
  sun: number;
  lamp: number;
  pSize: number;
  pOpacity: number;
  pDrift: number;
  stars: number;
  underwater: boolean;
}

const cache = KEYS.map((k) => ({
  bottom: new THREE.Color(k.bottom),
  top: new THREE.Color(k.top),
  lampColor: new THREE.Color(k.lampColor),
  pColor: new THREE.Color(k.pColor),
}));

export const env: Env = {
  bottom: new THREE.Color(),
  top: new THREE.Color(),
  lampColor: new THREE.Color(),
  pColor: new THREE.Color(),
  density: 0,
  hemi: 0,
  sun: 0,
  lamp: 0,
  pSize: 1,
  pOpacity: 0.5,
  pDrift: 0,
  stars: 0,
  underwater: false,
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Samples the environment at camera height y into the shared `env` object. */
export function sampleEnv(y: number): Env {
  let i = 0;
  while (i < KEYS.length - 2 && y < KEYS[i + 1].y) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (a.y - y) / (a.y - b.y)));
  const ca = cache[i];
  const cb = cache[i + 1];
  env.bottom.copy(ca.bottom).lerp(cb.bottom, t);
  env.top.copy(ca.top).lerp(cb.top, t);
  env.lampColor.copy(ca.lampColor).lerp(cb.lampColor, t);
  env.pColor.copy(ca.pColor).lerp(cb.pColor, t);
  env.density = mix(a.density, b.density, t);
  env.hemi = mix(a.hemi, b.hemi, t);
  env.sun = mix(a.sun, b.sun, t);
  env.lamp = mix(a.lamp, b.lamp, t);
  env.pSize = mix(a.pSize, b.pSize, t);
  env.pOpacity = mix(a.pOpacity, b.pOpacity, t);
  env.pDrift = mix(a.pDrift, b.pDrift, t);
  env.stars = mix(a.stars, b.stars, t);
  env.underwater = y < 100;
  return env;
}
