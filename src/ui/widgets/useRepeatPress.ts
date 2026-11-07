import { useEffect, useLayoutEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

/** How long a press is held before it starts repeating. */
export const REPEAT_DELAY_MS = 400;
/** The gap between the first two repeats; each later gap is `REPEAT_ACCELERATION` times the last. */
export const REPEAT_START_INTERVAL_MS = 180;
export const REPEAT_ACCELERATION = 0.85;
/** The shortest gap between repeats, however long the press is held. */
export const REPEAT_MIN_INTERVAL_MS = 60;

export interface RepeatPressHandlers {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Press-and-hold for a step button: `onStep` runs once on pointerdown, then,
 * if the press is still held after `REPEAT_DELAY_MS`, again and again,
 * faster each time down to a floor. Lifting, cancelling or sliding off the
 * button stops it, as does `disabled` turning on or the button unmounting.
 * A keyboard activation (a `click` with `detail === 0`) steps once; a
 * pointer's own click is ignored, since its pointerdown already stepped.
 */
export function useRepeatPress(onStep: () => void, disabled = false): RepeatPressHandlers {
  const onStepRef = useRef(onStep);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    onStepRef.current = onStep;
  });

  useEffect(() => {
    if (disabled) stopRepeat(timerRef);
  }, [disabled]);

  useEffect(() => () => stopRepeat(timerRef), []);

  function stop() {
    stopRepeat(timerRef);
  }

  return {
    onPointerDown(event) {
      if (disabled || event.button > 0) return;
      // Touch presses are implicitly captured by the button they start on,
      // which would keep pointerleave from firing when a finger slides off.
      const target = event.currentTarget;
      if (target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      stop();
      onStepRef.current();
      let interval = REPEAT_START_INTERVAL_MS;
      const repeat = () => {
        onStepRef.current();
        timerRef.current = setTimeout(repeat, interval);
        interval = Math.max(REPEAT_MIN_INTERVAL_MS, interval * REPEAT_ACCELERATION);
      };
      timerRef.current = setTimeout(repeat, REPEAT_DELAY_MS);
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onClick(event) {
      if (!disabled && event.detail === 0) onStepRef.current();
    },
    onContextMenu(event) {
      event.preventDefault();
    },
  };
}

function stopRepeat(timerRef: { current: ReturnType<typeof setTimeout> | null }) {
  if (timerRef.current !== null) clearTimeout(timerRef.current);
  timerRef.current = null;
}
