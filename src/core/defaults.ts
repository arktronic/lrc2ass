import type { ParseOptions, PlanOptions } from '../types/index.js';

export const DEFAULT_PARSE_OPTIONS: ParseOptions = { mode: 'tolerant' };
export const DEFAULT_TRAILING_DURATION_MS = 5000;

export const DEFAULT_PLAN_OPTIONS: PlanOptions = {
  karaokeEffect: 'none',
  preset: 'single-line',
  layout: {
    resolutionX: 384,
    resolutionY: 288,
    alignment: 2,
    marginLeft: 10,
    marginRight: 10,
    marginVertical: 10,
  },
};
