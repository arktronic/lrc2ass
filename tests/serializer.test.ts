import { describe, expect, it } from 'vitest';
import { serializeAss } from '../src/index.js';
import type { AssDocument } from '../src/index.js';

describe('serializeAss', () => {
  it('is not yet implemented', () => {
    const document: AssDocument = {
      scriptInfo: { playResX: 384, playResY: 288 },
      styles: [],
      events: [],
    };
    expect(() => serializeAss(document, {})).toThrow(/not implemented/);
  });
});
