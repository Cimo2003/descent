import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../lib/noise";
import { isMobile, scroll } from "../lib/scrollState";
import { WORLD } from "../data/cameraPath";

const vert = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vWorld;
  varying vec3 vN;
  void main() {
    vPos = position;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  varying vec3 vPos;
  varying vec3 vWorld;
  varying vec3 vN;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { s += noise(p) * a; p = p * 2.03 + 11.7; a *= 0.5; }
    return s;
  }

  void main() {
    vec3 p = normalize(vPos) * 2.4;
    float n = fbm(p + vec3(0.0, uTime * 0.1, 0.0));
    float n2 = fbm(p * 2.1 - vec3(uTime * 0.07, 0.0, uTime * 0.05));
    float v = n * 0.75 + n2 * 0.5;

    float vein = pow(1.0 - abs(n - 0.5) * 2.0, 7.0);
    vec3 crust = vec3(0.16, 0.015, 0.0);
    vec3 lava = vec3(1.0, 0.33, 0.04);
    vec3 col = mix(crust, lava, smoothstep(0.34, 0.78, v));
    col += vec3(1.0, 0.62, 0.2) * vein * 1.25;

    vec3 view = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(normalize(vN), view), 0.0), 2.2);
    col += vec3(1.0, 0.3, 0.05) * fres * 1.1;

    gl_FragColor = vec4(col * 1.05, 1.0);
  }
`;

function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,170,70,1)");
  grad.addColorStop(0.25, "rgba(255,110,30,0.55)");
  grad.addColorStop(0.6, "rgba(200,50,10,0.16)");
  grad.addColorStop(1, "rgba(120,20,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Chapter V — the ember: a molten orb, its halo, a light, and rock debris in slow orbit. */
export function Core() {
  const group = useRef<THREE.Group>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const orbit = useRef<THREE.InstancedMesh>(null!);
  const uTime = useMemo(() => ({ value: 0 }), []);
  const halo = useMemo(() => haloTexture(), []);

  const debris = useMemo(() => {
    const rnd = mulberry32(8);
    const n = isMobile ? 26 : 56;
    return Array.from({ length: n }, () => ({
      r: 34 + rnd() * 40,
      a: rnd() * Math.PI * 2,
      y: (rnd() - 0.5) * 46,
      s: 1.4 + Math.pow(rnd(), 2) * 6,
      sp: (0.03 + rnd() * 0.06) * (rnd() < 0.5 ? -1 : 1),
      rot: rnd() * 5,
    }));
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const y = scroll.camY;
    group.current.visible = y < -150;
    if (!group.current.visible) return;
    const t = clock.elapsedTime;
    uTime.value = t;
    const near = THREE.MathUtils.smoothstep(-y, 150, 235); // 0 far above → 1 at the bottom
    light.current.intensity = 5200 * near * (0.92 + 0.08 * Math.sin(t * 3));
    debris.forEach((d, i) => {
      const a = d.a + t * d.sp;
      dummy.position.set(Math.cos(a) * d.r, WORLD.coreY + d.y, Math.sin(a) * d.r);
      dummy.rotation.set(t * 0.1 + d.rot, t * 0.07 * d.rot, 0);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      orbit.current.setMatrixAt(i, dummy.matrix);
    });
    orbit.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <mesh position={[0, WORLD.coreY, 0]}>
        <sphereGeometry args={[20, 64, 48]} />
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={{ uTime }} fog={false} />
      </mesh>
      <sprite position={[0, WORLD.coreY, 0]} scale={[150, 150, 1]} renderOrder={4}>
        <spriteMaterial map={halo} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
      </sprite>
      <pointLight ref={light} position={[0, WORLD.coreY + 6, 0]} color="#ff7a2c" distance={190} decay={1.5} intensity={0} />
      <instancedMesh ref={orbit} args={[undefined, undefined, debris.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#3a1b14" roughness={0.9} flatShading emissive="#ff4a10" emissiveIntensity={0.08} />
      </instancedMesh>
    </group>
  );
}
