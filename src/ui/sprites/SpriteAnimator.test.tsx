import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import SpriteAnimator from './SpriteAnimator';
import { BUNNY } from './bunny';
import { frameAt } from './frameAt';

/** Pretend the OS asks for reduced motion (or doesn't). */
function setReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  // `vi.spyOn` is not undone by `unstubAllGlobals` — without this, a
  // requestAnimationFrame stub from one test leaks into the next one's counts.
  vi.restoreAllMocks();
});

describe('SpriteAnimator', () => {
  it('renders the first frame of the pose, pointing at the deployed sprite path', () => {
    setReducedMotion(false);
    render(<SpriteAnimator manifest={BUNNY} pose="idle" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', `${import.meta.env.BASE_URL}sprites/bunny/idle_00.png`);
    expect(img).toHaveAttribute('alt', 'Bunny, idle');
  });

  it('sizes to the manifest frame size by default, and to `size` when given', () => {
    setReducedMotion(false);
    const { rerender } = render(<SpriteAnimator manifest={BUNNY} pose="move" />);
    expect(screen.getByRole('img')).toHaveAttribute('width', String(BUNNY.frameSize));

    rerender(<SpriteAnimator manifest={BUNNY} pose="move" size={64} />);
    expect(screen.getByRole('img')).toHaveAttribute('width', '64');
  });

  it('advances through the pose over time', async () => {
    setReducedMotion(false);
    const move = BUNNY.poses.move;

    // Drive rAF by hand rather than letting it self-schedule: the animator's
    // clock is `now - firstFrameTime`, so feeding it timestamps is enough to
    // check the whole cycle deterministically.
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      queue.push(cb);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    render(<SpriteAnimator manifest={BUNNY} pose="move" />);
    const wrapper = screen.getByTestId('sprite-animator');
    expect(wrapper).toHaveAttribute('data-frame', '0');

    const origin = 1000;
    // 8 fps => 125 ms per frame; a full cycle is 500 ms.
    for (const elapsed of [0, 130, 260, 390, 520, 1000]) {
      const callback = queue.pop();
      expect(callback, 'the animator stopped scheduling frames').toBeDefined();
      queue.length = 0;
      await act(async () => {
        callback?.(origin + elapsed);
      });
      expect(wrapper, `at ${elapsed} ms`).toHaveAttribute(
        'data-frame',
        String(frameAt(move, elapsed)),
      );
    }
    expect(wrapper).toHaveAttribute('data-frame', '0');
  });

  it('resets to frame 0 when the pose changes', async () => {
    setReducedMotion(false);
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      queue.push(cb);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const { rerender } = render(<SpriteAnimator manifest={BUNNY} pose="move" />);
    await act(async () => queue.pop()?.(1000));
    await act(async () => queue.pop()?.(1300));
    expect(screen.getByTestId('sprite-animator')).toHaveAttribute('data-frame', '2');

    rerender(<SpriteAnimator manifest={BUNNY} pose="celebrate" />);
    expect(screen.getByTestId('sprite-animator')).toHaveAttribute('data-frame', '0');
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      `${import.meta.env.BASE_URL}sprites/bunny/celebrate_00.png`,
    );
  });

  it('under prefers-reduced-motion shows a static frame plus a pose label', () => {
    setReducedMotion(true);
    render(<SpriteAnimator manifest={BUNNY} pose="celebrate" />);

    expect(screen.getByTestId('sprite-pose-label')).toHaveTextContent('celebrate');
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      `${import.meta.env.BASE_URL}sprites/bunny/celebrate_00.png`,
    );
    expect(screen.getByTestId('sprite-animator')).toHaveAttribute('data-frame', '0');
  });

  it('does not show the pose label when motion is allowed — the animation speaks for itself', () => {
    setReducedMotion(false);
    render(<SpriteAnimator manifest={BUNNY} pose="celebrate" />);
    expect(screen.queryByTestId('sprite-pose-label')).not.toBeInTheDocument();
  });

  it('degrades to a labelled placeholder rather than a broken image for an unknown pose', () => {
    setReducedMotion(false);
    render(<SpriteAnimator manifest={BUNNY} pose="backflip" />);
    expect(screen.getByTestId('sprite-missing-pose')).toHaveAccessibleName(
      'Bunny: no backflip pose',
    );
    expect(screen.queryByTestId('sprite-animator')).not.toBeInTheDocument();
  });

  it('holds frame 0 for a single-frame pose without scheduling any animation', () => {
    setReducedMotion(false);
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    render(<SpriteAnimator manifest={BUNNY} pose="hurt" />);
    expect(screen.getByTestId('sprite-animator')).toHaveAttribute('data-frame', '0');
    expect(raf).not.toHaveBeenCalled();
  });
});

describe('the shipped bunny manifest', () => {
  it('parses, and has all four poses the game needs', () => {
    expect(Object.keys(BUNNY.poses).sort()).toEqual(['celebrate', 'hurt', 'idle', 'move']);
    expect(BUNNY.poses.move.frames.length).toBeGreaterThanOrEqual(4);
    expect(BUNNY.frameSize).toBe(96);
    expect(BUNNY.basePath).toBe('sprites/bunny');
  });

  it('credits a CC0 source with a working-looking license URL', () => {
    expect(BUNNY.credit.license).toMatch(/CC0/);
    expect(BUNNY.credit.licenseUrl).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(BUNNY.credit.url).toMatch(/^https:\/\//);
  });
});
