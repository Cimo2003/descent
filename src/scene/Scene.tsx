import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { CameraRig } from "./CameraRig";
import { Atmosphere } from "./Atmosphere";
import { Particles } from "./Particles";
import { Clouds } from "./Clouds";
import { City } from "./City";
import { Water } from "./Water";
import { Fish, Whale, LightShafts, Jellyfish } from "./Sea";
import { Seabed } from "./Seabed";
import { Cave } from "./Cave";
import { Core } from "./Core";
import { useUI } from "../store";
import { isMobile, reducedMotion } from "../lib/scrollState";

/** The fixed, full-screen canvas that sits behind all the HTML. */
export function Scene() {
  const [dpr, setDpr] = useState(isMobile ? 1.25 : 1.5);
  const quality = useUI((s) => s.quality);
  const setReady = useUI((s) => s.setReady);
  const setQuality = useUI((s) => s.setQuality);

  return (
    <Canvas
      className="stage"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      camera={{ fov: 55, near: 0.5, far: 2500, position: [0, 330, 150] }}
      onCreated={() => {
        // first frames compile shaders; give them a moment before revealing
        setTimeout(setReady, 700);
      }}
    >
      {/* Drop resolution (then effects) automatically if the device can't hold framerate. */}
      <PerformanceMonitor
        onDecline={() => {
          setDpr((d) => Math.max(0.85, d - 0.25));
          if (quality > 0) setQuality((quality - 1) as 0 | 1 | 2);
        }}
        onIncline={() => setDpr((d) => Math.min(isMobile ? 1.25 : 1.5, d + 0.25))}
      />

      <CameraRig />
      <Atmosphere />
      <Particles />

      <Clouds />
      <City />
      <Water />
      <LightShafts />
      <Fish />
      <Whale />
      <Seabed />
      <Jellyfish />
      <Cave />
      <Core />

      <EffectComposer multisampling={quality >= 2 && !isMobile ? 4 : 0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={quality > 0 ? 0.95 : 0.6} luminanceThreshold={0.82} luminanceSmoothing={0.25} />
        <Vignette eskil={false} offset={0.28} darkness={0.62} />
        {quality >= 2 && !reducedMotion ? <Noise opacity={0.035} /> : <></>}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
