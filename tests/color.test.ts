import { describe, expect, it } from 'vitest';
import { assColorFromHex } from '../src/index.js';

describe('assColorFromHex', () => {
  it('converts a hex string and opaque default into an ASS color', () => {
    expect(assColorFromHex('#FF0000')).toBe('&H000000FF&');
  });

  it('inverts opacity into ASS alpha (0 opacity -> FF alpha)', () => {
    expect(assColorFromHex('#00FF00', 0)).toBe('&HFF00FF00&');
  });

  it('accepts hex without a leading #', () => {
    expect(assColorFromHex('0000FF')).toBe('&H00FF0000&');
  });

  it('rejects malformed hex', () => {
    expect(() => assColorFromHex('not-a-color')).toThrow(/hex must be/);
  });

  it('rejects out-of-range opacity', () => {
    expect(() => assColorFromHex('#FFFFFF', 2)).toThrow(/opacity must be/);
  });
});
