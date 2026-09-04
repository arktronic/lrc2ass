import type { ParseOptions, PlanOptions } from '../types/index.js';

export const DEFAULT_PARSE_OPTIONS: ParseOptions = { mode: 'tolerant' };
export const DEFAULT_TRAILING_DURATION_MS = 5000;

export const DEFAULT_PLAN_OPTIONS: PlanOptions = {
  karaokeEffect: 'sweep',
  preset: 'multi-line',
  mainLinePreRollMs: 1000,
  previewLeadMs: 4000,
  interlude: {
    minGapMs: 8000,
    strategy: 'text',
    marginMs: 500,
    trailingLyricDurationMs: 5000,
  },
  layout: {
    resolutionX: 384,
    resolutionY: 288,
    alignment: 2,
    marginLeft: 10,
    marginRight: 10,
    marginVertical: 10,
  },
};
