import { describe, expect, it } from 'vitest';
import { normalizeLyrics } from '../src/index.js';
import type { LrcDocument } from '../src/index.js';

describe('normalizeLyrics', () => {
  it('is not yet implemented', () => {
    const document: LrcDocument = { metadata: {}, lines: [], unknownEntries: [] };
    expect(() => normalizeLyrics(document, {})).toThrow(/not implemented/);
  });
});
