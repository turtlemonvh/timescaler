import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MiniMap from './MiniMap';

describe('MiniMap', () => {
  it('shows the position/height label', () => {
    render(<MiniMap position={12} height={20} />);
    expect(screen.getByTestId('mini-map-label')).toHaveTextContent('12 / 20');
  });

  it('places the marker higher as position rises toward the summit', () => {
    render(<MiniMap position={5} height={20} />);
    const quarterY = Number(screen.getByTestId('mini-map-marker').getAttribute('cy'));

    render(<MiniMap position={15} height={20} />);
    const threeQuarterY = Number(screen.getAllByTestId('mini-map-marker')[1].getAttribute('cy'));

    // Higher up the cliff means a smaller SVG y, since the viewBox's origin
    // is the top.
    expect(threeQuarterY).toBeLessThan(quarterY);
  });

  it('places the marker at its lowest point when position is 0', () => {
    render(<MiniMap position={0} height={20} />);
    const emptyY = Number(screen.getByTestId('mini-map-marker').getAttribute('cy'));

    render(<MiniMap position={20} height={20} />);
    const fullY = Number(screen.getAllByTestId('mini-map-marker')[1].getAttribute('cy'));

    expect(emptyY).toBeGreaterThan(fullY);
  });

  it('is the labelled progressbar when it is the only progress display', () => {
    render(<MiniMap position={12} height={20} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '12');
    expect(screen.getByTestId('mini-map')).toHaveAttribute('data-compact', 'false');
  });

  it('shrinks to a HUD chip in compact mode, keeping the same drawing', () => {
    const { container: full } = render(<MiniMap position={12} height={20} />);
    const fullSvg = full.querySelector('svg');
    const { container: chip } = render(<MiniMap position={12} height={20} compact />);
    const chipSvg = chip.querySelector('svg');

    expect(Number(chipSvg?.getAttribute('width'))).toBeLessThan(
      Number(fullSvg?.getAttribute('width')),
    );
    // Same viewBox, so it is the same cliff at a smaller size, not a redraw.
    expect(chipSvg?.getAttribute('viewBox')).toBe(fullSvg?.getAttribute('viewBox'));
    expect(chip.querySelector('[data-testid="mini-map-label"]')).toHaveTextContent('12 / 20');
  });

  it('stops claiming to be a progressbar in compact mode', () => {
    // Since #94 the climb screen's ClimbStage owns the labelled progressbar;
    // this is a decorative glance next to the meters, and two progressbars
    // reporting the same number is noise on a screen reader.
    const { container } = render(<MiniMap position={12} height={20} compact />);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('does not divide by zero when height is 0', () => {
    render(<MiniMap position={0} height={0} />);
    expect(screen.getByTestId('mini-map-marker')).toHaveAttribute('cy');
    expect(Number.isNaN(Number(screen.getByTestId('mini-map-marker').getAttribute('cy')))).toBe(
      false,
    );
  });
});
