import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../lib/noise";
import { isMobile, scroll } from "../lib/scrollState";
import { WORLD, sampleCamera } from "../data/cameraPath";

/* ─────────────────────────── Fish schools ─────────────────────────── */

export function Fish() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const count = isMobile ? 170 : 380;

  const { schools, fish, geometry } = useMemo(() => {
    const rnd = mulberry32(99);
    const nSchools = 12;
    const schools = Array.from({ length: nSchools }, (_, i) => ({
      r: 36 + rnd() * 80,
      y: -55 + rnd() * 135,
      speed: (0.05 + rnd() * 0.06) * (rnd() < 0.5 ? 1 : -1),
      phase: rnd() * Math.PI * 2,
      color: i % 4 === 0 ? new THREE.Color("#ffb54a") : new THREE.Color("#b8e4f2"),
    }));
    const fish = Array.from({ length: count }, (_, i) => ({
      s: i % nSchools,
      off: new THREE.Vector3((rnd() - 0.5) * 16, (rnd() - 0.5) * 9, (rnd() - 0.5) * 16),
      ph: rnd() * 10,
    }));
    const geometry = new THREE.OctahedronGeometry(1, 0).scale(0.34, 0.62, 2.3);
    return { schools, fish, geometry };
  }, [count]);

  useLayoutEffect(() => {
    fish.forEach((f, i) => mesh.current.setColorAt(i, schools[f.s].color));
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [fish, schools]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pos = (s: (typeof schools)[number], f: (typeof fish)[number], t: number, da: number, out: THREE.Vector3) => {
    const a = s.phase + t * s.speed + da;
    return out.set(
      Math.cos(a) * s.r + f.off.x + Math.sin(t * 1.1 + f.ph) * 1.4,
      s.y + Math.sin(t * 0.3 + s.phase) * 6 + f.off.y,
      Math.sin(a) * s.r + f.off.z,
    );
  };
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const y = scroll.camY;
    mesh.current.visible = y < 125 && y > -100;
    if (!mesh.current.visible) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      const s = schools[f.s];
      pos(s, f, t, 0, a);
      pos(s, f, t, Math.sign(s.speed) * 0.04, b);
      dummy.position.copy(a);
      dummy.lookAt(b);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial roughness={0.35} metalness={0.35} emissive="#2e7d93" emissiveIntensity={0.7} />
    </instancedMesh>
  );
}

/* ───────────────────────────── The whale ───────────────────────────── */

/**
 * Hero object of chapter III. It circles a point placed right on the camera's line of sight
 * at mid-ocean, so wherever the viewer lingers, the whale glides through frame.
 */
export function Whale() {
  const group = useRef<THREE.Group>(null!);
  const tail = useRef<THREE.Group>(null!);

  const body = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 28, 18);
    g.scale(4.6, 4.1, 15);
    // belly/back gradient via vertex colours
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const dark = new THREE.Color("#2c4560");
    const light = new THREE.Color("#a9c3d2");
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const k = THREE.MathUtils.smoothstep(pos.getY(i), -1.6, 1.2);
      c.copy(light).lerp(dark, k);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  const anchor = useMemo(() => {
    // find mid-ocean camera sample (y ≈ 30)
    const p = new THREE.Vector3();
    const l = new THREE.Vector3();
    for (let t = 0; t <= 1; t += 0.002) {
      sampleCamera(t, p, l);
      if (p.y < 30) break;
    }
    const dir = l.clone().sub(p).normalize();
    const center = p.clone().addScaledVector(dir, 62);
    const fwd = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    return { center, fwd, right };
  }, []);

  const next = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const y = scroll.camY;
    group.current.visible = y < 118 && y > -30;
    if (!group.current.visible) return;
    const t = clock.elapsedTime;
    const R = 42;
    const a = t * 0.075;
    const at = (aa: number, out: THREE.Vector3) =>
      out
        .copy(anchor.center)
        .addScaledVector(anchor.right, Math.cos(aa) * R)
        .addScaledVector(anchor.fwd, Math.sin(aa) * R)
        .setY(anchor.center.y + Math.sin(aa * 2) * 5);
    at(a, group.current.position);
    at(a + 0.05, next);
    group.current.lookAt(next);
    group.current.rotateZ(Math.sin(t * 0.5) * 0.08);
    tail.current.rotation.x = Math.sin(t * 1.1) * 0.22;
  });

  return (
    <group ref={group}>
      <mesh geometry={body}>
        <meshStandardMaterial vertexColors roughness={0.7} metalness={0.05} flatShading={false} />
      </mesh>
      {/* flippers */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 4.2, -2.2, 4]} rotation={[0.3, 0, s * 0.8]} scale={[1, 0.12, 0.45]}>
          <sphereGeometry args={[4.2, 14, 8]} />
          <meshStandardMaterial color="#35506b" roughness={0.7} />
        </mesh>
      ))}
      {/* tail stock + flukes */}
      <group ref={tail} position={[0, 0, -13]}>
        <mesh position={[0, 0, -6]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[3.0, 14, 12]} />
          <meshStandardMaterial color="#2c4560" roughness={0.7} />
        </mesh>
        <group position={[0, 0.4, -13]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 4.4, 0, -0.6]} rotation={[0, s * 0.45, 0]} scale={[1, 0.1, 0.38]}>
              <sphereGeometry args={[5.2, 14, 8]} />
              <meshStandardMaterial color="#2c4560" roughness={0.7} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/* ───────────────────────────── Light shafts ───────────────────────────── */

