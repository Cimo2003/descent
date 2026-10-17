import { useUI } from "../store";

/** Intro curtain. Hides while shaders compile, then lifts. */
export function Loader() {
  const ready = useUI((s) => s.ready);
  return (
    <div className={`loader ${ready ? "done" : ""}`} aria-hidden={ready} role="status">
      <div className="loader-inner">
        <p className="loader-title">Descent</p>
        <div className="loader-bar" aria-hidden="true">
          <i />
        </div>
        <p className="loader-note">Preparing the dive…</p>
      </div>
    </div>
  );
}

/** Shown instead of the canvas when WebGL is unavailable. The story is still readable. */
export function NoWebGL({ chapters }: { chapters: { id: string; numeral: string; line: string; body: string }[] }) {
  return (
    <main className="fallback">
      <h1>Descent</h1>
      <p className="lead">
        This piece needs WebGL to fly you down through five worlds. Your browser or device can’t run it right now, so
        here is the journey in words.
      </p>
      {chapters.map((c) => (
        <section key={c.id}>
          <h2>
            <span>{c.numeral}.</span> {c.line}
          </h2>
          <p>{c.body}</p>
        </section>
      ))}
    </main>
  );
}
