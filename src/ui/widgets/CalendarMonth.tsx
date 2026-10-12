import { useState } from 'react';
import { MONTH_NAMES } from '../questionDisplay';

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** How many years to offer on either side of the year currently in view —
 * re-centers as `view.year` changes, so picking a year at the edge of the
 * window (or paginating across a year boundary) keeps it within range
 * rather than requiring a fixed, eventually-exhausted list. */
const YEAR_WINDOW = 6;

function yearOptions(centerYear: number): number[] {
  return Array.from({ length: YEAR_WINDOW * 2 + 1 }, (_, i) => centerYear - YEAR_WINDOW + i);
}

export interface CalendarMonthProps {
  year: number;
  /** 0 = January, matching `Date.prototype.getMonth()`. */
  monthIndex: number;
  /** 1-based day of month to highlight. Only shown while the highlighted month is in view. */
  highlightDay?: number;
  /** Presence makes day cells clickable. */
  onDayClick?: (day: number, year: number, monthIndex: number) => void;
  /** Shorter rows for a narrow portrait card: cells keep their 44px width
   * but drop to 34px tall (26px when display-only — nothing to tap), the
   * month/year controls drop to 36px and the weekday headers shrink. */
  compact?: boolean;
}

/**
 * A month grid (Sunday-first, per the design spec's US conventions) with
 * built-in prev/next month navigation. Navigation is uncontrolled — it
 * starts at `year`/`monthIndex` but manages its own view state, since
 * "flip through months while browsing for a date" doesn't need a parent
 * round-trip on every click. `highlightDay` only renders while its month is
 * the one in view; flipping away from it is expected (that's the point of
 * browsing), not an error.
 */
export default function CalendarMonth({
  year,
  monthIndex,
  highlightDay,
  onDayClick,
  compact = false,
}: CalendarMonthProps) {
  const [view, setView] = useState({ year, monthIndex });

  function changeMonth(delta: number) {
    setView((current) => {
      let nextMonth = current.monthIndex + delta;
      let nextYear = current.year;
      if (nextMonth < 0) {
        nextMonth = 11;
        nextYear -= 1;
      } else if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }
      return { year: nextYear, monthIndex: nextMonth };
    });
  }

  const daysInMonth = new Date(view.year, view.monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(view.year, view.monthIndex, 1).getDay();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const highlightedMonthInView = view.year === year && view.monthIndex === monthIndex;
  const cellHeight = compact ? (onDayClick ? 34 : 26) : 44;
  const controlStyle = compact ? { minHeight: 36, padding: '0.25rem 0.9rem' } : undefined;
  const selectStyle = compact ? { minHeight: 36, padding: '0.2rem 0.5rem' } : undefined;

  return (
    <div data-testid="calendar-month">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        {/* Pinned to the row's own edges via flex, not positioned relative
         * to the month/year controls — so they stay put regardless of how
         * wide "September" vs "May" or the selected year render (issue
         * #77: pagination buttons used to shift with the label's width). */}
        <button
          type="button"
          data-testid="calendar-prev-month"
          aria-label="Previous month"
          style={controlStyle}
          onClick={() => changeMonth(-1)}
        >
          ‹
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', flex: 1 }}>
          <select
            data-testid="calendar-month-select"
            aria-label="Month"
            style={selectStyle}
            value={view.monthIndex}
            onChange={(event) =>
              setView((current) => ({ ...current, monthIndex: Number(event.target.value) }))
            }
          >
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
          <select
            data-testid="calendar-year-select"
            aria-label="Year"
            style={selectStyle}
            value={view.year}
            onChange={(event) =>
              setView((current) => ({ ...current, year: Number(event.target.value) }))
            }
          >
            {yearOptions(view.year).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          data-testid="calendar-next-month"
          aria-label="Next month"
          style={controlStyle}
          onClick={() => changeMonth(1)}
        >
          ›
        </button>
      </div>
      <div
        role="grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(44px, 1fr))', gap: 2 }}
      >
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            data-testid="calendar-weekday-header"
            style={compact ? { fontSize: '0.75rem', lineHeight: 1.4 } : undefined}
          >
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={index} aria-hidden="true" />;
          }
          const highlighted = highlightedMonthInView && day === highlightDay;
          const cellProps = {
            'data-testid': highlighted ? 'calendar-day-highlighted' : 'calendar-day',
            style: {
              minWidth: 44,
              minHeight: cellHeight,
              // Explicit non-highlighted defaults, not `undefined` — a day
              // cell is a grid of numbers, not a row of CTAs, so it can't
              // just fall through to the global button's ember pill/bevel.
              background: highlighted ? 'var(--accent)' : 'transparent',
              color: highlighted ? '#fff' : 'var(--text-h)',
              borderRadius: highlighted ? 8 : 6,
              fontWeight: highlighted ? 700 : 400,
              border: 'none',
              boxShadow: 'none',
              padding: 0,
            },
          };
          if (onDayClick) {
            return (
              <button
                type="button"
                key={index}
                {...cellProps}
                onClick={() => onDayClick(day, view.year, view.monthIndex)}
              >
                {day}
              </button>
            );
          }
          return (
            <div key={index} {...cellProps}>
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
