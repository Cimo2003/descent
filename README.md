# Descent

A scroll-driven 3D journey: golden-hour cloudtops → a drowned city → the sunlit sea → bedrock caves → a molten ember.
Vite + React + TypeScript, React Three Fiber, GSAP ScrollTrigger, Lenis, postprocessing. Everything is procedural: no model or texture downloads.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build into dist/
```

## How it works
- `Lenis → ScrollTrigger → scroll.target` (src/lib/useScrollSystem.ts). The camera never follows scroll 1:1: `CameraRig` damps it into `scroll.smooth`.
- Two Catmull-Rom curves (src/data/cameraPath.ts) define where the camera is and where it looks. Edit the control points to re-route the flight.
- Fog, sky, lights, and particle style are a function of camera **height** (src/data/environment.ts), so they stay locked to the geometry.
- Chapter copy (src/data/chapters.ts) is real DOM text, faded per frame from the same damped value.
- Deep links: `#city`, `#sea`, `#bedrock`, `#ember`.

## Tuning
- Scroll length: `SCROLL_VH` in src/lib/useScrollSystem.ts.
- Quality: `PerformanceMonitor` lowers DPR/effects automatically; counts shrink on mobile (`isMobile`).
- `prefers-reduced-motion`: no inertia scrolling, FOV kick, parallax or film grain.
- No WebGL, or a crash in the 3D tree: falls back to a readable text version.

## Ideas next
Ambient audio per chapter, shader transitions between chapters, KTX2/Draco models in place of procedural ones.
