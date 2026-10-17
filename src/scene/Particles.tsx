import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isMobile } from "../lib/scrollState";
import { env } from "../data/environment";
import { mulberry32 } from "../lib/noise";

const BOX = 90;

const vert = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aRand;
  uniform float uTime;
  uniform vec3 uCam;
  uniform float uBox;
  uniform float uDrift;
  uniform float uSize;
  uniform float uPx;
  varying float vA;

  void main() {
    vec3 p = aSeed * uBox;
    p.y += uTime * uDrift * (0.4 + aRand);
    p.x += sin(uTime * 0.3 + aRand * 20.0) * 1.6;
    p.z += cos(uTime * 0.27 + aRand * 31.0) * 1.6;
    vec3 rel = mod(p - uCam + 0.5 * uBox, uBox) - 0.5 * uBox;
    vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = length(rel) / (0.5 * uBox);
    vA = (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(1.0, 5.0, -mv.z);
    gl_PointSize = clamp(uSize * uPx * (0.5 + aRand) * 26.0 / max(-mv.z, 0.1), 1.0, 28.0);
  }
`;

const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, a * a * vA * uOpacity);
  }
`;

/**
 * One camera-following particle field that re-skins itself per chapter:
 * golden dust → city embers → plankton → cave motes → rising embers.
 * Particles wrap around the camera in the vertex shader, so a fixed budget covers the whole world.
 */
export function Particles() {
  const count = isMobile ? 700 : 1600;

  const { geometry, uniforms } = useMemo(() => {
    const rnd = mulberry32(7);
    const seed = new Float32Array(count * 3);
    const r = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seed[i * 3] = rnd();
      seed[i * 3 + 1] = rnd();
      seed[i * 3 + 2] = rnd();
      r[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(r, 1));
    return {
      geometry: g,
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uBox: { value: BOX },
        uDrift: { value: 0 },
        uSize: { value: 1 },
        uPx: { value: 1 },
        uColor: { value: new THREE.Color() },
        uOpacity: { value: 0.5 },
      },
    };
  }, [count]);

  useFrame(({ clock, camera, gl }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uCam.value.copy(camera.position);
    uniforms.uPx.value = gl.getPixelRatio();
    uniforms.uDrift.value = env.pDrift;
    uniforms.uSize.value = env.pSize;
    uniforms.uOpacity.value = env.pOpacity;
    uniforms.uColor.value.copy(env.pColor);
  });

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={5}>
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
