import type { ParseOptions, PlanOptions } from '../types/index.js';

export const DEFAULT_PARSE_OPTIONS: ParseOptions = { mode: 'tolerant' };

export const DEFAULT_PLAN_OPTIONS: PlanOptions = {
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
