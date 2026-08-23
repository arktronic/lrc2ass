import type { Diagnostic } from './diagnostics.js';
import type { EnhancedSegment } from './lrc.js';
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
  offsetMs?: number;
  overlapPolicy?: OverlapPolicy;
  trackEndMs?: number;
  defaultTrailingDurationMs?: number;
}

export interface InterludeOptions {
  minGapMs: number;
  strategy: 'none' | 'text' | 'countdown';
  style?: string;
  marginMs?: number;
}

export interface LayoutOptions {
  resolutionX: number;
  resolutionY: number;
  alignment: AssAlignment;
  marginLeft: number;
  marginRight: number;
  marginVertical: number;
}

export interface PlanOptions {
  karaokeEffect: KaraokeEffect;
  layout: LayoutOptions;
  interlude?: InterludeOptions;
  preset?: 'single-line' | 'multi-line';
}

export interface PlanOverrideOptions {
  karaokeEffect?: KaraokeEffect;
  layout?: Partial<LayoutOptions>;
  interlude?: InterludeOptions;
  preset?: 'single-line' | 'multi-line';
}

export interface SerializeOptions {
  includeMetadataComments?: boolean;
}

export interface ConvertOptions {
  parse?: import('./lrc.js').ParseOptions;
  normalize?: NormalizeOptions;
  plan?: PlanOverrideOptions;
  serialize?: SerializeOptions;
}

export interface ConvertResult {
  ass: AssDocument;
  text: string;
  diagnostics: Diagnostic[];
}
