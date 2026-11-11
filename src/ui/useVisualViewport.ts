import { useEffect, useState } from 'react';

export interface VisualViewportBox {
  /** Height of the part of the page the player can actually see, in CSS px. */
  height: number;
  /**
   * How far the bottom of the visible area sits above the bottom of the
   * layout viewport — the on-screen keyboard's height on iOS Safari, where
   * the keyboard covers the page instead of resizing it. 0 when nothing
   * covers the bottom (desktop, or Android with `interactive-widget=resizes-content`).
   */
  bottomInset: number;
}

function measure(): VisualViewportBox | null {
  if (typeof window === 'undefined' || !window.visualViewport) return null;
  const viewport = window.visualViewport;
  // Pinch-zoom also shrinks the visual viewport; only a keyboard at 1:1 scale
  // should lift the card, or zooming in on desktop would fling it upwards.
  const zoomed = viewport.scale > 1.01;
  const bottomInset = zoomed
    ? 0
    : Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
  return { height: Math.round(zoomed ? window.innerHeight : viewport.height), bottomInset };
}

/**
 * Tracks the visual viewport, so fixed-position UI can stay above the mobile
 * on-screen keyboard. Chrome on Android resizes the layout itself when the
 * viewport meta has `interactive-widget=resizes-content`; iOS Safari doesn't,
 * so this is what keeps the Submit button in view there. Null where the API
 * is missing (jsdom, very old browsers): callers fall back to plain CSS.
 */
export function useVisualViewport(): VisualViewportBox | null {
  const [box, setBox] = useState(measure);
  useEffect(() => {
    const viewport = typeof window === 'undefined' ? undefined : window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setBox((current) => {
        const next = measure();
        return current &&
          next &&
          current.height === next.height &&
          current.bottomInset === next.bottomInset
          ? current
          : next;
      });
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return box;
}
