import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD } from "../data/cameraPath";
import { env } from "../data/environment";

const vert = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vWp;

  float wave(vec2 p, float t) {
    return sin(p.x * 0.12 + t * 0.9) * 0.62
         + sin(p.y * 0.17 - t * 0.7) * 0.5
         + sin((p.x + p.y) * 0.31 + t * 1.6) * 0.24
         + sin((p.x - p.y) * 0.52 - t * 2.1) * 0.11;
  }

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    w.y += wave(w.xz, uTime) * uAmp;
    vWp = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uHorizon;
  uniform vec3 uUnder;
  varying vec3 vWp;
  #include <fog_pars_fragment>

  void main() {
    vec3 n = normalize(cross(dFdx(vWp), dFdy(vWp))); // faceted, low-poly water
    if (n.y < 0.0) n = -n;
    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(120.0, 480.0, distance(cameraPosition, vWp))));
    vec3 v = normalize(cameraPosition - vWp);
    vec3 col;

    if (gl_FrontFacing) {
      float fres = pow(1.0 - max(dot(n, v), 0.0), 3.5);
      float depthMix = 0.5 + 0.5 * sin(vWp.x * 0.05 + vWp.z * 0.04 + uTime * 0.2);
      vec3 base = mix(uDeep, uShallow, depthMix * 0.55);
      vec3 sky = mix(uHorizon, vec3(0.28, 0.24, 0.45), clamp(n.y * 0.0 + 0.35, 0.0, 1.0));
      vec3 r = reflect(-v, n);
      float spec = pow(max(dot(r, uSunDir), 0.0), 140.0) * 5.0 + pow(max(dot(r, uSunDir), 0.0), 14.0) * 0.45;
      col = mix(base, sky, clamp(fres * 0.95 + 0.12, 0.0, 1.0)) + vec3(1.0, 0.72, 0.45) * spec;
    } else {
      // Seen from below: a bright, rippling ceiling of caustic light.
      float c = sin(vWp.x * 0.33 + uTime * 1.1) * sin(vWp.z * 0.29 - uTime * 0.9)
              + sin((vWp.x + vWp.z) * 0.21 + uTime * 0.7) * 0.6;
      c = pow(abs(c) * 0.75, 0.7);
      col = uUnder * (0.55 + 0.9 * c);
    }

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

const WARM_HORIZON = new THREE.Color("#8f6b98");

function makeUniforms(amp: number) {
  return THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uAmp: { value: amp },
      uSunDir: { value: new THREE.Vector3(-0.32, 0.18, -1).normalize() },
      uDeep: { value: new THREE.Color("#0a3550") },
      uShallow: { value: new THREE.Color("#2b8ea3") },
      uHorizon: { value: new THREE.Color("#8f6b98") },
      uUnder: { value: new THREE.Color("#2fb0c0") },
    },
  ]);
}

/**
 * Water at the waterline: opaque, double-sided, with a different look above and below.
 * A dense wavy near-field plus a huge flat far-field so the horizon never shows an edge.
 */
export function Water() {
  const near = useMemo(() => new THREE.PlaneGeometry(1500, 1500, 200, 200).rotateX(-Math.PI / 2), []);
  const far = useMemo(() => new THREE.PlaneGeometry(20000, 20000, 1, 1).rotateX(-Math.PI / 2), []);
  const uNear = useMemo(() => makeUniforms(1), []);
  const uFar = useMemo(() => makeUniforms(0), []);

  useFrame(({ clock }) => {
    for (const u of [uNear, uFar]) {
      u.uTime.value = clock.elapsedTime;
      u.uHorizon.value.copy(env.underwater ? WARM_HORIZON : env.bottom);
      u.uUnder.value.copy(env.bottom).multiplyScalar(1.6);
    }
  });

  return (
    <>
      <mesh geometry={near} position={[0, WORLD.waterY, 0]} frustumCulled={false}>
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uNear} side={THREE.DoubleSide} fog />
      </mesh>
      <mesh geometry={far} position={[0, WORLD.waterY - 0.6, 0]} frustumCulled={false}>
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uFar} side={THREE.DoubleSide} fog />
      </mesh>
    </>
  );
}
