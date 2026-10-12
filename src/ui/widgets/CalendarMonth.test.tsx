import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import CalendarMonth from './CalendarMonth';

/** Reads the month/year selects' current values, since there's no longer a
 * single text label to assert against (issue #77 replaced it with direct
 * month/year selects for faster navigation). */
function monthYearInView(): { month: string; year: string } {
  return {
    month: (screen.getByTestId('calendar-month-select') as HTMLSelectElement).value,
    year: (screen.getByTestId('calendar-year-select') as HTMLSelectElement).value,
  };
}

describe('CalendarMonth', () => {
  it('renders the correct weekday alignment and day count for a known month', () => {
    // August 2026: 1st is a Saturday, 31 days.
    render(<CalendarMonth year={2026} monthIndex={7} />);
    expect(monthYearInView()).toEqual({ month: '7', year: '2026' });
    const days = screen.getAllByTestId('calendar-day');
    expect(days).toHaveLength(31);
    expect(days[0]).toHaveTextContent('1');
    expect(days[30]).toHaveTextContent('31');
  });

  it('highlights the given day only while its month is in view', () => {
    render(<CalendarMonth year={2026} monthIndex={7} highlightDay={15} />);
    expect(screen.getByTestId('calendar-day-highlighted')).toHaveTextContent('15');

    fireEvent.click(screen.getByTestId('calendar-next-month'));
    expect(screen.queryByTestId('calendar-day-highlighted')).not.toBeInTheDocument();
  });

  it('gives the highlighted day a visibly different background, not just a different testid', () => {
    render(<CalendarMonth year={2026} monthIndex={7} highlightDay={15} />);
    const highlighted = screen.getByTestId('calendar-day-highlighted');
    const plain = screen.getAllByTestId('calendar-day')[0];
    expect(highlighted.style.background).not.toBe('');
    expect(highlighted.style.background).not.toBe(plain.style.background);
  });

  it('navigates to the next month, wrapping the year at December', () => {
    render(<CalendarMonth year={2025} monthIndex={11} />);
    expect(monthYearInView()).toEqual({ month: '11', year: '2025' });
    fireEvent.click(screen.getByTestId('calendar-next-month'));
    expect(monthYearInView()).toEqual({ month: '0', year: '2026' });
  });

  it('navigates to the previous month, wrapping the year at January', () => {
    render(<CalendarMonth year={2026} monthIndex={0} />);
    fireEvent.click(screen.getByTestId('calendar-prev-month'));
    expect(monthYearInView()).toEqual({ month: '11', year: '2025' });
  });

  it('jumps directly to a chosen month without paginating', () => {
    render(<CalendarMonth year={2026} monthIndex={0} />);
    fireEvent.change(screen.getByTestId('calendar-month-select'), { target: { value: '7' } });
    expect(monthYearInView()).toEqual({ month: '7', year: '2026' });
  });

  it('jumps directly to a chosen year without paginating', () => {
    render(<CalendarMonth year={2026} monthIndex={0} />);
    fireEvent.change(screen.getByTestId('calendar-year-select'), { target: { value: '2024' } });
    expect(monthYearInView()).toEqual({ month: '0', year: '2024' });
  });

  it('offers a year range centered on the year in view, not a fixed window', () => {
    render(<CalendarMonth year={2026} monthIndex={0} />);
    const initialOptions = within(screen.getByTestId('calendar-year-select'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(initialOptions).toContain('2020');
    expect(initialOptions).toContain('2032');

    fireEvent.change(screen.getByTestId('calendar-year-select'), { target: { value: '2020' } });
    const recenteredOptions = within(screen.getByTestId('calendar-year-select'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(recenteredOptions).toContain('2014');
    expect(recenteredOptions).not.toContain('2032');
  });

  it('lays the header out as a fixed-edge flex row, not inline text, so pagination buttons stay put regardless of label width (issue #77)', () => {
    const { container } = render(<CalendarMonth year={2026} monthIndex={0} />);
    const header = screen.getByTestId('calendar-prev-month').parentElement!;
    expect(header).toBe(container.querySelector('[data-testid="calendar-month"] > div'));
    expect(header.style.display).toBe('flex');
    expect(header.style.justifyContent).toBe('space-between');
    // The prev/next buttons are direct children of the flex row (pinned to
    // its edges); the month/year controls live in their own flex-1 child
    // that absorbs any width change instead of pushing the buttons.
    expect(header.children[0]).toBe(screen.getByTestId('calendar-prev-month'));
    expect(header.children[header.children.length - 1]).toBe(
      screen.getByTestId('calendar-next-month'),
    );
  });

  it('handles a leap-year February correctly', () => {
    render(<CalendarMonth year={2024} monthIndex={1} />);
    expect(screen.getAllByTestId('calendar-day')).toHaveLength(29);
  });

  it('renders day cells as plain text when no onDayClick is given', () => {
    const { container } = render(<CalendarMonth year={2026} monthIndex={7} />);
    const grid = within(container).getByRole('grid');
    expect(grid.querySelector('button[data-testid="calendar-day"]')).toBeNull();
  });

  it('makes day cells clickable and reports the clicked day when onDayClick is given', () => {
    const onDayClick = vi.fn();
    render(<CalendarMonth year={2026} monthIndex={7} onDayClick={onDayClick} />);
    fireEvent.click(screen.getAllByTestId('calendar-day')[9]);
    expect(onDayClick).toHaveBeenCalledWith(10, 2026, 7);
  });

  it('keeps 44px day cells by default and shortens them when compact (issue #113)', () => {
    const { unmount } = render(<CalendarMonth year={2026} monthIndex={7} />);
    expect(screen.getAllByTestId('calendar-day')[0].style.minHeight).toBe('44px');
    unmount();

    // Display-only: nothing to tap, so the rows can be shortest.
    const display = render(<CalendarMonth year={2026} monthIndex={7} compact />);
    expect(screen.getAllByTestId('calendar-day')[0].style.minHeight).toBe('26px');
    display.unmount();

    // Clickable cells stay 44px wide and at least 34px tall.
    render(<CalendarMonth year={2026} monthIndex={7} compact onDayClick={vi.fn()} />);
    const cell = screen.getAllByTestId('calendar-day')[0];
    expect(cell.style.minHeight).toBe('34px');
    expect(cell.style.minWidth).toBe('44px');
  });
});
