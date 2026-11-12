import { createRoot } from "react-dom/client";
import { entryPath, isBladePath } from "./blade/model";

// After a new version is published, an already-open tab may ask for page files that no longer exist.
// Reload once to fetch the current version instead of leaving a blank screen.
const RELOAD_KEY = "app-chunk-reload";
function reloadOnce() {
  if (sessionStorage.getItem(RELOAD_KEY)) return false;
  sessionStorage.setItem(RELOAD_KEY, "1");
  window.location.reload();
  return true;
}
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnce();
});

const rootElement = document.getElementById("root");

if (rootElement) {
  const root = createRoot(rootElement);
  const path = entryPath(window.location.pathname);
  if (path !== window.location.pathname) window.history.replaceState(null, "", path + window.location.search + window.location.hash);
  const loaded = () => sessionStorage.removeItem(RELOAD_KEY);
  const failed = (error: unknown) => {
    console.error("App failed to load", error);
    if (reloadOnce()) return;
    rootElement.innerHTML =
      '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif;padding:24px;text-align:center"><p>Une nouvelle version est disponible.</p><button onclick="sessionStorage.removeItem(\'app-chunk-reload\');location.reload()" style="padding:10px 18px;border-radius:10px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer">Recharger</button></div>';
  };
  if (isBladePath(path)) {
    import("./blade/BladeApp")
      .then(({ default: BladeApp }) => {
        root.render(<BladeApp />);
        loaded();
      })
      .catch(failed);
  } else {
    Promise.all([import("./App.tsx"), import("./index.css")])
      .then(([{ default: App }]) => {
        root.render(<App />);
        loaded();
      })
      .catch(failed);
  }
}
