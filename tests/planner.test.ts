import { describe, expect, it } from 'vitest';
import { planEvents } from '../src/index.js';
import type { NormalizedLyrics, PlanOptions } from '../src/index.js';

describe('planEvents', () => {
  it('is not yet implemented', () => {
    const normalized: NormalizedLyrics = { occurrences: [] };
    const options: PlanOptions = {
      karaokeEffect: 'none',
      layout: {
        resolutionX: 384,
        resolutionY: 288,
        alignment: 2,
        marginLeft: 10,
        marginRight: 10,
        marginVertical: 10,
      },
    };
    expect(() => planEvents(normalized, options)).toThrow(/not implemented/);
  });
});
