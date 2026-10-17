import * as THREE from "three";

/** World layout (Y axis is the story axis). */
export const WORLD = {
  cloudTopY: 296,
  cloudLowY: 250,
  waterY: 100,
  seabedY: -80,
  caveTopY: -105,
  caveBottomY: -250,
  coreY: -286,
  caveRadius: 15,
};

const pos: THREE.Vector3[] = [];
const look: THREE.Vector3[] = [];
const add = (p: [number, number, number], l: [number, number, number]) => {
  pos.push(new THREE.Vector3(...p));
  look.push(new THREE.Vector3(...l));
};

/* ── I. Cloudtops — start above the cloud sea, graze the top deck, dive through two layers ── */
add([0, 345, 150], [0, 318, 0]);
add([32, 322, 118], [-12, 292, 0]);
add([-18, 303, 84], [0, 272, 0]);
add([14, 284, 56], [-8, 252, -10]);
add([-6, 266, 46], [4, 236, 0]);
add([22, 248, 44], [0, 218, -4]);
add([30, 226, 42], [0, 196, 0]);
add([31, 207, 36], [0, 176, 0]);

/* ── II. The sunken city — a slow spiral down around the spire ── */
for (let i = 0; i < 10; i++) {
  const a = 0.9 + i * 0.75;
  const y = 192 - i * 9.6;
  const r = 30 - i * 0.45;
  add(
    [r * Math.cos(a), y, r * Math.sin(a)],
    [46 * Math.cos(a + 0.95), y - 9, 46 * Math.sin(a + 0.95)],
  );
}

/* ── III. Sunlit sea — spiral tightens toward the central sinkhole ── */
for (let j = 0; j < 9; j++) {
  const a = 0.9 + 10 * 0.75 + j * 0.7;
  const y = 90 - j * 20.5;
  const r = 27 - j * 1.9;
  add(
    [r * Math.cos(a), y, r * Math.sin(a)],
    [8 * Math.cos(a + 1.1), y - 20, 8 * Math.sin(a + 1.1)],
  );
}

/* ── IV/V. Bedrock shaft, then the ember ─────────────────────── */
const shaft = [-98, -120, -144, -168, -190, -208, -221, -231, -237];
shaft.forEach((y, k) => {
  const w = k >= shaft.length - 2 ? 1.2 : 3.6;
  add(
    [w * Math.sin(k * 1.35), y, w * Math.cos(k * 1.1)],
    [2 * Math.sin(k * 0.8 + 1), y - 26, 2 * Math.cos(k * 0.9)],
  );
});
look[look.length - 1].set(9, -288, 3);

export const posCurve = new THREE.CatmullRomCurve3(pos, false, "centripetal");
export const lookCurve = new THREE.CatmullRomCurve3(look, false, "centripetal");

const SAMPLES = 4000;
const _p = new THREE.Vector3();

/** First progress value at which the camera drops to `y`. */
export function progressAtY(y: number): number {
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    posCurve.getPoint(t, _p);
    if (_p.y <= y) return t;
  }
  return 1;
}

/** Progress boundaries between chapters, derived from the actual camera path. */
export const chapterBounds = [
  0,
  progressAtY(200),
  progressAtY(WORLD.waterY),
  progressAtY(WORLD.seabedY - 6),
  progressAtY(-212),
  1,
];

export function sampleCamera(t: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const c = Math.min(Math.max(t, 0), 1);
  posCurve.getPoint(c, outPos);
  lookCurve.getPoint(c, outLook);
}
