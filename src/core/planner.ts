import type {
  AssDocument,
  NormalizedLyrics,
  PlanOptions,
  PlanOverrideOptions,
} from '../types/index.js';

/**
 * Applies karaoke, layout, style, preset, and interlude options to produce an ASS document.
 * Stub: pipeline stage not yet implemented.
 */
export function planEvents(
  _normalized: NormalizedLyrics,
  _baseOptions: PlanOptions,
  _overrideOptions?: PlanOverrideOptions,
): AssDocument {
  throw new Error('planEvents: not implemented');
}
