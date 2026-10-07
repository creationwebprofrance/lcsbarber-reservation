import { createRoot } from "react-dom/client";
import { isBladePath } from "./blade/model";

const rootElement = document.getElementById("root");

if (rootElement) {
  const root = createRoot(rootElement);
  if (isBladePath(window.location.pathname)) {
    import("./blade/BladeApp").then(({ default: BladeApp }) => {
      root.render(<BladeApp />);
    });
  } else {
    Promise.all([import("./App.tsx"), import("./index.css")]).then(([{ default: App }]) => {
      root.render(<App />);
    });
  }
}
