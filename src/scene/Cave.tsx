import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm3, mulberry32, smoothstep } from "../lib/noise";
import { isMobile, scroll } from "../lib/scrollState";
import { WORLD } from "../data/cameraPath";

const TOP = WORLD.caveTopY;
const BOTTOM = WORLD.caveBottomY;

/** Radius of the shaft wall at height y, angle a. Shared by the wall mesh and the crystal placer. */
export function caveRadius(y: number, a: number): number {
  const cx = Math.cos(a);
  const sz = Math.sin(a);
  const n = fbm3(cx * 1.4 + 3, y * 0.045, sz * 1.4, 4) - 0.5;
  const ribs = Math.sin(y * 0.45 + n * 9) * 0.55;
  const topBlend = smoothstep(TOP, TOP - 14, y); // 0 at the funnel lip → 1 inside the shaft
  const mouth = 1 - topBlend;
  return WORLD.caveRadius + n * 9 * topBlend + ribs * topBlend - mouth * 0.9;
}

const STRATA = ["#2b2038", "#46304a", "#3a2a52", "#5d3540", "#7a3f34", "#4a2a2c"].map((c) => new THREE.Color(c));

/** Chapter IV (bottom) — a faceted, banded shaft of rock studded with glowing crystal clusters. */
export function Cave() {
  const group = useRef<THREE.Group>(null!);
  const crystals = useRef<THREE.InstancedMesh>(null!);

  const wall = useMemo(() => {
    const hs = isMobile ? 90 : 150;
    const rs = isMobile ? 40 : 64;
    const g = new THREE.CylinderGeometry(1, 1, TOP - BOTTOM, rs, hs, true);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const mid = (TOP + BOTTOM) / 2;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + mid;
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      const r = caveRadius(y, a);
      pos.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);

      const n = fbm3(Math.cos(a) * 2, y * 0.03, Math.sin(a) * 2, 3);
      const band = (Math.sin(y * 0.16 + n * 7) * 0.5 + 0.5) * (STRATA.length - 1.001);
      const i0 = Math.floor(band);
      c.copy(STRATA[i0]).lerp(STRATA[i0 + 1], band - i0);
      // hotter the deeper we go
      c.lerp(HOT, smoothstep(-190, -250, y) * 0.35);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  const crystalData = useMemo(() => {
    const rnd = mulberry32(1337);
    const palette = ["#3fe0ff", "#ff4fd0", "#ffb347", "#8f7bff", "#46ffb0"].map((c) => new THREE.Color(c));
    const out: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const clusters = isMobile ? 38 : 80;
    const up = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < clusters; k++) {
      const y = TOP - 8 - rnd() * (TOP - BOTTOM - 22);
      const a = rnd() * Math.PI * 2;
      const hue = palette[Math.floor(rnd() * palette.length)];
      const n = 3 + Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) {
        const yy = y + (rnd() - 0.5) * 5;
        const aa = a + (rnd() - 0.5) * 0.35;
        const r = caveRadius(yy, aa) - 0.6;
        const p = new THREE.Vector3(Math.cos(aa) * r, yy, Math.sin(aa) * r);
        const inward = new THREE.Vector3(-Math.cos(aa), 0, -Math.sin(aa));
        inward.add(new THREE.Vector3((rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.9, (rnd() - 0.5) * 0.7)).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(up, inward);
        const h = 1.1 + rnd() * rnd() * 4.2;
        const w = 0.32 + rnd() * 0.5;
        out.push({
          m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(w, h, w)),
          c: hue.clone().multiplyScalar(0.55 + rnd() * 0.5),
        });
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    crystalData.forEach((d, i) => {
      crystals.current.setMatrixAt(i, d.m);
      crystals.current.setColorAt(i, d.c);
    });
    crystals.current.instanceMatrix.needsUpdate = true;
    if (crystals.current.instanceColor) crystals.current.instanceColor.needsUpdate = true;
  }, [crystalData]);

  const crystalGeo = useMemo(
    () =>
      mergeGeometries([
        new THREE.CylinderGeometry(0.5, 0.5, 0.62, 6, 1, true).translate(0, 0.31, 0),
        new THREE.ConeGeometry(0.5, 0.42, 6, 1).translate(0, 0.83, 0),
      ])!,
    [],
  );

  const crystalCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    // Make the instance colour glow (self-lit) so bloom picks the crystals up.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
       totalEmissiveRadiance += vColor.rgb * 1.15;`,
    );
  };

  useFrame(() => {
    group.current.visible = scroll.camY < -80;
  });

  return (
    <group ref={group}>
      <mesh geometry={wall}>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0.05} flatShading side={THREE.BackSide} />
      </mesh>
      <instancedMesh ref={crystals} args={[crystalGeo, undefined, crystalData.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.2} metalness={0.2} flatShading onBeforeCompile={crystalCompile} />
      </instancedMesh>
    </group>
  );
}

const HOT = new THREE.Color("#8a2f12");
