import { describe, expect, it } from 'vitest';
import { cardDocksRight, framingFor, keepInFrame, slotDistance } from './framing';

describe('framingFor', () => {
  it('docks the card right exactly where index.css does', () => {
    expect(cardDocksRight(720, 720)).toBe(true);
    expect(cardDocksRight(719, 500)).toBe(false);
    expect(cardDocksRight(900, 901)).toBe(false);
    expect(cardDocksRight(1280, 720)).toBe(true);
  });

  it('keeps the climber left of the docked climb card', () => {
    for (const [w, h] of [
      [720, 720],
      [1024, 768],
      [1280, 720],
      [1920, 1080],
    ]) {
      const { homeX, safe } = framingFor(w, h, 'climb');
      const cardLeftPx = w - 16 - Math.min(0.44 * w, 560);
      const cardLeftNdc = (2 * cardLeftPx) / w - 1;
      expect(safe.maxX).toBeLessThan(cardLeftNdc);
      expect(safe.minX).toBeGreaterThan(-1);
      expect(homeX).toBeGreaterThan(safe.minX);
      expect(homeX).toBeLessThan(safe.maxX);
    }
  });

  it('keeps the climber above a bottom card and below the HUD on a phone', () => {
    const { homeY, safe } = framingFor(390, 844, 'climb');
    expect(safe.minY).toBeGreaterThanOrEqual(-0.1);
    expect(safe.maxY).toBeLessThan(1 - (2 * 64) / 844);
    expect(homeY).toBeGreaterThan(safe.minY);
    expect(homeY).toBeLessThan(safe.maxY);
  });
});

describe('keepInFrame', () => {
  const safe = { minX: -0.9, maxX: 0, minY: -0.9, maxY: 0.8 };
  it('leaves a box that already fits alone', () => {
    expect(keepInFrame({ minX: -0.5, maxX: -0.2, minY: 0, maxY: 0.5 }, safe)).toEqual({
      dx: 0,
      dy: 0,
    });
  });
  it('pans just enough to bring an escaping box back', () => {
    const { dx, dy } = keepInFrame({ minX: -0.2, maxX: 0.3, minY: 0.5, maxY: 1.2 }, safe);
    expect(dx).toBeCloseTo(0.3);
    expect(dy).toBeCloseTo(0.4);
    const left = keepInFrame({ minX: -1.4, maxX: -1.0, minY: -1.3, maxY: -1.0 }, safe);
    expect(left.dx).toBeCloseTo(-0.5);
    expect(left.dy).toBeCloseTo(-0.4);
  });
  it('prefers the head when the box is taller than the safe area', () => {
    const { dy } = keepInFrame({ minX: -0.5, maxX: -0.2, minY: -1.5, maxY: 1.5 }, safe);
    expect(1.5 - dy).toBeCloseTo(safe.maxY);
  });
});

describe('slotDistance', () => {
  it('pulls back on a narrow docked layout only', () => {
    const tanHalf = Math.tan((21 * Math.PI) / 180);
    const square = framingFor(720, 720, 'climb');
    const wide = framingFor(1280, 720, 'climb');
    expect(slotDistance(7.2, wide.safe, 1280 / 720, tanHalf)).toBe(7.2);
    const d = slotDistance(7.2, square.safe, 1, tanHalf);
    expect(d).toBeGreaterThan(7.2);
    expect((square.safe.maxX - square.safe.minX) * d * tanHalf).toBeCloseTo(3.6);
  });
});
