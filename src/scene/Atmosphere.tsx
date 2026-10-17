import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scroll } from "../lib/scrollState";
import { sampleEnv } from "../data/environment";

const SUN_DIR = new THREE.Vector3(-0.32, 0.045, -1).normalize();
// Light comes from a slightly higher angle than the visible sun disc so surfaces stay readable.
const LIGHT_DIR = new THREE.Vector3(-0.32, 0.38, -1).normalize();

const domeVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w; // always at the far plane
  }
`;

const domeFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform float uStars;
  uniform float uSun;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    float g = pow(smoothstep(-0.12, 0.8, h), 0.65);
    vec3 col = mix(uBottom, uTop, g);

    float sd = max(dot(d, uSunDir), 0.0);
    col += vec3(1.0, 0.55, 0.28) * pow(sd, 5.0) * 0.45 * uSun;
    col += vec3(1.0, 0.7, 0.42) * pow(sd, 60.0) * 0.9 * uSun;
    col += vec3(1.0, 0.86, 0.62) * pow(sd, 1800.0) * 6.0 * uSun;

    // Sparse stars that fade out as we sink away from dusk.
    float s = hash(floor(d * 260.0));
    float star = step(0.9965, s) * smoothstep(0.12, 0.55, h) * uStars;
    col += vec3(0.9, 0.92, 1.0) * star * 0.9;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Sky dome + fog + lights, all driven by the camera's height via `sampleEnv`. */
export function Atmosphere() {
  const fog = useRef<THREE.FogExp2>(null!);
  const bg = useRef<THREE.Color>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const lamp = useRef<THREE.PointLight>(null!);
  const dome = useRef<THREE.Mesh>(null!);
  // The light's target must live in the scene graph for its matrix to update.
  const sunTarget = useMemo(() => new THREE.Object3D(), []);

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSunDir: { value: SUN_DIR },
      uStars: { value: 0 },
      uSun: { value: 1 },
    }),
    [],
  );

  useFrame(({ camera }) => {
    const e = sampleEnv(scroll.camY);

    fog.current.color.copy(e.bottom);
    fog.current.density = e.density;
    bg.current.copy(e.bottom);

    uniforms.uTop.value.copy(e.top);
    uniforms.uBottom.value.copy(e.bottom);
    uniforms.uStars.value = e.stars;
    uniforms.uSun.value = e.underwater ? 0 : THREE.MathUtils.clamp(e.sun / 2.2, 0, 1);
    dome.current.position.copy(camera.position);

    hemi.current.color.copy(e.bottom).lerp(WHITE, 0.35);
    hemi.current.groundColor.copy(e.bottom).multiplyScalar(0.35);
    hemi.current.intensity = e.hemi;

    sun.current.intensity = e.sun;
    sun.current.color.set(e.underwater ? "#a8ecff" : "#ffbf8a");
    sun.current.position.copy(camera.position).addScaledVector(LIGHT_DIR, 100);
    sunTarget.position.copy(camera.position);
    sunTarget.updateMatrixWorld();

    lamp.current.position.copy(camera.position);
    lamp.current.intensity = e.lamp * 420;
    lamp.current.color.copy(e.lampColor);
  }, -1);

  return (
    <>
      <fogExp2 ref={fog} attach="fog" args={["#ff9f6e", 0.001]} />
      <color ref={bg} attach="background" args={["#ff9f6e"]} />

      <mesh ref={dome} frustumCulled={false} renderOrder={-100}>
        <sphereGeometry args={[800, 32, 24]} />
        <shaderMaterial
          vertexShader={domeVert}
          fragmentShader={domeFrag}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={false}
          fog={false}
        />
      </mesh>

      <hemisphereLight ref={hemi} args={["#ffffff", "#333333", 0.8]} />
      <directionalLight ref={sun} target={sunTarget} position={[-30, 40, -100]} intensity={2} />
      <primitive object={sunTarget} />
      <pointLight ref={lamp} distance={90} decay={1.6} intensity={0} />
    </>
  );
}

const WHITE = new THREE.Color("#ffffff");
