import type {
  ConvertOptions,
  ConvertResult,
  NormalizeOptions,
  ParseOptions,
  PlanOptions,
  SerializeOptions,
} from '../types/index.js';
import { parseLrc } from './parser.js';
import { normalizeLyrics } from './normalizer.js';
import { planEvents } from './planner.js';
import { serializeAss } from './serializer.js';
import { DEFAULT_PARSE_OPTIONS, DEFAULT_PLAN_OPTIONS } from './defaults.js';

function resolveOptions(options: ConvertOptions): {
  parseOpt: ParseOptions;
  normalizeOpt: NormalizeOptions;
  planOpt: PlanOptions;
  serializeOpt: SerializeOptions;
} {
  return {
    parseOpt: { ...DEFAULT_PARSE_OPTIONS, ...options.parse },
    normalizeOpt: { ...options.normalize },
    planOpt: {
      ...DEFAULT_PLAN_OPTIONS,
      ...options.plan,
      layout: { ...DEFAULT_PLAN_OPTIONS.layout, ...options.plan?.layout },
    },
    serializeOpt: { ...options.serialize },
  };
}

/** One-step conversion composed from parse, normalize, plan, and serialize. Unset options fall back to defaults. */
export function convert(text: string, options: ConvertOptions = {}): ConvertResult {
  const { parseOpt, normalizeOpt, planOpt, serializeOpt } = resolveOptions(options);
  const { document, diagnostics } = parseLrc(text, parseOpt);
  const normalized = normalizeLyrics(document, normalizeOpt);
  const ass = planEvents(normalized, planOpt);
  const serialized = serializeAss(ass, serializeOpt);
  return { ass, text: serialized, diagnostics };
}
