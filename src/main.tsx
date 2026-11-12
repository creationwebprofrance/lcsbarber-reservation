import { createRoot } from "react-dom/client";
import { entryPath, isBladePath } from "./blade/model";

const rootElement = document.getElementById("root");

if (rootElement) {
  const root = createRoot(rootElement);
  const path = entryPath(window.location.pathname);
  if (path !== window.location.pathname) window.history.replaceState(null, "", path + window.location.search + window.location.hash);
  if (isBladePath(path)) {
    import("./blade/BladeApp").then(({ default: BladeApp }) => {
      root.render(<BladeApp />);
    });
  } else {
    Promise.all([import("./App.tsx"), import("./index.css")]).then(([{ default: App }]) => {
      root.render(<App />);
    });
  }
}
