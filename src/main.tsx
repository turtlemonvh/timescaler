import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import DebugRouter, { DEBUG_PREFIX } from './ui/debug/DebugRouter.tsx';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

const root = createRoot(document.getElementById('root')!);

// Dev-only debug screens. `import.meta.env.DEV` is replaced with `false` at
// build time, so this branch — and DebugRouter with it — is eliminated from
// production bundles. The dev server's SPA history fallback is what serves
// index.html for /debug/* in the first place; a production build has no such
// fallback, which is a second reason these pages never ship.
//
// This check assumes the app is served from the root path. If
// VITE_BASE_PATH is ever set to a non-root base (e.g. `/timescaler/`),
// `window.location.pathname` would be prefixed with that base (e.g.
// `/timescaler/debug/questions`) and this `startsWith` check would no
// longer match — the debug routes would silently stop working. Not fixed
// here; just documented so a future reader isn't surprised.
if (import.meta.env.DEV && window.location.pathname.startsWith(DEBUG_PREFIX)) {
  const debug = <DebugRouter pathname={window.location.pathname} />;
  // The trailer's scripted player predicts each question from the climb's
  // seed, which only works if state initialisers run once, as in production.
  // StrictMode's double-invoke would draw an extra question from the RNG.
  root.render(
    window.location.pathname.startsWith(`${DEBUG_PREFIX}trailer`) ? (
      debug
    ) : (
      <StrictMode>{debug}</StrictMode>
    ),
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
