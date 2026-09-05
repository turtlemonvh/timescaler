import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Peak } from '../../engine/peaks';
import ClimbStage from './ClimbStage';
import { DROP_MS, HOP_MS, REDUCED_CROSSFADE_MS } from './climbStageMotion';

const peak: Peak = { id: 1, name: 'Basecamp Bluff', emphasis: 'Reading analog clocks', height: 20 };

/** jsdom has no `matchMedia`; every test states the motion preference it wants. */
function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function stage() {
  return screen.getByTestId('climb-stage');
}

function climber() {
  return screen.getByTestId('climb-stage-climber');
}

beforeEach(() => {
  vi.useFakeTimers();
  setReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ClimbStage', () => {
  it('drives the climber from a --climb-progress custom property, not a hard-coded offset', () => {
    render(<ClimbStage peak={peak} position={5} height={20} status="climbing" />);
    expect(stage().style.getPropertyValue('--climb-progress')).toBe('0.25');
  });

  it('re-derives --climb-progress from position/height as the climb goes on', () => {
    const { rerender } = render(
      <ClimbStage peak={peak} position={0} height={20} status="climbing" />,
    );
    expect(stage().style.getPropertyValue('--climb-progress')).toBe('0');

    rerender(<ClimbStage peak={peak} position={20} height={20} status="summited" />);
    expect(stage().style.getPropertyValue('--climb-progress')).toBe('1');
  });

  it('keeps the moving element and the pose element separate (the PR #84 smear rule)', () => {
    render(<ClimbStage peak={peak} position={4} height={20} status="climbing" />);
    // The pose element must be a descendant of the moving one, never the same
    // node: composing pose keyframes onto the translated element is what
    // reproduces the Chromium compositing smear.
    const pose = climber().querySelector('.climb-stage__pose');
    expect(pose).not.toBeNull();
    expect(pose).not.toBe(climber());
    expect(climber().classList.contains('climb-stage__pose')).toBe(false);
  });

  it('plays the move pose while hopping, then settles back to idle', () => {
    const { rerender } = render(
      <ClimbStage
        peak={peak}
        position={1}
        height={20}
        status="climbing"
        move={{ kind: 'hop', seq: 1 }}
      />,
    );
    expect(climber()).toHaveAttribute('data-phase', 'moving');
    expect(screen.getByTestId('sprite-animator')).toHaveAttribute('data-pose', 'move');

    act(() => {
      vi.advanceTimersByTime(HOP_MS);
    });
    rerender(
      <ClimbStage
        peak={peak}
        position={1}
        height={20}
        status="climbing"
        move={{ kind: 'hop', seq: 1 }}
      />,
    );
    expect(climber()).toHaveAttribute('data-phase', 'settled');
    expect(screen.getByTestId('sprite-animator')).toHaveAttribute('data-pose', 'idle');
  });

  it('replays the animation when the same kind happens twice, via the move sequence number', () => {
    const { rerender } = render(
      <ClimbStage
        peak={peak}
        position={1}
        height={20}
        status="climbing"
        move={{ kind: 'hop', seq: 1 }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(HOP_MS);
    });
    expect(climber()).toHaveAttribute('data-phase', 'settled');

    rerender(
      <ClimbStage
        peak={peak}
        position={2}
        height={20}
        status="climbing"
        move={{ kind: 'hop', seq: 2 }}
      />,
    );
    expect(climber()).toHaveAttribute('data-phase', 'moving');
  });

  it('shows the hurt pose and dust while dropping back after a miss', () => {
    render(
      <ClimbStage
        peak={peak}
        position={3}
        height={20}
        status="climbing"
        move={{ kind: 'drop', seq: 1 }}
      />,
    );
    expect(climber()).toHaveAttribute('data-move', 'drop');
    expect(screen.getByTestId('sprite-animator')).toHaveAttribute('data-pose', 'hurt');
    expect(screen.getAllByTestId('climb-stage-dust')).toHaveLength(3);

    // The drop is slower than a hop: still moving at the hop's duration.
    act(() => {
      vi.advanceTimersByTime(HOP_MS);
    });
    expect(climber()).toHaveAttribute('data-phase', 'moving');

    act(() => {
      vi.advanceTimersByTime(DROP_MS - HOP_MS);
    });
    expect(climber()).toHaveAttribute('data-phase', 'settled');
    expect(screen.queryAllByTestId('climb-stage-dust')).toHaveLength(0);
  });

  it('draws a fallen climber back at the base, holding the hurt pose', () => {
    render(
      <ClimbStage
        peak={peak}
        position={9}
        height={20}
        status="fell"
        move={{ kind: 'fall', seq: 1 }}
      />,
    );
    expect(stage().style.getPropertyValue('--climb-progress')).toBe('0');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('sprite-animator')).toHaveAttribute('data-pose', 'hurt');
  });

  it('holds the celebrate pose after a summit', () => {
    render(
      <ClimbStage
        peak={peak}
        position={20}
        height={20}
        status="summited"
        move={{ kind: 'summit', seq: 1 }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('sprite-animator')).toHaveAttribute('data-pose', 'celebrate');
  });

  it('labels the band so base, middle and summit are distinguishable', () => {
    const { rerender } = render(
      <ClimbStage peak={peak} position={1} height={20} status="climbing" />,
    );
    expect(stage()).toHaveAttribute('data-band', 'base');

    rerender(<ClimbStage peak={peak} position={10} height={20} status="climbing" />);
    expect(stage()).toHaveAttribute('data-band', 'middle');

    rerender(<ClimbStage peak={peak} position={19} height={20} status="climbing" />);
    expect(stage()).toHaveAttribute('data-band', 'summit');
  });

  it('draws three wall bands and a per-peak palette, with no bitmap', () => {
    const { container } = render(
      <ClimbStage peak={peak} position={1} height={20} status="climbing" />,
    );
    expect(container.querySelectorAll('.climb-stage__band')).toHaveLength(3);
    expect(container.querySelector('img[src*="wall"]')).toBeNull();
    // Peak 1's rock colour, straight from mountainThemes.ts.
    expect(stage().style.getPropertyValue('--climb-rock')).toBe('#6b6459');
  });

  it('exposes the height climbed as an accessible progressbar', () => {
    render(<ClimbStage peak={peak} position={7} height={20} status="climbing" />);
    const readout = screen.getByTestId('climb-stage-readout');
    expect(readout).toHaveAttribute('role', 'progressbar');
    expect(readout).toHaveAttribute('aria-valuenow', '7');
    expect(readout).toHaveAttribute('aria-valuemax', '20');
    expect(readout).toHaveTextContent('7');
  });

  it('shows the boost glow only while the meter is full', () => {
    const { container, rerender } = render(
      <ClimbStage peak={peak} position={4} height={20} status="climbing" boosted={false} />,
    );
    expect(container.querySelector('.climb-stage__glow')).toBeNull();

    rerender(<ClimbStage peak={peak} position={4} height={20} status="climbing" boosted />);
    expect(container.querySelector('.climb-stage__glow')).not.toBeNull();
    expect(climber()).toHaveAttribute('data-boosted', 'true');
  });

  it('renders the hud and the question card into the stage', () => {
    render(
      <ClimbStage peak={peak} position={2} height={20} status="climbing" hud={<span>meters</span>}>
        <p>the question</p>
      </ClimbStage>,
    );
    expect(screen.getByText('meters')).toBeInTheDocument();
    expect(screen.getByTestId('climb-stage-card')).toHaveTextContent('the question');
  });

  describe('with prefers-reduced-motion: reduce', () => {
    beforeEach(() => {
      setReducedMotion(true);
    });

    it('settles almost immediately instead of hopping, and says so in the vars', () => {
      render(
        <ClimbStage
          peak={peak}
          position={1}
          height={20}
          status="climbing"
          move={{ kind: 'hop', seq: 1 }}
        />,
      );
      expect(stage()).toHaveAttribute('data-reduced-motion', 'true');
      expect(stage().style.getPropertyValue('--climb-move-ms')).toBe(`${REDUCED_CROSSFADE_MS}ms`);

      act(() => {
        vi.advanceTimersByTime(REDUCED_CROSSFADE_MS);
      });
      expect(climber()).toHaveAttribute('data-phase', 'settled');
    });

    it('names the pose in text, so a static frame still says what happened', () => {
      render(
        <ClimbStage
          peak={peak}
          position={3}
          height={20}
          status="climbing"
          move={{ kind: 'drop', seq: 1 }}
        />,
      );
      expect(screen.getByTestId('climb-stage-pose-label')).toHaveTextContent('hurt');
    });
  });
});
