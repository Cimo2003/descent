import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../lib/noise";
import { isMobile, scroll } from "../lib/scrollState";
import { WORLD } from "../data/cameraPath";

const PALETTE = ["#2a2542", "#352c4d", "#3f3358", "#4a3a55", "#2d2a4a", "#5a4560", "#33405f"].map(
  (c) => new THREE.Color(c),
);

/** Chapter II — a drowned skyline. Windows are procedural (shader), so 600 towers = one draw call. */
export function City() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const group = useRef<THREE.Group>(null!);
  const beacon = useRef<THREE.Mesh>(null!);
  const timeU = useMemo(() => ({ value: 0 }), []);

  const boxes = useMemo(() => {
    const rnd = mulberry32(5);
    const out: { x: number; y: number; z: number; w: number; h: number; d: number; c: THREE.Color }[] = [];
    const cell = isMobile ? 17 : 13;
    const N = Math.ceil(240 / cell);
    const baseY = WORLD.waterY - 42; // towers continue beneath the surface
    for (let gx = -N; gx <= N; gx++) {
      for (let gz = -N; gz <= N; gz++) {
        const x = gx * cell + (rnd() - 0.5) * 4;
        const z = gz * cell + (rnd() - 0.5) * 4;
        const r = Math.hypot(x, z);
        if (r < 40 || r > 240 || rnd() < 0.22) continue;
        const w = 6 + rnd() * 5;
        const d = 6 + rnd() * 5;
        const h = 10 + Math.pow(rnd(), 2.0) * 68 * (1 - 0.5 * (r / 240));
        const c = PALETTE[Math.floor(rnd() * PALETTE.length)];
        out.push({ x, y: baseY, z, w, h: h + 42, d, c });
        if (h > 38) {
          // setback crown
          out.push({ x, y: WORLD.waterY + h, z, w: w * 0.62, h: h * 0.28, d: d * 0.62, c });
        }
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    boxes.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
      mesh.current.setMatrixAt(i, m);
      mesh.current.setColorAt(i, b.c);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [boxes]);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);

  const onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = timeU;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;")
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        mat4 wm = modelMatrix;
        #ifdef USE_INSTANCING
          wm = modelMatrix * instanceMatrix;
        #endif
        vWp = (wm * vec4(transformed, 1.0)).xyz;
        vWn = normalize(mat3(wm) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;\nuniform float uTime;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        {
          vec3 an = abs(vWn);
          if (an.y < 0.5) {
            float u = an.x > 0.5 ? vWp.z : vWp.x;
            vec2 g = vec2(u / 2.4, vWp.y / 3.2);
            vec2 f = fract(g);
            vec2 id = floor(g);
            float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.75);
            vec2 bid = floor(vWp.xz * 0.08) * 7.0;
            float hsh = fract(sin(dot(id + bid, vec2(12.9898, 78.233))) * 43758.5453);
            float lit = step(0.5, hsh);
            float flick = 0.8 + 0.2 * sin(uTime * (0.3 + hsh) + hsh * 40.0);
            vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(0.55, 0.85, 1.0), step(0.9, hsh));
            float above = mix(0.35, 1.0, smoothstep(96.0, 104.0, vWp.y));
            totalEmissiveRadiance += warm * win * lit * 2.1 * flick * above;
            diffuseColor.rgb *= 1.0 - win * 0.45;
          }
        }`,
      );
  };

  useFrame(({ clock }) => {
    timeU.value = clock.elapsedTime;
    const y = scroll.camY;
    group.current.visible = y > -5;
    if (beacon.current) {
      const s = 0.65 + 0.35 * Math.sin(clock.elapsedTime * 2.2);
      (beacon.current.material as THREE.MeshBasicMaterial).color.setRGB(3.2 * s + 0.4, 0.25 * s, 0.2 * s);
    }
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[geometry, undefined, boxes.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.72} metalness={0.12} onBeforeCompile={onBeforeCompile} />
      </instancedMesh>

      {/* The spire the camera spirals around */}
      <group>
        <mesh position={[0, 55 + 70, 0]}>
          <cylinderGeometry args={[1.7, 5.6, 140, 8]} />
          <meshStandardMaterial color="#5b4670" roughness={0.38} metalness={0.55} flatShading />
        </mesh>
        {[128, 150, 170].map((y, i) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[7.2 - i * 1.7, 0.28, 8, 56]} />
            <meshBasicMaterial color={new THREE.Color(3.2, 1.9, 0.8)} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 197, 0]}>
          <cylinderGeometry args={[0.1, 0.6, 5, 6]} />
          <meshStandardMaterial color="#8d7aa8" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh ref={beacon} position={[0, 200.2, 0]}>
          <sphereGeometry args={[1.05, 12, 10]} />
          <meshBasicMaterial color="#ff3a2a" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
