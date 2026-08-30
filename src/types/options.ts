import type { Diagnostic } from './diagnostics.js';
import type { EnhancedSegment, ParseOptions, ValidationMode } from './lrc.js';
import type { AssAlignment, AssDocument, KaraokeEffect } from './ass.js';

export type OverlapPolicy = 'preserve' | 'truncate' | 'error';

export interface Occurrence {
  startMs: number;
  endMs: number;
  text: string;
  segments?: EnhancedSegment[];
}

export interface NormalizedLyrics {
  occurrences: Occurrence[];
}

export interface NormalizeOptions {
  mode?: ValidationMode;
  offsetMs?: number;
  overlapPolicy?: OverlapPolicy;
  trackEndMs?: number;
  defaultTrailingDurationMs?: number;
}

export interface NormalizeResult {
  normalized: NormalizedLyrics;
  diagnostics: Diagnostic[];
}

export interface InterludeOptions {
  minGapMs: number;
  strategy: 'none' | 'text' | 'countdown';
  style?: string;
  marginMs?: number;
  /** Time a lyric remains visible after its start, or its final enhanced segment start. */
  trailingLyricDurationMs?: number;
}

export interface LayoutOptions {
  resolutionX: number;
  resolutionY: number;
  alignment: AssAlignment;
  marginLeft: number;
  marginRight: number;
  marginVertical: number;
}

/** High-level visual settings for a generated ASS style. Colors use `#RRGGBB`. */
export interface PlanStyleOptions {
  fontName?: string;
  fontSize?: number;
  primaryColor?: string;
  secondaryColor?: string;
  outlineColor?: string;
  backColor?: string;
  backOpacity?: number;
  alignment?: AssAlignment;
  marginLeft?: number;
  marginRight?: number;
  marginVertical?: number;
}

export interface PlanStylesOptions {
  lyrics?: PlanStyleOptions;
  preview?: PlanStyleOptions;
  interlude?: PlanStyleOptions;
}

export type PlanPreset = 'single-line' | 'multi-line';

export interface PlanOptions {
  karaokeEffect: KaraokeEffect;
  layout: LayoutOptions;
  interlude?: InterludeOptions;
  preset?: PlanPreset;
  styles?: PlanStylesOptions;
}

export interface PlanOverrideOptions {
  karaokeEffect?: KaraokeEffect;
  layout?: Partial<LayoutOptions>;
  interlude?: InterludeOptions;
  preset?: PlanPreset;
  styles?: PlanStylesOptions;
}

export interface SerializeOptions {
  includeMetadataComments?: boolean;
}

export type ParseOverrideOptions = Partial<ParseOptions>;

export interface ConvertOptions {
  parse?: ParseOverrideOptions;
  normalize?: NormalizeOptions;
  plan?: PlanOverrideOptions;
  serialize?: SerializeOptions;
}

export interface ConvertResult {
  ass: AssDocument;
  text: string;
  diagnostics: Diagnostic[];
}
