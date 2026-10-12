import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AnalogClock from './AnalogClock';

// `size` is a target — the widget snaps to the nearest integer multiple of
// its 129-cell face diameter (see the component's own doc comment on
// `size`). Tests pass 129 explicitly so `actualSize` == the requested size
// exactly (scale 1), keeping the geometry below simple and deterministic.
const TEST_SIZE = 129;
const CENTER = TEST_SIZE / 2;
const RADIUS = 50;

// jsdom returns an all-zero rect from getBoundingClientRect, which would
// make every drag compute against a zero-size circle. Stub it to match
// TEST_SIZE so drag-angle math has real geometry to work against.
const RECT = {
  left: 0,
  top: 0,
  width: TEST_SIZE,
  height: TEST_SIZE,
  right: TEST_SIZE,
  bottom: TEST_SIZE,
  x: 0,
  y: 0,
  toJSON: () => {},
} as DOMRect;

beforeEach(() => {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Pointer at the 3 o'clock position relative to center.
const THREE_OCLOCK = { clientX: CENTER + RADIUS, clientY: CENTER, pointerId: 1 };

describe('AnalogClock', () => {
  it('renders the face and both hands, but not the second hand by default', () => {
    render(<AnalogClock time={{ hour: 3, minute: 15, second: 0 }} size={TEST_SIZE} />);
    expect(screen.getByTestId('analog-clock')).toBeInTheDocument();
    expect(screen.getByTestId('analog-clock-hour-hand')).toBeInTheDocument();
    expect(screen.getByTestId('analog-clock-minute-hand')).toBeInTheDocument();
    expect(screen.queryByTestId('analog-clock-second-hand')).not.toBeInTheDocument();
  });

  it('shows the second hand when showSeconds is set', () => {
    render(<AnalogClock time={{ hour: 3, minute: 15, second: 0 }} size={TEST_SIZE} showSeconds />);
    expect(screen.getByTestId('analog-clock-second-hand')).toBeInTheDocument();
  });

  it('does not call onHandChange when no handler is provided (read-only)', () => {
    render(<AnalogClock time={{ hour: 2, minute: 0, second: 0 }} size={TEST_SIZE} />);
    // Should not throw when dragged without a handler.
    fireEvent.pointerDown(screen.getByTestId('analog-clock-minute-hand'), THREE_OCLOCK);
  });

  it("dragging the minute hand to 3 o'clock snaps to the given precision", () => {
    const onHandChange = vi.fn();
    render(
      <AnalogClock
        time={{ hour: 2, minute: 2, second: 0 }}
        size={TEST_SIZE}
        precision="quarter"
        onHandChange={onHandChange}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId('analog-clock-minute-hand'), THREE_OCLOCK);
    expect(onHandChange).toHaveBeenCalledWith(expect.objectContaining({ minute: 15, second: 0 }));
  });

  it('dragging the minute hand snaps to 5-minute steps at "five" precision', () => {
    const onHandChange = vi.fn();
    render(
      <AnalogClock
        time={{ hour: 2, minute: 0, second: 0 }}
        size={TEST_SIZE}
        precision="five"
        onHandChange={onHandChange}
      />,
    );
    // ~11 degrees past 12, between minute 1 and 2 — should snap to 0.
    fireEvent.pointerDown(screen.getByTestId('analog-clock-minute-hand'), {
      clientX: CENTER + Math.sin((11 * Math.PI) / 180) * RADIUS,
      clientY: CENTER - Math.cos((11 * Math.PI) / 180) * RADIUS,
      pointerId: 1,
    });
    expect(onHandChange).toHaveBeenCalledWith(expect.objectContaining({ minute: 0 }));
  });

  it("dragging the hour hand to 3 o'clock preserves PM", () => {
    const onHandChange = vi.fn();
    render(
      <AnalogClock
        time={{ hour: 14, minute: 0, second: 0 }}
        size={TEST_SIZE}
        onHandChange={onHandChange}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId('analog-clock-hour-hand'), THREE_OCLOCK);
    expect(onHandChange).toHaveBeenCalledWith(expect.objectContaining({ hour: 15 }));
  });

  it("dragging the hour hand to 3 o'clock preserves AM", () => {
    const onHandChange = vi.fn();
    render(
      <AnalogClock
        time={{ hour: 2, minute: 0, second: 0 }}
        size={TEST_SIZE}
        onHandChange={onHandChange}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId('analog-clock-hour-hand'), THREE_OCLOCK);
    expect(onHandChange).toHaveBeenCalledWith(expect.objectContaining({ hour: 3 }));
  });

  it('dragging the hour hand to 12 maps to noon or midnight, not 0/24', () => {
    const onHandChangePM = vi.fn();
    render(
      <AnalogClock
        time={{ hour: 14, minute: 0, second: 0 }}
        size={TEST_SIZE}
        onHandChange={onHandChangePM}
      />,
    );
    // Pointer straight up from center = 12 o'clock position.
    fireEvent.pointerDown(screen.getByTestId('analog-clock-hour-hand'), {
      clientX: CENTER,
      clientY: CENTER - RADIUS,
      pointerId: 1,
    });
    expect(onHandChangePM).toHaveBeenCalledWith(expect.objectContaining({ hour: 12 }));

    const onHandChangeAM = vi.fn();
    render(
      <AnalogClock
        time={{ hour: 2, minute: 0, second: 0 }}
        size={TEST_SIZE}
        onHandChange={onHandChangeAM}
      />,
    );
    fireEvent.pointerDown(screen.getAllByTestId('analog-clock-hour-hand')[1], {
      clientX: CENTER,
      clientY: CENTER - RADIUS,
      pointerId: 1,
    });
    expect(onHandChangeAM).toHaveBeenCalledWith(expect.objectContaining({ hour: 0 }));
  });

  it('continues to update on pointer move after the initial drag', () => {
    const onHandChange = vi.fn();
    render(
      <AnalogClock
        time={{ hour: 2, minute: 0, second: 0 }}
        size={TEST_SIZE}
        precision="quarter"
        onHandChange={onHandChange}
      />,
    );
    const hand = screen.getByTestId('analog-clock-minute-hand');
    const svg = screen.getByTestId('analog-clock').querySelector('svg');
    fireEvent.pointerDown(hand, THREE_OCLOCK);
    onHandChange.mockClear();
    // Move to 6 o'clock.
    fireEvent.pointerMove(svg!, { clientX: CENTER, clientY: CENTER + RADIUS, pointerId: 1 });
    expect(onHandChange).toHaveBeenCalledWith(expect.objectContaining({ minute: 30 }));
  });

  describe('sizing', () => {
    it('renders the SVG face at the requested size', () => {
      render(<AnalogClock time={{ hour: 6, minute: 0, second: 0 }} size={260} />);
      const svg = screen.getByTestId('analog-clock').querySelector('svg');
      expect(svg).toHaveAttribute('width', '260');
      expect(svg).toHaveAttribute('height', '260');
    });
  });

  describe('numerals', () => {
    it('shows all 12 numerals by default', () => {
      render(<AnalogClock time={{ hour: 6, minute: 0, second: 0 }} size={TEST_SIZE} />);
      const numerals = screen.getAllByTestId('analog-clock-numeral').map((el) => el.textContent);
      expect(numerals).toHaveLength(12);
      expect(numerals).toEqual(
        expect.arrayContaining(['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']),
      );
    });

    it('hides numerals when showNumerals is false', () => {
      render(
        <AnalogClock
          time={{ hour: 6, minute: 0, second: 0 }}
          size={TEST_SIZE}
          showNumerals={false}
        />,
      );
      expect(screen.queryAllByTestId('analog-clock-numeral')).toHaveLength(0);
    });
  });
});
