import PreviewPlayer from '../preview/PreviewPlayer';
import DebugClimbStagePage from './DebugClimbStagePage';
import DebugHudPage from './DebugHudPage';
import DebugQuestionsPage from './DebugQuestionsPage';
import DebugScreensPage from './DebugScreensPage';
import DebugSpritesPage from './DebugSpritesPage';
import DebugWidgetsPage from './DebugWidgetsPage';

export const DEBUG_PREFIX = '/debug/';

/**
 * Dev-only screen switch. The game itself has no URL routing — screens are
 * driven by app state — so this deliberately is not a router library, just a
 * `switch` over the path suffix. Add a `case` per debug screen.
 *
 * Rendered only from `main.tsx`, and only behind `import.meta.env.DEV`.
 */
export default function DebugRouter({ pathname }: { pathname: string }) {
  const route = pathname.startsWith(DEBUG_PREFIX)
    ? pathname.slice(DEBUG_PREFIX.length).replace(/\/+$/, '')
    : '';

  switch (route) {
    case 'questions':
      return <DebugQuestionsPage />;
    case 'sprites':
      return <DebugSpritesPage />;
    case 'widgets':
      return <DebugWidgetsPage />;
    case 'hud':
      return <DebugHudPage />;
    case 'climb-stage':
      return <DebugClimbStagePage />;
    case 'screens':
      return <DebugScreensPage />;
    case 'preview':
      return <PreviewPlayer />;
    default:
      return (
        <main>
          <h1>Unknown debug route</h1>
          <p>
            No debug screen is registered for <code>{pathname}</code>.
          </p>
          <ul>
            <li>
              <a href="/debug/questions">/debug/questions</a>
            </li>
            <li>
              <a href="/debug/sprites">/debug/sprites</a>
            </li>
            <li>
              <a href="/debug/widgets">/debug/widgets</a>
            </li>
            <li>
              <a href="/debug/hud">/debug/hud</a>
            </li>
            <li>
              <a href="/debug/climb-stage">/debug/climb-stage</a>
            </li>
            <li>
              <a href="/debug/screens">/debug/screens</a>
            </li>
            <li>
              <a href="/debug/preview">/debug/preview</a>
            </li>
          </ul>
        </main>
      );
  }
}
