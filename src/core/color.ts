import type { AssColor } from '../types/index.js';

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;

/**
 * Builds an {@link AssColor} from a traditional `#RRGGBB` hex string and an
 * opacity in the usual 0 (transparent) - 1 (opaque) convention. Internally
 * this is inverted to ASS's alpha byte, where 00 is opaque and FF is transparent.
 */
export function assColorFromHex(hex: string, opacity = 1): AssColor {
  const match = HEX_PATTERN.exec(hex);
  if (!match) {
    throw new RangeError(`hex must be a "#RRGGBB" string, received: ${hex}`);
  }
  if (opacity < 0 || opacity > 1) {
    throw new RangeError(`opacity must be between 0 and 1, received: ${opacity}`);
  }

  const [red, green, blue] = [0, 2, 4].map((offset) =>
    parseInt(match[1].slice(offset, offset + 2), 16),
  );
  const alpha = Math.round((1 - opacity) * 255);

  const channel = (value: number): string => value.toString(16).padStart(2, '0').toUpperCase();
  return `&H${channel(alpha)}${channel(blue)}${channel(green)}${channel(red)}&` as AssColor;
}
