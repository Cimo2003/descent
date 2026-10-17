import { useEffect, useRef } from "react";
import { chapters } from "../data/chapters";
import { scroll, reducedMotion } from "../lib/scrollState";
import { scrollToProgress } from "../lib/useScrollSystem";

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The visual copy is fixed to the viewport and faded per frame from the damped scroll value, so it
 * stays in sync with the camera without React re-renders. It is aria-hidden: screen-reader users get
 * the same story as a plain landmark (see <main> below) instead of text that appears and vanishes.
 */
export function Overlay() {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const hero = useRef<HTMLElement>(null);
  const hint = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = scroll.smooth;
      const first = chapters[0].range[1];

      if (hero.current) {
        const o = 1 - ss(0.004, first * 0.26, p);
        hero.current.style.opacity = String(o);
        hero.current.style.transform = `translate3d(0, ${reducedMotion ? 0 : (1 - o) * -40}px, 0)`;
        hero.current.style.visibility = o < 0.01 ? "hidden" : "visible";
      }
      if (hint.current) hint.current.style.opacity = String(1 - ss(0.002, 0.02, p));

      chapters.forEach((c, i) => {
        const el = refs.current[i];
        if (!el) return;
        const [r0, r1] = c.range;
        const len = r1 - r0;
        const start = i === 0 ? r0 + len * 0.3 : r0 + len * 0.1; // chapter I waits for the title to clear
        const inn = ss(start, start + len * 0.2, p);
        const out = 1 - ss(r1 - len * 0.22, r1 - len * 0.02, p);
        const o = i === chapters.length - 1 ? inn : inn * out;
        const dy = reducedMotion ? 0 : (1 - inn) * 36 + (1 - out) * -36;
        el.style.opacity = String(o);
        el.style.transform = `translate3d(0, ${dy}px, 0)`;
        el.style.visibility = o < 0.01 ? "hidden" : "visible";
        el.style.pointerEvents = o > 0.5 ? "auto" : "none";
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <main className="sr-only" id="story">
        <h1>Descent</h1>
        <p>From the last light above the clouds, down to the warm heart of the world. Scroll to descend.</p>
        {chapters.map((c) => (
          <section key={c.id} aria-labelledby={`h-${c.id}`}>
            <h2 id={`h-${c.id}`}>
              {c.numeral}. {c.line}
            </h2>
            <p>{c.body}</p>
          </section>
        ))}
      </main>

      <div className="overlay">
        <header ref={hero} className="hero" aria-hidden="true">
          <p className="hero-title">Descent</p>
          <p className="hero-sub">From the last light above the clouds, down to the warm heart of the world.</p>
        </header>

        <div ref={hint} className="scroll-hint" aria-hidden="true">
          <span>Scroll</span>
          <i />
        </div>

        {chapters.map((c, i) => (
          <article
            key={c.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`chapter ${c.side}`}
            id={c.id}
            style={{ ["--tone" as string]: c.tone }}
          >
            <div aria-hidden="true">
              <h2>{c.line}</h2>
              <p className="body">{c.body}</p>
            </div>
            {i === chapters.length - 1 && (
              <button className="ascend" onClick={() => scrollToProgress(0)}>
                Back to the top
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
