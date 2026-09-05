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
  /** Desired empty space (px) between the multi-line preset's two rows; unused by single-line. */
  rowGapPx: number;
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
  /** Drop-shadow offset distance in pixels; 0 (the default) means backColor/backOpacity have no visible effect. */
  shadow?: number;
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
  /** How long before a lyric's first sung word its Lyrics event may appear (never earlier than its own timestamp). */
  mainLinePreRollMs: number;
  /** Max lead time before the next lyric's first sung word that a Preview event may appear. */
  previewLeadMs: number;
  /** Fade-in duration (ms) applied to every event; 0 (the default) disables it. */
  fadeInMs: number;
  /** Fade-out duration (ms) applied to every event; 0 (the default) disables it. */
  fadeOutMs: number;
  /** Multi-line preset: how many upcoming lyrics may be previewed at once (1-8, default 3, i.e. a 4-row layout). Each gets its own permanently-assigned row; more rows are simultaneously populated only when the song's pace brings enough upcoming lines within previewLeadMs at once. */
  maxPreviewLines: number;
  /** Multi-line preset: how long (ms) an already-sung line may keep showing on its row to fill the gap before that row's next occupant needs it, instead of going blank; 0 disables lingering. Skipped for gaps long enough to warrant an interlude instead. */
  lingerMaxMs: number;
}

export interface PlanOverrideOptions {
  karaokeEffect?: KaraokeEffect;
  layout?: Partial<LayoutOptions>;
  interlude?: InterludeOptions;
  preset?: PlanPreset;
  styles?: PlanStylesOptions;
  mainLinePreRollMs?: number;
  previewLeadMs?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  maxPreviewLines?: number;
  lingerMaxMs?: number;
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
