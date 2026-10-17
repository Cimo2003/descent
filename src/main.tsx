import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);

// Small debug handle (e.g. `__descent.scroll.target = 0.5` in the console, or for automated screenshots).
import { scroll } from "./lib/scrollState";
(window as unknown as { __descent: unknown }).__descent = { scroll };
