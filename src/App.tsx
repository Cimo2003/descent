import { Component, lazy, Suspense, type ReactNode, useMemo } from "react";
import { Overlay } from "./ui/Overlay";
import { Hud } from "./ui/Hud";
import { Loader, NoWebGL } from "./ui/Loader";
import { useScrollSystem, SCROLL_VH } from "./lib/useScrollSystem";
import { chapters } from "./data/chapters";

const Scene = lazy(() => import("./scene/Scene").then((m) => ({ default: m.Scene })));

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** If anything in the 3D tree throws, fall back to the readable text version. */
class Guard extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("Scene crashed:", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Experience() {
  useScrollSystem();
  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Overlay />
      <Hud />
      <Loader />
      {/* The tall track the page scrolls through. Progress 0→1 across it drives the camera. */}
      <div id="scroll" style={{ height: `${SCROLL_VH}vh` }} aria-hidden="true" />
    </>
  );
}

export default function App() {
  const webgl = useMemo(hasWebGL, []);
  const fallback = <NoWebGL chapters={[...chapters]} />;
  if (!webgl) return fallback;
  return (
    <Guard fallback={fallback}>
      <Experience />
    </Guard>
  );
}
