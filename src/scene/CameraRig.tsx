import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { scroll, pointer, reducedMotion } from "../lib/scrollState";
import { sampleCamera } from "../data/cameraPath";
import { chapterAt } from "../data/chapters";
import { useUI } from "../store";

const BASE_FOV = 55;

/**
 * The heart of the piece. Scroll progress is damped (never mapped 1:1), then used to
 * sample two Catmull-Rom curves: one for where the camera IS, one for where it LOOKS.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const p = useMemo(() => new THREE.Vector3(), []);
  const l = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const prev = scroll.smooth;
    scroll.smooth = THREE.MathUtils.damp(scroll.smooth, scroll.target, reducedMotion ? 30 : 3.4, d);
    const v = (scroll.smooth - prev) / Math.max(d, 1e-4);
    scroll.velocity = THREE.MathUtils.damp(scroll.velocity, v, 5, d);

    sampleCamera(scroll.smooth, p, l);
    camera.position.copy(p);
    camera.lookAt(l);

    // Pointer parallax — a few degrees of "head turn", cheap and adds a lot of depth.
    if (!reducedMotion) {
      scroll.px = THREE.MathUtils.damp(scroll.px, pointer.x, 3, d);
      scroll.py = THREE.MathUtils.damp(scroll.py, pointer.y, 3, d);
      camera.rotateY(-scroll.px * 0.07);
      camera.rotateX(-scroll.py * 0.04);
      // Speed kick: FOV widens slightly while moving fast.
      const targetFov = BASE_FOV + Math.min(Math.abs(scroll.velocity) * 70, 13);
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, d);
      camera.updateProjectionMatrix();
    }

    scroll.camY = p.y;

    const c = chapterAt(scroll.smooth);
    if (useUI.getState().chapter !== c) useUI.getState().setChapter(c);
  }, -2);

  return null;
}
