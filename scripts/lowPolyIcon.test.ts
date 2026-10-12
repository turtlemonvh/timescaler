import { describe, expect, it } from 'vitest';
import { buildIconSvg } from './lowPolyIcon.js';

describe('buildIconSvg', () => {
  it('renders an SVG at the requested pixel size on the 64-unit grid', () => {
    const svg = buildIconSvg(192);
    expect(svg).toContain('width="192"');
    expect(svg).toContain('height="192"');
    expect(svg).toContain('viewBox="0 0 64 64"');
  });

  it('draws the mountain, snow cap, flag, sun and two pines', () => {
    const svg = buildIconSvg(64);
    expect(svg).toContain('#e2552f'); // flag
    expect(svg).toContain('#f6f6f2'); // snow
    expect(svg).toContain('<circle'); // sun
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(16);
  });

  it('bleeds the sky to the edge and shrinks the art into the safe zone when maskable', () => {
    const standard = buildIconSvg(64);
    const maskable = buildIconSvg(64, { maskable: true });
    expect(standard).toContain('rx="12"');
    expect(maskable).toContain('rx="0"');
    expect(maskable).toContain('scale(0.8)');
    expect(maskable).not.toBe(standard);
  });
});
