import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { TimeOfDay, TimePrecision } from '../../engine/timeMath';
import AnalogClock from './AnalogClock';

const TEST_SIZE = 129;

/** A stateful host, so steps compound the way they do in `Climb`. */
function Harness({
  start,
  precision,
  disabled = false,
  onChange,
}: {
  start: TimeOfDay;
  precision: TimePrecision;
  disabled?: boolean;
  onChange?: (next: TimeOfDay) => void;
}) {
  const [time, setTime] = useState(start);
  return (
    <AnalogClock
      time={time}
      size={TEST_SIZE}
      precision={precision}
      disabled={disabled}
      onHandChange={(next) => {
        setTime(next);
        onChange?.(next);
      }}
    />
  );
}

function shown() {
  return {
    hour: Number(screen.getByTestId('analog-clock-hour-hand').getAttribute('data-hour')),
    minute: Number(screen.getByTestId('analog-clock-minute-hand').getAttribute('data-minute')),
  };
}

const at = (hour: number, minute: number): TimeOfDay => ({ hour, minute, second: 0 });

afterEach(() => {
  vi.useRealTimers();
});

describe('AnalogClock', () => {
  it('renders the face and both hands, but not the second hand by default', () => {
    render(<AnalogClock time={at(3, 15)} size={TEST_SIZE} />);
    expect(screen.getByTestId('analog-clock')).toBeInTheDocument();
    expect(screen.getByTestId('analog-clock-hour-hand')).toBeInTheDocument();
    expect(screen.getByTestId('analog-clock-minute-hand')).toBeInTheDocument();
    expect(screen.queryByTestId('analog-clock-second-hand')).not.toBeInTheDocument();
  });

  it('shows the second hand when showSeconds is set', () => {
    render(<AnalogClock time={at(3, 15)} size={TEST_SIZE} showSeconds />);
    expect(screen.getByTestId('analog-clock-second-hand')).toBeInTheDocument();
  });

  it('has no button pad without onHandChange (read-only)', () => {
    render(<AnalogClock time={at(2, 0)} size={TEST_SIZE} />);
    expect(screen.queryByTestId('clock-pad')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  describe('button pad', () => {
    it.each([
      ['half', 30],
      ['quarter', 15],
      ['five', 5],
      ['minute', 1],
    ] as const)('shows hour and minute rows at %s precision', (precision, step) => {
      render(<Harness start={at(2, 0)} precision={precision} />);
      expect(screen.getByTestId('clock-step-hour-back')).toBeInTheDocument();
      expect(screen.getByTestId('clock-step-hour-forward')).toBeInTheDocument();
      const forward = screen.getByTestId('clock-step-minute-forward');
      const unit = step === 1 ? 'minute' : 'minutes';
      expect(forward).toHaveAccessibleName(`minute hand forward ${step} ${unit}`);
      expect(screen.getByText('Hours')).toBeInTheDocument();
      expect(screen.getByText('Minutes')).toBeInTheDocument();
    });

    it('has no minute row at hour precision', () => {
      render(<Harness start={at(2, 0)} precision="hour" />);
      expect(screen.getByTestId('clock-step-hour-forward')).toBeInTheDocument();
      expect(screen.queryByTestId('clock-step-minute-forward')).not.toBeInTheDocument();
      expect(screen.queryByText('Minutes')).not.toBeInTheDocument();
    });

    it('has no digital readout of the draft time', () => {
      render(<Harness start={at(14, 35)} precision="five" />);
      expect(screen.getByTestId('analog-clock-input')).not.toHaveTextContent(/\d:\d\d/);
    });

    it.each([
      ['half', 30],
      ['quarter', 15],
      ['five', 5],
      ['minute', 1],
    ] as const)('a click on a minute arrow steps by %s precision', (precision, step) => {
      render(<Harness start={at(14, 0)} precision={precision} />);
      fireEvent.click(screen.getByTestId('clock-step-minute-forward'));
      expect(shown()).toEqual({ hour: 14, minute: step });
      fireEvent.click(screen.getByTestId('clock-step-minute-back'));
      fireEvent.click(screen.getByTestId('clock-step-minute-back'));
      expect(shown()).toEqual({ hour: 13, minute: 60 - step });
    });

    it('a click on an hour arrow steps one hour and keeps AM/PM', () => {
      render(<Harness start={at(23, 10)} precision="quarter" />);
      fireEvent.click(screen.getByTestId('clock-step-hour-forward'));
      expect(shown()).toEqual({ hour: 12, minute: 10 });
      fireEvent.click(screen.getByTestId('clock-step-hour-back'));
      expect(shown()).toEqual({ hour: 23, minute: 10 });
    });

    it('a pointer press steps once, and its own click does not step again', () => {
      const onChange = vi.fn();
      render(<Harness start={at(2, 0)} precision="five" onChange={onChange} />);
      const forward = screen.getByTestId('clock-step-minute-forward');
      fireEvent.pointerDown(forward, { pointerId: 1, button: 0 });
      fireEvent.pointerUp(forward, { pointerId: 1, button: 0 });
      fireEvent.click(forward, { detail: 1 });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(shown()).toEqual({ hour: 2, minute: 5 });
    });

    it('every quick tap steps exactly one unit', () => {
      vi.useFakeTimers();
      render(<Harness start={at(2, 38)} precision="minute" />);
      const forward = screen.getByTestId('clock-step-minute-forward');
      for (let i = 0; i < 3; i++) {
        fireEvent.pointerDown(forward, { pointerId: 1, button: 0 });
        fireEvent.pointerUp(forward, { pointerId: 1, button: 0 });
        act(() => vi.advanceTimersByTime(50));
      }
      expect(shown()).toEqual({ hour: 2, minute: 41 });
    });

    it('holding repeats after 400 ms and speeds up to a 60 ms floor', () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      render(<Harness start={at(2, 0)} precision="minute" onChange={onChange} />);
      const forward = screen.getByTestId('clock-step-minute-forward');
      fireEvent.pointerDown(forward, { pointerId: 1, button: 0 });
      expect(onChange).toHaveBeenCalledTimes(1);

      act(() => vi.advanceTimersByTime(399));
      expect(onChange).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(1));
      expect(onChange).toHaveBeenCalledTimes(2);
      // Gaps after the first repeat: 180, 153, 130.05, ... down to 60.
      act(() => vi.advanceTimersByTime(179));
      expect(onChange).toHaveBeenCalledTimes(2);
      act(() => vi.advanceTimersByTime(1));
      expect(onChange).toHaveBeenCalledTimes(3);
      act(() => vi.advanceTimersByTime(153));
      expect(onChange).toHaveBeenCalledTimes(4);

      // Long into the hold, repeats come every 60 ms.
      act(() => vi.advanceTimersByTime(3000));
      const before = onChange.mock.calls.length;
      act(() => vi.advanceTimersByTime(600));
      expect(onChange.mock.calls.length - before).toBe(10);
      // Every repeat moved on from the last one.
      expect(shown().minute + shown().hour * 60 - 120).toBe(onChange.mock.calls.length);
    });

    it.each(['pointerUp', 'pointerCancel', 'pointerLeave'] as const)(
      'a hold stops on %s',
      (endEvent) => {
        vi.useFakeTimers();
        const onChange = vi.fn();
        render(<Harness start={at(2, 0)} precision="five" onChange={onChange} />);
        const back = screen.getByTestId('clock-step-minute-back');
        fireEvent.pointerDown(back, { pointerId: 1, button: 0 });
        act(() => vi.advanceTimersByTime(400));
        expect(onChange).toHaveBeenCalledTimes(2);
        fireEvent[endEvent](back, { pointerId: 1 });
        act(() => vi.advanceTimersByTime(2000));
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(shown()).toEqual({ hour: 1, minute: 50 });
      },
    );

    it('a hold stops when the pad is disabled mid-press, and on unmount', () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      const { rerender, unmount } = render(
        <AnalogClock time={at(2, 0)} precision="five" onHandChange={onChange} />,
      );
      fireEvent.pointerDown(screen.getByTestId('clock-step-hour-forward'), {
        pointerId: 1,
        button: 0,
      });
      rerender(<AnalogClock time={at(3, 0)} precision="five" onHandChange={onChange} disabled />);
      act(() => vi.advanceTimersByTime(2000));
      expect(onChange).toHaveBeenCalledTimes(1);

      rerender(<AnalogClock time={at(3, 0)} precision="five" onHandChange={onChange} />);
      fireEvent.pointerDown(screen.getByTestId('clock-step-hour-forward'), {
        pointerId: 1,
        button: 0,
      });
      unmount();
      act(() => vi.advanceTimersByTime(2000));
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('prevents the long-press context menu on the arrows', () => {
      render(<Harness start={at(2, 0)} precision="five" />);
      const notCancelled = fireEvent.contextMenu(screen.getByTestId('clock-step-minute-forward'));
      expect(notCancelled).toBe(false);
    });

    it('is shown but disabled when `disabled` is set, and ignores presses', () => {
      const onChange = vi.fn();
      render(<Harness start={at(2, 0)} precision="five" disabled onChange={onChange} />);
      expect(screen.getByTestId('clock-pad')).toBeInTheDocument();
      for (const id of [
        'clock-step-hour-back',
        'clock-step-hour-forward',
        'clock-step-minute-back',
        'clock-step-minute-forward',
        'clock-help',
      ]) {
        expect(screen.getByTestId(id)).toBeDisabled();
      }
      fireEvent.pointerDown(screen.getByTestId('clock-step-minute-forward'), {
        pointerId: 1,
        button: 0,
      });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('help button', () => {
    it('toggles the hint', () => {
      render(<Harness start={at(2, 0)} precision="five" />);
      const help = screen.getByRole('button', { name: 'How to set the clock' });
      expect(help).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      fireEvent.click(help);
      expect(help).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('tooltip')).toHaveTextContent(/Hold it down to keep going/);

      fireEvent.click(help);
      expect(help).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('closes when an arrow is pressed', () => {
      render(<Harness start={at(2, 0)} precision="five" />);
      fireEvent.click(screen.getByTestId('clock-help'));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      fireEvent.pointerDown(screen.getByTestId('clock-step-hour-forward'), {
        pointerId: 1,
        button: 0,
      });
      fireEvent.pointerUp(screen.getByTestId('clock-step-hour-forward'), { pointerId: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      expect(screen.getByTestId('clock-help')).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes when the bubble itself is tapped', () => {
      render(<Harness start={at(2, 0)} precision="five" />);
      fireEvent.click(screen.getByTestId('clock-help'));
      fireEvent.click(screen.getByRole('tooltip'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('closes on Escape', () => {
      render(<Harness start={at(2, 0)} precision="five" />);
      fireEvent.click(screen.getByTestId('clock-help'));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('hides the hint while the pad is disabled', () => {
      const { rerender } = render(
        <AnalogClock time={at(2, 0)} precision="five" onHandChange={() => {}} />,
      );
      fireEvent.click(screen.getByTestId('clock-help'));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      rerender(<AnalogClock time={at(2, 0)} precision="five" onHandChange={() => {}} disabled />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('sizing', () => {
    it('renders the SVG face at the requested size', () => {
      render(<AnalogClock time={at(6, 0)} size={260} />);
      const svg = screen.getByTestId('analog-clock').querySelector('svg');
      expect(svg).toHaveAttribute('width', '260');
      expect(svg).toHaveAttribute('height', '260');
    });
  });

  describe('numerals', () => {
    it('shows all 12 numerals by default', () => {
      render(<AnalogClock time={at(6, 0)} size={TEST_SIZE} />);
      const numerals = screen.getAllByTestId('analog-clock-numeral').map((el) => el.textContent);
      expect(numerals).toHaveLength(12);
      expect(numerals).toEqual(
        expect.arrayContaining(['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']),
      );
    });

    it('hides numerals when showNumerals is false', () => {
      render(<AnalogClock time={at(6, 0)} size={TEST_SIZE} showNumerals={false} />);
      expect(screen.queryAllByTestId('analog-clock-numeral')).toHaveLength(0);
    });
  });
});
