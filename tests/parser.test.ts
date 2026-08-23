import { describe, expect, it } from 'vitest';
import { parseLrc } from '../src/index.js';

describe('parseLrc', () => {
  it('is not yet implemented', () => {
    expect(() => parseLrc('', { mode: 'tolerant' })).toThrow(/not implemented/);
  });
});
