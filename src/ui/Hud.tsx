import { useEffect, useMemo, useRef } from "react";
import { chapters } from "../data/chapters";
import { WORLD, progressAtY } from "../data/cameraPath";
import { scroll } from "../lib/scrollState";
import { scrollToProgress } from "../lib/useScrollSystem";
import { useUI } from "../store";

/** Fictional metres: 1 world unit = 20 m, sea level at the waterline. */
const UNIT_M = 20;
const fmt = (m: number) => {
  const r = Math.round(m);
  return (r < 0 ? "−" : r > 0 ? "+" : "") + Math.abs(r).toLocaleString("en-US");
};

/** Wordmark and the depth ruler: strata bands, depth ticks, a moving flag, and chapter navigation. */
export function Hud() {
  const chapter = useUI((s) => s.chapter);
  const flag = useRef<HTMLDivElement>(null);
  const value = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);

  // Ticks sit where the camera actually crosses each depth, so spacing follows the story's pacing.
  const ticks = useMemo(() => {
    const out: { m: number; p: number }[] = [];
    for (let m = 4000; m >= -6000; m -= 2000) out.push({ m, p: progressAtY(WORLD.waterY + m / UNIT_M) });
    return out;
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const m = (scroll.camY - WORLD.waterY) * UNIT_M;
      if (value.current) value.current.textContent = fmt(m);
      track.current?.style.setProperty("--p", String(scroll.smooth));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // The accent follows the stratum you're in.
  useEffect(() => {
    document.documentElement.style.setProperty("--tone", chapters[chapter].tone);
  }, [chapter]);

  // Deep links: #sea jumps to a chapter, and the hash follows you down.
  useEffect(() => {
    const id = chapters[chapter].id;
    if (chapter === 0 && !location.hash) return;
    history.replaceState(null, "", `#${id}`);
  }, [chapter]);

  useEffect(() => {
    const i = chapters.findIndex((c) => c.id === location.hash.slice(1));
    if (i > 0) {
      const t = setTimeout(() => scrollToProgress(chapters[i].range[0] + 0.001, true), 60);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <>
      <a className="wordmark" href="#cloudtops" onClick={(e) => (e.preventDefault(), scrollToProgress(0))}>
        Descent
      </a>

      <p className="sr-only" role="status">
        Chapter {chapters[chapter].numeral}: {chapters[chapter].title}
      </p>

      <nav className="ruler" aria-label="Chapters">
        <div ref={track} className="ruler-track" aria-hidden="true">
          {chapters.map((c) => (
            <i
              key={c.id}
              className="band"
              style={{
                top: `${c.range[0] * 100}%`,
                height: `${(c.range[1] - c.range[0]) * 100}%`,
                background: c.tone,
              }}
            />
          ))}
          {ticks.map((t) => (
            <span key={t.m} className="tick" style={{ top: `${t.p * 100}%` }}>
              <b>{t.m === 0 ? "Sea level" : fmt(t.m)}</b>
            </span>
          ))}
          <div ref={flag} className="flag">
            <span ref={value}>0</span>
            <small> m</small>
          </div>
        </div>
        <ol>
          {chapters.map((c, i) => (
            <li key={c.id} style={{ top: `${((c.range[0] + c.range[1]) / 2) * 100}%` }}>
              <button
                className={i === chapter ? "active" : ""}
                aria-current={i === chapter ? "step" : undefined}
                onClick={() => scrollToProgress(c.range[0] + (c.range[1] - c.range[0]) * 0.38)}
              >
                <span className="stratum-name">
                  <span className="numeral">{c.numeral}</span> {c.title}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
