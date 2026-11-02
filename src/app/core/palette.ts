/**
 * Pure colour helpers: from one primary colour, work out
 *  - the text colour to put on top of it (dark or white),
 *  - a readable text shade of the same hue for light backgrounds and for dark backgrounds
 *    (WCAG contrast 4.5:1).
 */
export type Rgb = readonly [number, number, number];

export interface Palette {
  primary: Rgb;
  onPrimary: Rgb;
  accentLight: Rgb;
  accentDark: Rgb;
}

const INK: Rgb = [16, 24, 40];
const WHITE: Rgb = [255, 255, 255];

export function parseHex(hex: string): Rgb {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Not a hex colour: ${hex}`);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function contrast(a: Rgb, b: Rgb): number {
  const lum = (c: Rgb) =>
    c
      .map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h =
    max === rr
      ? (gg - bb) / d + (gg < bb ? 6 : 0)
      : max === gg
        ? (bb - rr) / d + 2
        : (rr - gg) / d + 4;
  h /= 6;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** Keep the hue, move the lightness until it reads as text on `background`. */
function readableShade(color: Rgb, background: Rgb, darker: boolean): Rgb {
  const [h, s0, l0] = toHsl(color);
  const s = s0 < 0.05 ? s0 : Math.max(s0, 0.3); // greys stay grey
  for (let i = 0; i <= 50; i++) {
    const l = darker ? l0 - (l0 * i) / 50 : l0 + ((1 - l0) * i) / 50;
    const candidate = i === 0 ? color : fromHsl(h, s, l);
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return darker ? [0, 0, 0] : WHITE;
}

export function buildPalette(hex: string): Palette {
  const primary = parseHex(hex);
  return {
    primary,
    onPrimary: contrast(primary, INK) >= contrast(primary, WHITE) ? INK : WHITE,
    accentLight: readableShade(primary, WHITE, true),
    accentDark: readableShade(primary, INK, false),
  };
}

export const css = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`;
