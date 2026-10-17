import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { fbm3, mulberry32, smoothstep } from "../lib/noise";
import { isMobile, scroll } from "../lib/scrollState";
import { WORLD } from "../data/cameraPath";

const HOLE_R = 14;
const OUTER_R = 560;

/** Terrain height at (x,z): rolling sea floor with a funnel-shaped sinkhole at the origin. */
export function seabedHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const rolling = (fbm3(x * 0.018, 0, z * 0.018, 4) - 0.5) * 22 * smoothstep(18, 90, r);
  const dunes = Math.sin(x * 0.08 + fbm3(x * 0.03, 3, z * 0.03) * 6) * 1.4;
  const funnel = 25 * (1 - smoothstep(HOLE_R, 78, r));
  return WORLD.seabedY + rolling + dunes * smoothstep(20, 60, r) - funnel;
}

/** Chapter IV (top) — sea floor, the sinkhole, boulders and swaying kelp. */
export function Seabed() {
  const group = useRef<THREE.Group>(null!);
  const rocks = useRef<THREE.InstancedMesh>(null!);
  const kelp = useRef<THREE.InstancedMesh>(null!);
  const timeU = useMemo(() => ({ value: 0 }), []);

  const terrain = useMemo(() => {
    const rings = isMobile ? 70 : 110;
    const segs = isMobile ? 96 : 150;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const sand = new THREE.Color("#6f8f95");
    const dark = new THREE.Color("#233347");
    const pit = new THREE.Color("#2a1f3a");
    const c = new THREE.Color();
    for (let i = 0; i <= rings; i++) {
      const u = i / rings;
      const r = HOLE_R + (OUTER_R - HOLE_R) * Math.pow(u, 2.4);
      for (let j = 0; j <= segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const y = seabedHeight(x, z);
        pos.push(x, y, z);
        const n = fbm3(x * 0.05, 1, z * 0.05, 3);
        c.copy(sand).lerp(dark, THREE.MathUtils.clamp(0.25 + n * 0.8 - r / 900, 0, 1));
        c.lerp(pit, 1 - smoothstep(HOLE_R, 60, r));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * (segs + 1) + j;
        const b = a + segs + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);

  const { rockData, kelpData } = useMemo(() => {
    const rnd = mulberry32(77);
    const rockData: THREE.Matrix4[] = [];
    const nRocks = isMobile ? 90 : 190;
    for (let i = 0; i < nRocks; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 24 + Math.pow(rnd(), 1.6) * 260;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const s = 1.2 + Math.pow(rnd(), 2.5) * 11;
      rockData.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, seabedHeight(x, z) + s * 0.25, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 6, rnd() * 3)),
          new THREE.Vector3(s * (0.8 + rnd() * 0.6), s * (0.6 + rnd() * 0.5), s * (0.8 + rnd() * 0.6)),
        ),
      );
    }
    const kelpData: THREE.Matrix4[] = [];
    const nKelp = isMobile ? 90 : 220;
    for (let i = 0; i < nKelp; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 26 + Math.pow(rnd(), 1.3) * 150;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = 14 + rnd() * 26;
      kelpData.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, seabedHeight(x, z) - 1, z),
          new THREE.Quaternion(),
          new THREE.Vector3(0.55 + rnd() * 0.4, h, 0.55 + rnd() * 0.4),
        ),
      );
    }
    return { rockData, kelpData };
  }, []);

  useLayoutEffect(() => {
    const tint = new THREE.Color();
    rockData.forEach((m, i) => {
      rocks.current.setMatrixAt(i, m);
      tint.set("#33475a").multiplyScalar(0.7 + ((i * 37) % 10) / 20);
      rocks.current.setColorAt(i, tint);
    });
    kelpData.forEach((m, i) => {
      kelp.current.setMatrixAt(i, m);
      tint.set("#2f9a78").offsetHSL(((i * 13) % 10) / 150 - 0.03, 0, ((i * 7) % 10) / 80 - 0.04);
      kelp.current.setColorAt(i, tint);
    });
    for (const m of [rocks.current, kelp.current]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [rockData, kelpData]);

  const kelpGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1, 1, 10, 1).translate(0, 0.5, 0), []);

  const kelpCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = timeU;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        float sx = length(instanceMatrix[0].xyz);
        float sz = length(instanceMatrix[2].xyz);
        float hgt = position.y;
        transformed.x += sin(uTime * 1.1 + instanceMatrix[3].x * 0.37 + hgt * 3.2) * 2.4 * hgt * hgt / sx;
        transformed.z += cos(uTime * 0.9 + instanceMatrix[3].z * 0.41 + hgt * 2.6) * 2.4 * hgt * hgt / sz;`,
      );
  };

  useFrame(({ clock }) => {
    timeU.value = clock.elapsedTime;
    group.current.visible = scroll.camY < 40;
  });

  return (
    <group ref={group}>
      <mesh geometry={terrain}>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading />
      </mesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, rockData.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={kelp} args={[kelpGeo, undefined, kelpData.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.8} emissive="#0d4b3c" emissiveIntensity={0.5} onBeforeCompile={kelpCompile} />
      </instancedMesh>
    </group>
  );
}
