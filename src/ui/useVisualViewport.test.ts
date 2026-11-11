import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useVisualViewport } from './useVisualViewport';

/** A stand-in for `window.visualViewport`, which jsdom doesn't have. */
function installViewport(initial: { height: number; offsetTop?: number; scale?: number }) {
  const state = { offsetTop: 0, scale: 1, ...initial };
  const target = new EventTarget();
  // Getters, so the hook reads the latest state (Object.assign would copy values).
  const viewport = Object.defineProperties(target, {
    height: { get: () => state.height },
    offsetTop: { get: () => state.offsetTop },
    scale: { get: () => state.scale },
  });
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  return {
    set(next: Partial<typeof state>) {
      Object.assign(state, next);
      act(() => {
        target.dispatchEvent(new Event('resize'));
      });
    },
  };
}

describe('useVisualViewport', () => {
  const innerHeight = window.innerHeight;
  afterEach(() => {
    Reflect.deleteProperty(window, 'visualViewport');
    Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
  });

  it('is null where the browser has no visualViewport (jsdom)', () => {
    const { result } = renderHook(() => useVisualViewport());
    expect(result.current).toBeNull();
  });

  it('reports no inset while nothing covers the page', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    installViewport({ height: 800 });
    const { result } = renderHook(() => useVisualViewport());
    expect(result.current).toEqual({ height: 800, bottomInset: 0 });
  });

  it("measures the keyboard's height when it covers the layout (iOS Safari)", () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const viewport = installViewport({ height: 800 });
    const { result } = renderHook(() => useVisualViewport());
    viewport.set({ height: 480 });
    expect(result.current).toEqual({ height: 480, bottomInset: 320 });
    // iOS also pans the page up a little to reveal the field.
    viewport.set({ height: 480, offsetTop: 40 });
    expect(result.current).toEqual({ height: 480, bottomInset: 280 });
    viewport.set({ height: 800, offsetTop: 0 });
    expect(result.current).toEqual({ height: 800, bottomInset: 0 });
  });

  it('ignores pinch-zoom, which also shrinks the visual viewport', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const viewport = installViewport({ height: 800 });
    const { result } = renderHook(() => useVisualViewport());
    viewport.set({ height: 400, scale: 2 });
    expect(result.current).toEqual({ height: 800, bottomInset: 0 });
  });
});
