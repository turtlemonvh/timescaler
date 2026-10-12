import { useState } from 'react';
import { formatDateLong } from '../../engine/dateMath';
import CalendarMonth from './CalendarMonth';

export interface PickedDate {
  year: number;
  monthIndex: number;
  day: number;
}

export interface DatePickerProps {
  initialYear: number;
  initialMonthIndex: number;
  onChange?: (date: PickedDate) => void;
  /** Passed through to `CalendarMonth`, and tightens the summary line's margins. */
  compact?: boolean;
}

/**
 * A thin wrapper around `CalendarMonth` for picking an arbitrary date,
 * possibly after browsing to a different month than the one it opened on.
 * Deliberately doesn't try to keep `CalendarMonth`'s `highlightDay` in sync
 * with the pick — that prop is designed around "the highlighted day's month
 * is the one in view" (readCalendar's use case), which stops holding the
 * moment a picked date and the current browse position are in different
 * months. The text summary below the grid is the source of truth for what's
 * picked; showing it as a persistent highlighted cell across navigation
 * would need `CalendarMonth` to become a controlled component, which
 * nothing needs yet.
 */
export default function DatePicker({
  initialYear,
  initialMonthIndex,
  onChange,
  compact = false,
}: DatePickerProps) {
  const [picked, setPicked] = useState<PickedDate | null>(null);

  function handleDayClick(day: number, year: number, monthIndex: number) {
    const next = { year, monthIndex, day };
    setPicked(next);
    onChange?.(next);
  }

  return (
    <div data-testid="date-picker">
      <CalendarMonth
        year={initialYear}
        monthIndex={initialMonthIndex}
        onDayClick={handleDayClick}
        compact={compact}
      />
      <p data-testid="date-picker-value" style={compact ? { margin: '0.35rem 0 0' } : undefined}>
        {picked
          ? `Selected: ${formatDateLong(new Date(picked.year, picked.monthIndex, picked.day))}`
          : 'No date selected'}
      </p>
    </div>
  );
}
