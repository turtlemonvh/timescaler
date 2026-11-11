import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NumberEntry from './NumberEntry';

describe('NumberEntry', () => {
  it('renders the given value', () => {
    render(<NumberEntry value={42} onChange={vi.fn()} />);
    expect(screen.getByTestId('number-entry-input')).toHaveValue(42);
  });

  it('reports the typed number on change', () => {
    const onChange = vi.fn();
    render(<NumberEntry value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('number-entry-input'), { target: { value: '17' } });
    expect(onChange).toHaveBeenCalledWith(17);
  });

  it('reports an empty string when cleared, not 0', () => {
    const onChange = vi.fn();
    render(<NumberEntry value={5} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('number-entry-input'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('brings up a digits keyboard with a "Go" return key', () => {
    render(<NumberEntry value="" onChange={vi.fn()} />);
    const input = screen.getByTestId('number-entry-input');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('enterkeyhint', 'go');
  });

  it('shows the unit label when given', () => {
    render(<NumberEntry value={10} onChange={vi.fn()} unit="minutes" />);
    expect(screen.getByTestId('number-entry-unit')).toHaveTextContent('minutes');
  });

  it('omits the unit label when not given', () => {
    render(<NumberEntry value={10} onChange={vi.fn()} />);
    expect(screen.queryByTestId('number-entry-unit')).not.toBeInTheDocument();
  });

  it('applies min and max as native input constraints', () => {
    render(<NumberEntry value={10} onChange={vi.fn()} min={0} max={59} />);
    const input = screen.getByTestId('number-entry-input');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '59');
  });
});
