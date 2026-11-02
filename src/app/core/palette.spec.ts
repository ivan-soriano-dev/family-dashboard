import { buildPalette, contrast, parseHex } from './palette';

describe('palette', () => {
  it('parses short and long hex colours', () => {
    expect(parseHex('#ecd8dc')).toEqual([236, 216, 220]);
    expect(parseHex('fff')).toEqual([255, 255, 255]);
    expect(() => parseHex('pink')).toThrow();
  });

  it('puts dark text on a pale primary and white text on a strong one', () => {
    expect(buildPalette('#ecd8dc').onPrimary).toEqual([16, 24, 40]);
    expect(buildPalette('#7f56d9').onPrimary).toEqual([255, 255, 255]);
  });

  it('derives text shades that are readable on light and dark backgrounds', () => {
    for (const hex of ['#ecd8dc', '#7f56d9', '#ffcc00', '#222222', '#00a3a3']) {
      const p = buildPalette(hex);
      expect(contrast(p.accentLight, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accentDark, [16, 24, 40])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps greys grey', () => {
    const [r, g, b] = buildPalette('#222222').accentDark;
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});