export function LightShafts() {
  const group = useRef<THREE.Group>(null!);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);

  const shafts = useMemo(() => {
    const rnd = mulberry32(31);
    const n = isMobile ? 8 : 16;
    return Array.from({ length: n }, () => {
      const ang = rnd() * Math.PI * 2;
      const r = 12 + rnd() * 120;
      return {
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        w: 3 + rnd() * 7,
        h: 110 + rnd() * 50,
        tilt: 0.18 + rnd() * 0.1,
        spin: rnd() * 6,
        phase: rnd() * 10,
      };
    });
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 0.18, 1, 14, 1, true).translate(0, -0.5, 0);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = THREE.MathUtils.clamp(1 + pos.getY(i), 0, 1); // 1 at top → 0 at bottom
      const v = Math.pow(k, 1.6);
      col.set([v, v, v], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  useFrame(({ clock }) => {
    const y = scroll.camY;
    group.current.visible = y < 106 && y > -35;
    if (!group.current.visible) return;
    const fade = THREE.MathUtils.clamp((y + 35) / 70, 0, 1);
    mats.current.forEach((m, i) => {
      m.opacity = 0.085 * fade * (0.7 + 0.3 * Math.sin(clock.elapsedTime * 0.6 + shafts[i].phase));
    });
  });

  return (
    <group ref={group}>
      {shafts.map((s, i) => (
        <mesh
          key={i}
          geometry={geometry}
          position={[s.x, WORLD.waterY + 2, s.z]}
          rotation={[0.1, s.spin, -s.tilt]}
          scale={[s.w, s.h, s.w]}
          frustumCulled={false}
        >
          <meshBasicMaterial
            ref={(m) => {
              if (m) mats.current[i] = m;
            }}
            color="#c9fbff"
            vertexColors
            transparent
            opacity={0.14}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ───────────────────────────── Jellyfish ───────────────────────────── */

export function Jellyfish() {
  const bell = useRef<THREE.InstancedMesh>(null!);
  const skirt = useRef<THREE.InstancedMesh>(null!);
  const count = isMobile ? 10 : 20;

  const data = useMemo(() => {
    const rnd = mulberry32(404);
    const palette = ["#46f0ff", "#ff5ad1", "#9a7bff", "#5affb8"].map((c) => new THREE.Color(c));
    return Array.from({ length: count }, (_, i) => {
      const ang = rnd() * Math.PI * 2;
      const r = 14 + rnd() * 34;
      return {
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        y: -48 - rnd() * 52,
        s: 1.2 + rnd() * 2.0,
        ph: rnd() * 10,
        c: palette[i % palette.length].clone().multiplyScalar(2.2),
      };
    });
  }, [count]);

  const bellGeo = useMemo(() => new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const skirtGeo = useMemo(() => new THREE.ConeGeometry(0.85, 4.2, 14, 1, true).rotateX(Math.PI).translate(0, -2.1, 0), []);

  useLayoutEffect(() => {
    data.forEach((d, i) => {
      bell.current.setColorAt(i, d.c);
      skirt.current.setColorAt(i, d.c);
    });
    [bell.current, skirt.current].forEach((m) => {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }, [data]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const y = scroll.camY;
    const vis = y < -20 && y > -125;
    bell.current.visible = skirt.current.visible = vis;
    if (!vis) return;
    const t = clock.elapsedTime;
    data.forEach((d, i) => {
      const pulse = Math.sin(t * 1.6 + d.ph);
      const bob = Math.sin(t * 0.4 + d.ph) * 3 + t * 0 ;
      dummy.position.set(d.x + Math.sin(t * 0.2 + d.ph) * 2, d.y + bob, d.z);
      dummy.rotation.set(Math.sin(t * 0.3 + d.ph) * 0.12, t * 0.1, 0);
      dummy.scale.set(d.s * (1 + pulse * 0.1), d.s * (0.7 - pulse * 0.1), d.s * (1 + pulse * 0.1));
      dummy.updateMatrix();
      bell.current.setMatrixAt(i, dummy.matrix);
      dummy.scale.set(d.s * (1 - pulse * 0.08), d.s * (1 + pulse * 0.2), d.s * (1 - pulse * 0.08));
      dummy.updateMatrix();
      skirt.current.setMatrixAt(i, dummy.matrix);
    });
    bell.current.instanceMatrix.needsUpdate = true;
    skirt.current.instanceMatrix.needsUpdate = true;
  });

  const mat = (opacity: number) => (
    <meshBasicMaterial
      transparent
      opacity={opacity}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      side={THREE.DoubleSide}
      toneMapped={false}
    />
  );

  return (
    <>
      <instancedMesh ref={bell} args={[bellGeo, undefined, count]} frustumCulled={false}>
        {mat(0.55)}
      </instancedMesh>
      <instancedMesh ref={skirt} args={[skirtGeo, undefined, count]} frustumCulled={false}>
        {mat(0.035)}
      </instancedMesh>
    </>
  );
}
