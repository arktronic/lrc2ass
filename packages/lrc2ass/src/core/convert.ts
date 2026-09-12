import type {
  ConvertOptions,
  ConvertResult,
  NormalizeOptions,
  ParseOptions,
  PlanOverrideOptions,
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
  planBaseOpt: PlanOptions;
  planOverrideOpt: PlanOverrideOptions | undefined;
  serializeOpt: SerializeOptions;
} {
  const { mode: parseMode, ...parseRest } = options.parse ?? {};
  const parseOpt = { ...parseRest, mode: parseMode ?? DEFAULT_PARSE_OPTIONS.mode };
  const { mode: normalizeMode, ...normalizeRest } = options.normalize ?? {};

  return {
    parseOpt,
    normalizeOpt: { ...normalizeRest, mode: normalizeMode ?? parseOpt.mode },
    planBaseOpt: {
      ...DEFAULT_PLAN_OPTIONS,
      layout: { ...DEFAULT_PLAN_OPTIONS.layout },
    },
    planOverrideOpt: options.plan,
    serializeOpt: { ...options.serialize },
  };
}

/** One-step conversion composed from parse, normalize, plan, and serialize. Unset options fall back to defaults. */
export function convert(text: string, options: ConvertOptions = {}): ConvertResult {
  const { parseOpt, normalizeOpt, planBaseOpt, planOverrideOpt, serializeOpt } =
    resolveOptions(options);
  const { document, diagnostics: parseDiagnostics } = parseLrc(text, parseOpt);
  const { normalized, diagnostics: normalizeDiagnostics } = normalizeLyrics(document, normalizeOpt);
  const ass = planEvents(normalized, planBaseOpt, planOverrideOpt);
  if (document.metadata.ti) {
    ass.scriptInfo.title = document.metadata.ti;
  }
  const serialized = serializeAss(ass, serializeOpt);
  return { ass, text: serialized, diagnostics: [...parseDiagnostics, ...normalizeDiagnostics] };
}
