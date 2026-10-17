import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32, noise3 } from "../lib/noise";
import { isMobile, scroll } from "../lib/scrollState";
import { WORLD } from "../data/cameraPath";

/**
 * Chapter I — two decks of cloud built from many small overlapping puffs (instanced), lit warm
 * on top and bruised violet underneath. Many small puffs read as cauliflower-soft; a few big ones
 * read as pebbles.
 */
export function Clouds() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const group = useRef<THREE.Group>(null!);

  const puffs = useMemo(() => {
    const rnd = mulberry32(21);
    const out: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const top = new THREE.Color("#ffe3cc");
    const bottom = new THREE.Color("#9d7396");
    const nClouds = isMobile ? 44 : 78;

    for (let i = 0; i < nClouds; i++) {
      const nearAxis = i < 9; // a handful sit on the flight path so we really pass *through* cloud
      const deck = rnd() < 0.55 ? WORLD.cloudTopY : WORLD.cloudLowY;
      const ang = rnd() * Math.PI * 2;
      const rad = nearAxis ? 10 + rnd() * 40 : 50 + Math.sqrt(rnd()) * 430;
      const cx = Math.cos(ang) * rad;
      const cz = Math.sin(ang) * rad;
      const cy = nearAxis ? WORLD.cloudLowY + rnd() * 52 : deck + (rnd() - 0.5) * 20;
      const size = 22 + rnd() * 36;
      const n = isMobile ? 18 : 28;

      for (let k = 0; k < n; k++) {
        // gaussian-ish scatter, flattened vertically
        const gx = (rnd() + rnd() + rnd() - 1.5) * size;
        const gz = (rnd() + rnd() + rnd() - 1.5) * size * 0.85;
        const edge = Math.hypot(gx, gz) / (size * 1.1);
        const rr = size * (0.15 + rnd() * 0.2) * (1.05 - Math.min(edge, 0.9) * 0.55);
        const gy = (rnd() - 0.35) * size * 0.28 * (1 - Math.min(edge, 1) * 0.6) + rr * 0.15;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(cx + gx, cy + gy, cz + gz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)),
          new THREE.Vector3(rr * 1.2, rr * 0.78, rr * 1.1),
        );
        const shade = THREE.MathUtils.clamp(0.5 + (gy / (size * 0.28)) * 0.5 + (rnd() - 0.5) * 0.25, 0, 1);
        out.push({ m, c: bottom.clone().lerp(top, shade) });
      }
    }
    return out;
  }, []);

  // A lumpy sphere: displaced, welded and re-smoothed so each puff looks like a cauliflower floret.
  const geometry = useMemo(() => {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, isMobile ? 1 : 2);
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    g = mergeVertices(g);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = noise3(v.x * 2.4 + 5, v.y * 2.4, v.z * 2.4) * 0.65 + noise3(v.x * 5.5, v.y * 5.5 + 9, v.z * 5.5) * 0.35;
      v.multiplyScalar(0.8 + n * 0.45);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  // Screen-door dissolve when a puff is very close to the lens: you drift *into* cloud
  // instead of colliding with a wall of low-poly surface.
  const onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nfloat bayer4(vec2 p){ p=floor(mod(p,4.0)); return (mod(p.x*4.0+p.y*2.0+mod(p.x*p.y,2.0)*5.0, 16.0)+0.5)/16.0; }",
      )
      .replace(
        "void main() {",
        "void main() {\n  float nearFade = smoothstep(10.0, 46.0, length(vViewPosition));\n  if (nearFade < bayer4(gl_FragCoord.xy)) discard;",
      );
  };

  useLayoutEffect(() => {
    puffs.forEach((p, i) => {
      mesh.current.setMatrixAt(i, p.m);
      mesh.current.setColorAt(i, p.c);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [puffs]);

  useFrame((_, dt) => {
    // Cull the whole deck once we're far below it.
    group.current.visible = scroll.camY > 170;
    group.current.rotation.y += dt * 0.004;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, puffs.length]} frustumCulled={false}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial
          roughness={1}
          metalness={0}
          emissive="#c98a86"
          emissiveIntensity={0.34}
          onBeforeCompile={onBeforeCompile}
        />
      </instancedMesh>
    </group>
  );
}
