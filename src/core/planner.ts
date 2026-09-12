import type {
  AssDocument,
  AssEvent,
  AssStyle,
  InterludeOptions,
  KaraokeEffect,
  LayoutOptions,
  NormalizedLyrics,
  PlanOptions,
  PlanOverrideOptions,
  PlanPreset,
  PlanStyleOptions,
  PlanStylesOptions,
} from '../types/index.js';
import { assColorFromHex } from './color.js';

const LYRIC_STYLE_NAME = 'Lyrics';
const PREVIEW_STYLE_NAME = 'Preview';
const INTERLUDE_STYLE_NAME = 'Interlude';
const DEFAULT_INTERLUDE_MARGIN_MS = 0;
const DEFAULT_INTERLUDE_TEXT = '♪ Instrumental ♪';

const CENTISECOND_MS = 10;
const PRE_SWEEP_DOT_CHAR = '\u00B7';
const PRE_SWEEP_DOT_COUNT = 4;
// Below this, one or more dots would be quantized down to a 0cs (instant-fill) tag, breaking the
// sequential count-in; fall back to the plain empty-syllable tag instead.
const PRE_SWEEP_MIN_DURATION_MS = PRE_SWEEP_DOT_COUNT * CENTISECOND_MS;
const PROGRESS_BAR_HEIGHT_PX = 24;
const PROGRESS_BAR_RADIUS_PX = 8;
/** Hard cap on maxPreviewLines; keeps the multi-line preset's row stack to a sane, readable size. */
const MAX_PREVIEW_LINES_CAP = 8;

// The multi-line preset's rows share one evenly-spaced block: this is the offset from the block's
// anchored edge to its first row. For the default 2-row case, an8 (top row) measures it from the
// top edge and an2 (bottom row) measures it from the bottom edge, so this single value centers both
// rows toward/away from each other at once (twice as fast as either edge alone).
function computeRowBlockTopMargin(resolutionY: number, rowHeightPx: number, rowCount: number): number {
  return Math.round((resolutionY - rowCount * rowHeightPx) / 2);
}

interface ResolvedPlanOptions extends PlanOptions {
  layout: LayoutOptions;
  preset: PlanPreset;
  styles: PlanStylesOptions;
}

interface PlanPresetDefaults {
  showPreview: boolean;
  styles: PlanStylesOptions;
}

const PLAN_PRESETS: Readonly<Record<PlanPreset, PlanPresetDefaults>> = Object.freeze({
  'single-line': Object.freeze({
    showPreview: false,
    styles: Object.freeze({
      lyrics: Object.freeze({
        fontName: 'Arial',
        fontSize: 28,
        primaryColor: '#FFFFFF',
        secondaryColor: '#808080',
        outlineColor: '#000000',
        backColor: '#000000',
        backOpacity: 0,
      }),
      preview: Object.freeze({
        fontName: 'Arial',
        fontSize: 28,
        primaryColor: '#C0C0C0',
        secondaryColor: '#808080',
        outlineColor: '#000000',
        backColor: '#000000',
        backOpacity: 0,
        alignment: 8,
      }),
      interlude: Object.freeze({
        fontName: 'Arial',
        fontSize: 28,
        primaryColor: '#FFFFFF',
        secondaryColor: '#808080',
        outlineColor: '#000000',
        backColor: '#000000',
        backOpacity: 0,
      }),
    }),
  }),
  'multi-line': Object.freeze({
    showPreview: true,
    styles: Object.freeze({
      lyrics: Object.freeze({
        fontName: 'Arial',
        fontSize: 28,
        primaryColor: '#FFFFFF',
        secondaryColor: '#808080',
        outlineColor: '#FF0000',
        backColor: '#000000',
        backOpacity: 0.8,
        shadow: 6,
      }),
      preview: Object.freeze({
        fontName: 'Arial',
        fontSize: 28,
        primaryColor: '#C0C0C0',
        secondaryColor: '#808080',
        outlineColor: '#0000FF',
        backColor: '#000000',
        backOpacity: 0.8,
        shadow: 6,
        alignment: 8,
      }),
      interlude: Object.freeze({
        fontName: 'Arial',
        fontSize: 28,
        primaryColor: '#FFFFFF',
        secondaryColor: '#808080',
        outlineColor: '#000000',
        backColor: '#000000',
        // Row alternation means Preview can land on either row, so Interlude stays centered to avoid both.
        alignment: 5,
        backOpacity: 0.8,
        shadow: 6,
      }),
    }),
  }),
});

function definedLayoutOverrides(overrides: Partial<LayoutOptions> | undefined): Partial<LayoutOptions> {
  if (!overrides) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<LayoutOptions>;
}

function definedInterludeOverrides(overrides: PlanOverrideOptions['interlude']): Partial<NonNullable<PlanOptions['interlude']>> {
  if (!overrides) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<NonNullable<PlanOptions['interlude']>>;
}

function mergeStyleOptions(...styles: Array<PlanStyleOptions | undefined>): PlanStyleOptions {
  return Object.assign({}, ...styles.map((style) => {
    if (!style) {
      return {};
    }
    return Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined));
  }));
}

function resolveStyles(
  presetStyles: PlanStylesOptions,
  baseStyles: PlanStylesOptions | undefined,
  overrideStyles: PlanStylesOptions | undefined,
): PlanStylesOptions {
  return {
    lyrics: mergeStyleOptions(presetStyles.lyrics, baseStyles?.lyrics, overrideStyles?.lyrics),
    preview: mergeStyleOptions(presetStyles.preview, baseStyles?.preview, overrideStyles?.preview),
    interlude: mergeStyleOptions(presetStyles.interlude, baseStyles?.interlude, overrideStyles?.interlude),
  };
}

function resolvePlanOptions(baseOptions: PlanOptions, overrides: PlanOverrideOptions | undefined): ResolvedPlanOptions {
  const preset = overrides?.preset ?? baseOptions.preset ?? 'single-line';
  const presetDefaults = PLAN_PRESETS[preset];
  if (!presetDefaults) {
    throw new RangeError(`preset must be "single-line" or "multi-line", received ${String(preset)}`);
  }
  const interlude = baseOptions.interlude
    ? { ...baseOptions.interlude, ...definedInterludeOverrides(overrides?.interlude) }
    : overrides?.interlude;
  return {
    ...baseOptions,
    karaokeEffect: overrides?.karaokeEffect ?? baseOptions.karaokeEffect,
    mainLinePreRollMs: overrides?.mainLinePreRollMs ?? baseOptions.mainLinePreRollMs,
    previewLeadMs: overrides?.previewLeadMs ?? baseOptions.previewLeadMs,
    fadeInMs: overrides?.fadeInMs ?? baseOptions.fadeInMs,
    fadeOutMs: overrides?.fadeOutMs ?? baseOptions.fadeOutMs,
    maxPreviewLines: overrides?.maxPreviewLines ?? baseOptions.maxPreviewLines,
    lingerMaxMs: overrides?.lingerMaxMs ?? baseOptions.lingerMaxMs,
    interlude,
    preset,
    layout: {
      ...baseOptions.layout,
      ...definedLayoutOverrides(overrides?.layout),
    },
    styles: resolveStyles(presetDefaults.styles, baseOptions.styles, overrides?.styles),
  };
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer, received ${value}`);
  }
}

function assertAlignment(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new RangeError(`${name} must be an ASS alignment from 1 to 9, received ${value}`);
  }
}

function assertStyleOptions(styles: PlanStyleOptions, role: string): void {
  if (styles.fontName !== undefined && !/^[^,\r\n]+$/.test(styles.fontName)) {
    throw new RangeError(`${role}.fontName must be non-empty and cannot contain commas or line breaks`);
  }
  if (styles.fontSize !== undefined && (!Number.isFinite(styles.fontSize) || styles.fontSize <= 0)) {
    throw new RangeError(`${role}.fontSize must be a positive finite number, received ${styles.fontSize}`);
  }
  if (styles.alignment !== undefined) {
    assertAlignment(styles.alignment, `${role}.alignment`);
  }
  for (const margin of ['marginLeft', 'marginRight', 'marginVertical'] as const) {
    if (styles[margin] !== undefined) {
      assertNonNegativeSafeInteger(styles[margin], `${role}.${margin}`);
    }
  }
  if (styles.backOpacity !== undefined && (!Number.isFinite(styles.backOpacity) || styles.backOpacity < 0 || styles.backOpacity > 1)) {
    throw new RangeError(`${role}.backOpacity must be between 0 and 1, received ${styles.backOpacity}`);
  }
  if (styles.shadow !== undefined && (!Number.isFinite(styles.shadow) || styles.shadow < 0)) {
    throw new RangeError(`${role}.shadow must be a non-negative finite number, received ${styles.shadow}`);
  }
  for (const color of ['primaryColor', 'secondaryColor', 'outlineColor', 'backColor'] as const) {
    if (styles[color] !== undefined) {
      assColorFromHex(styles[color]);
    }
  }
}

function assertPlanOptions(options: ResolvedPlanOptions): void {
  if (!['none', 'instant', 'sweep', 'sweep-outline'].includes(options.karaokeEffect)) {
    throw new RangeError(`karaokeEffect is invalid: ${String(options.karaokeEffect)}`);
  }
  assertNonNegativeSafeInteger(options.mainLinePreRollMs, 'mainLinePreRollMs');
  assertNonNegativeSafeInteger(options.previewLeadMs, 'previewLeadMs');
  assertNonNegativeSafeInteger(options.fadeInMs, 'fadeInMs');
  assertNonNegativeSafeInteger(options.fadeOutMs, 'fadeOutMs');
  if (!Number.isInteger(options.maxPreviewLines) || options.maxPreviewLines < 1 || options.maxPreviewLines > MAX_PREVIEW_LINES_CAP) {
    throw new RangeError(`maxPreviewLines must be an integer from 1 to ${MAX_PREVIEW_LINES_CAP}, received ${options.maxPreviewLines}`);
  }
  assertNonNegativeSafeInteger(options.lingerMaxMs, 'lingerMaxMs');
  if (!Number.isSafeInteger(options.layout.resolutionX) || options.layout.resolutionX <= 0) {
    throw new RangeError(`layout.resolutionX must be a positive safe integer, received ${options.layout.resolutionX}`);
  }
  if (!Number.isSafeInteger(options.layout.resolutionY) || options.layout.resolutionY <= 0) {
    throw new RangeError(`layout.resolutionY must be a positive safe integer, received ${options.layout.resolutionY}`);
  }
  assertAlignment(options.layout.alignment, 'layout.alignment');
  for (const margin of ['marginLeft', 'marginRight', 'marginVertical'] as const) {
    assertNonNegativeSafeInteger(options.layout[margin], `layout.${margin}`);
  }
  if (options.layout.marginLeft + options.layout.marginRight >= options.layout.resolutionX) {
    throw new RangeError(
      `layout.marginLeft + layout.marginRight must be less than layout.resolutionX, received `
      + `${options.layout.marginLeft} + ${options.layout.marginRight} >= ${options.layout.resolutionX}`,
    );
  }
  if (!Number.isSafeInteger(options.layout.rowHeightPx) || options.layout.rowHeightPx <= 0) {
    throw new RangeError(`layout.rowHeightPx must be a positive safe integer, received ${options.layout.rowHeightPx}`);
  }
  if (options.layout.rowAlignment !== undefined) {
    assertAlignment(options.layout.rowAlignment, 'layout.rowAlignment');
  }
  if (PLAN_PRESETS[options.preset].showPreview) {
    const rowCount = options.maxPreviewLines + 1;
    const rowBlockHeight = rowCount * options.layout.rowHeightPx;
    if (rowBlockHeight >= options.layout.resolutionY) {
      throw new RangeError(
        `The multi-line row block (maxPreviewLines + 1 = ${rowCount} rows * layout.rowHeightPx `
        + `${options.layout.rowHeightPx} = ${rowBlockHeight}) must be strictly less than layout.resolutionY `
        + `(an exact fit would produce a top row MarginV of 0, which ASS treats as "no override"), `
        + `received ${options.layout.resolutionY}`,
      );
    }
    const rowAlignment = options.layout.rowAlignment ?? options.styles.preview?.alignment ?? options.layout.alignment;
    if (rowAlignment >= 4 && rowAlignment <= 6) {
      throw new RangeError(
        `layout.rowAlignment must be a top or bottom ASS alignment (1-3 or 7-9); middle alignments `
        + `(4-6) ignore MarginV, so distinct rows would collapse onto the same vertical position, `
        + `received ${rowAlignment}`,
      );
    }
  }
  assertStyleOptions(options.styles.lyrics ?? {}, 'styles.lyrics');
  assertStyleOptions(options.styles.preview ?? {}, 'styles.preview');
  assertStyleOptions(options.styles.interlude ?? {}, 'styles.interlude');

  if (!options.interlude) {
    return;
  }
  assertNonNegativeSafeInteger(options.interlude.minGapMs, 'interlude.minGapMs');
  if (options.interlude.marginMs !== undefined) {
    assertNonNegativeSafeInteger(options.interlude.marginMs, 'interlude.marginMs');
  }
  if (options.interlude.trailingLyricDurationMs !== undefined) {
    assertNonNegativeSafeInteger(options.interlude.trailingLyricDurationMs, 'interlude.trailingLyricDurationMs');
  }
  if (options.interlude.blankGapMs !== undefined) {
    assertNonNegativeSafeInteger(options.interlude.blankGapMs, 'interlude.blankGapMs');
  }
  if (!['none', 'text', 'countdown', 'progress-bar'].includes(options.interlude.strategy)) {
    throw new RangeError(`interlude.strategy is invalid: ${String(options.interlude.strategy)}`);
  }
  if (options.interlude.style !== undefined && !/^[^,\r\n]+$/.test(options.interlude.style)) {
    throw new RangeError('interlude.style must be non-empty and cannot contain commas or line breaks');
  }
}

function quantizeBoundary(timeMs: number): number {
  return Math.round(timeMs / CENTISECOND_MS) * CENTISECOND_MS;
}

// The actual margin-adjusted, quantized [startMs, endMs) an interlude would occupy between two
// active spans, or undefined if minGapMs or post-quantization rounding leaves no room to render
// one. Centralized so a decision to shorten a lyric in anticipation of an interlude can never
// diverge from what addInterludeEvents will actually emit for that same gap.
function resolveInterludeBounds(
  prevEndMs: number,
  nextStartMs: number,
  interlude: InterludeOptions,
): { startMs: number; endMs: number } | undefined {
  if (nextStartMs - prevEndMs < interlude.minGapMs) {
    return undefined;
  }
  const marginMs = interlude.marginMs ?? DEFAULT_INTERLUDE_MARGIN_MS;
  const startMs = quantizeBoundary(prevEndMs + marginMs);
  const endMs = quantizeBoundary(nextStartMs - marginMs);
  return endMs > startMs ? { startMs, endMs } : undefined;
}

function escapeAssText(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}')
    .replace(/\r\n|\r|\n/g, '\\N');
}

function karaokeTag(effect: KaraokeEffect): string | undefined {
  switch (effect) {
    case 'instant':
      return 'k';
    case 'sweep':
      return 'kf';
    case 'sweep-outline':
      return 'ko';
    case 'none':
      return undefined;
  }
}

function createStyle(name: string, layout: LayoutOptions, options: PlanStyleOptions): AssStyle {
  return {
    name,
    fontName: options.fontName ?? 'Arial',
    fontSize: options.fontSize ?? 28,
    primaryColor: assColorFromHex(options.primaryColor ?? '#FFFFFF'),
    secondaryColor: assColorFromHex(options.secondaryColor ?? '#808080'),
    outlineColor: assColorFromHex(options.outlineColor ?? '#000000'),
    backColor: assColorFromHex(options.backColor ?? '#000000', options.backOpacity ?? 0),
    shadow: options.shadow ?? 0,
    alignment: options.alignment ?? layout.alignment,
    marginLeft: options.marginLeft ?? layout.marginLeft,
    marginRight: options.marginRight ?? layout.marginRight,
    marginVertical: options.marginVertical ?? layout.marginVertical,
  };
}

function alignmentTag(alignment: AssStyle['alignment']): string {
  return `{\\an${alignment}}`;
}

/** `\fad(in,out)` tag for an event of `durationMs`; empty when both durations are 0. Scaled down if their sum would exceed the event's own duration, so the line still reaches full opacity. */
function fadeTag(fadeInMs: number, fadeOutMs: number, durationMs: number): string {
  if (fadeInMs <= 0 && fadeOutMs <= 0) {
    return '';
  }
  const totalMs = fadeInMs + fadeOutMs;
  const scale = totalMs > durationMs && totalMs > 0 ? durationMs / totalMs : 1;
  // Round fadeIn, then derive fadeOut as its complement so the rounded pair's sum can never exceed the scaled total.
  const roundedFadeInMs = Math.round(fadeInMs * scale);
  const roundedFadeOutMs = Math.round(totalMs * scale) - roundedFadeInMs;
  return `{\\fad(${roundedFadeInMs},${roundedFadeOutMs})}`;
}

// A count-in of dots, each getting its own \k slice, so they light up one by one across the
// pre-roll gap and the last one clears exactly as the first real syllable begins.
function preSweepText(tag: string, leadingDurationMs: number): string {
  let text = '';
  let allocatedMs = 0;
  for (let dotIndex = 0; dotIndex < PRE_SWEEP_DOT_COUNT; dotIndex++) {
    const targetMs = quantizeBoundary((leadingDurationMs * (dotIndex + 1)) / PRE_SWEEP_DOT_COUNT);
    const durationCentiseconds = (targetMs - allocatedMs) / CENTISECOND_MS;
    text += `{\\${tag}${durationCentiseconds}}${PRE_SWEEP_DOT_CHAR}`;
    allocatedMs = targetMs;
  }
  return `${text} `;
}

interface KaraokeTextResult {
  text: string;
  /** Whether the pre-sweep dot count-in (not just the plain empty syllable) was rendered. */
  showedPreSweep: boolean;
}

// A leading pre-token segment (before the first enhanced tag) can be whitespace-only padding rather
// than sung text, so the first *sung* word may start later than segments[0]. Drops any such leading
// padding (falling back to the original segments if every one is whitespace-only, which shouldn't
// happen for valid lyrics) so callers consistently treat the first non-whitespace segment as the start.
function sungSegments(
  segments: NonNullable<NormalizedLyrics['occurrences'][number]['segments']>,
): NonNullable<NormalizedLyrics['occurrences'][number]['segments']> {
  const firstSungIndex = segments.findIndex((segment) => segment.text.trim().length > 0);
  return firstSungIndex <= 0 ? segments : segments.slice(firstSungIndex);
}

function karaokeText(
  text: string,
  segments: NormalizedLyrics['occurrences'][number]['segments'],
  sourceStartMs: number,
  eventStartMs: number,
  eventEndMs: number,
  effect: KaraokeEffect,
  showPreSweep: boolean,
): KaraokeTextResult {
  const tag = karaokeTag(effect);
  if (!tag || !segments || segments.length === 0) {
    return { text: escapeAssText(text), showedPreSweep: false };
  }

  // Leading whitespace-only padding is folded into leadingTag below instead of rendered as its own
  // (otherwise duplicate) invisible syllable.
  const renderedSegments = sungSegments(segments);
  const firstSegmentStartMs = Math.min(
    eventEndMs,
    Math.max(eventStartMs, quantizeBoundary(sourceStartMs + renderedSegments[0].timeMs)),
  );
  const leadingDurationMs = firstSegmentStartMs - eventStartMs;
  const showedPreSweep = leadingDurationMs >= PRE_SWEEP_MIN_DURATION_MS && showPreSweep;
  const leadingTag = leadingDurationMs <= 0
    ? ''
    : showedPreSweep
      ? preSweepText(tag, leadingDurationMs)
      : `{\\${tag}${leadingDurationMs / CENTISECOND_MS}}`;

  const karaokeSegments = leadingTag + renderedSegments.map((segment, index) => {
    const segmentStart = Math.min(eventEndMs, Math.max(eventStartMs, quantizeBoundary(sourceStartMs + segment.timeMs)));
    const nextSegment = renderedSegments[index + 1];
    const segmentEnd = nextSegment
      ? Math.min(eventEndMs, Math.max(segmentStart, quantizeBoundary(sourceStartMs + nextSegment.timeMs)))
      : eventEndMs;
    const durationCentiseconds = (segmentEnd - segmentStart) / CENTISECOND_MS;
    // Some enhanced-LRC generators pad tags with a space on both sides; since a {\k} tag renders invisibly,
    // a trailing space on one segment plus a leading space on the next would visually double up. Only drop
    // this segment's trailing space when there's no next segment (outer padding) or the next one also has
    // its own leading space; otherwise this is the only word separator between them. Also drop the very
    // first segment's leading space (outer padding).
    const trimTrailingSpace = nextSegment === undefined || /^\s/.test(nextSegment.text);
    let segmentText = trimTrailingSpace ? segment.text.trimEnd() : segment.text;
    if (index === 0) {
      segmentText = segmentText.trimStart();
    }
    return `{\\${tag}${durationCentiseconds}}${escapeAssText(segmentText)}`;
  }).join('');
  // Tags contain no spaces, so collapsing runs of 2+ spaces in the assembled string is safe.
  return { text: collapseSpaces(karaokeSegments), showedPreSweep };
}

function collapseSpaces(text: string): string {
  return text.replace(/ {2,}/g, ' ');
}

// Static (non-animated) equivalent of preSweepText's dot run, for a Preview event to match the
// character layout its own Lyrics event will show once promoted, so nothing visually shifts at handoff.
const PRE_SWEEP_STATIC_PREFIX = `${PRE_SWEEP_DOT_CHAR.repeat(PRE_SWEEP_DOT_COUNT)} `;

function lyricEndMs(
  occurrence: NormalizedLyrics['occurrences'][number],
  nextOccurrenceStartMs: number | undefined,
  options: ResolvedPlanOptions,
): number {
  const trailingDurationMs = options.interlude?.strategy === 'none'
    ? undefined
    : options.interlude?.trailingLyricDurationMs;
  // Nothing follows to occupy the gap (end of file, or gap too small for an interlude), so don't create unlabeled dead air.
  if (trailingDurationMs === undefined || nextOccurrenceStartMs === undefined) {
    return occurrence.endMs;
  }

  const finalSegment = occurrence.segments?.at(-1);
  const anchorMs = finalSegment ? occurrence.startMs + finalSegment.timeMs : occurrence.startMs;
  const clampedEndMs = Math.min(occurrence.endMs, anchorMs + trailingDurationMs);
  if (!resolveInterludeBounds(clampedEndMs, nextOccurrenceStartMs, options.interlude!)) {
    return occurrence.endMs;
  }
  return clampedEndMs;
}

/** The moment a lyric's first sung word actually occurs, per its enhanced segment timing (or its own timestamp if plain). */
function effectiveSungStartMs(occurrence: NormalizedLyrics['occurrences'][number]): number {
  const firstSegment = occurrence.segments && occurrence.segments.length > 0
    ? sungSegments(occurrence.segments)[0]
    : undefined;
  return firstSegment ? occurrence.startMs + firstSegment.timeMs : occurrence.startMs;
}

// Real stretches where nothing is genuinely being sung, long enough to warrant an interlude —
// mirrors addInterludeEvents' own gap detection, but checks each occurrence's actual first-sung-word
// timing rather than its (possibly pre-swept, dot-prefixed) display start, since a count-in can
// visually paper over a real gap without the song itself having stopped. Used to tell a row merely
// being unused for a while (a rotation/row-count artifact) apart from an actual pause in the song,
// since with more than one row those can diverge: other rows may keep the screen busy throughout.
function computeQuietGaps(
  lyricOccurrences: Array<{ event: AssEvent; occurrence: NormalizedLyrics['occurrences'][number] }>,
  minGapMs: number,
): Array<{ startMs: number; endMs: number }> {
  // Callers sort this input by display start, but differing pre-roll/embedded-delay per
  // occurrence means that can diverge from actual sung order; re-sort here so a later-displayed
  // but earlier-sung occurrence can't be skipped past, which would fabricate a gap containing it.
  const bySungStart = [...lyricOccurrences].sort(
    (left, right) => effectiveSungStartMs(left.occurrence) - effectiveSungStartMs(right.occurrence),
  );
  const gaps: Array<{ startMs: number; endMs: number }> = [];
  let latestActiveEndMs = 0;
  for (const { event, occurrence } of bySungStart) {
    const sungStartMs = effectiveSungStartMs(occurrence);
    if (sungStartMs - latestActiveEndMs >= minGapMs) {
      gaps.push({ startMs: latestActiveEndMs, endMs: sungStartMs });
    }
    latestActiveEndMs = Math.max(latestActiveEndMs, event.endMs);
  }
  return gaps;
}

// Peak number of lyric events simultaneously on screen at once (half-open [startMs, endMs)
// overlap), independent of row assignment — used to catch inputs (e.g. duet lines sharing a
// timestamp) that need more rows than maxPreviewLines actually provides, before rotation silently
// reuses a still-active row.
function computeMaxConcurrentLyrics(sortedEvents: AssEvent[]): number {
  const activeEndTimes: number[] = [];
  let maxConcurrency = 0;
  for (const event of sortedEvents) {
    for (let index = activeEndTimes.length - 1; index >= 0; index--) {
      if (activeEndTimes[index] <= event.startMs) {
        activeEndTimes.splice(index, 1);
      }
    }
    activeEndTimes.push(event.endMs);
    maxConcurrency = Math.max(maxConcurrency, activeEndTimes.length);
  }
  return maxConcurrency;
}

// Highest endMs a same-row lingering extension may reach without spilling into a real quiet gap.
// A row's own idle window can be much wider than any actual pause within it (other rows may have
// kept the screen busy for most of that window, with only its tail overlapping real silence), so
// blocking lingering outright on any overlap would wrongly suppress it for that entire window; the
// correct ceiling is the start of the earliest overlapping quiet gap, not an all-or-nothing block.
function quietGapCeilingMs(startMs: number, endMs: number, quietGaps: Array<{ startMs: number; endMs: number }>): number {
  let ceiling = Number.POSITIVE_INFINITY;
  for (const gap of quietGaps) {
    if (gap.startMs < endMs && gap.endMs > startMs) {
      ceiling = Math.min(ceiling, gap.startMs);
    }
  }
  return ceiling;
}

// Drawing-mode (\p1) path for a rounded rectangle, local origin at its own top-left corner.
function roundedRectPath(width: number, height: number, radius: number): string {
  const r = radius;
  return `m ${r} 0 l ${width - r} 0 b ${width} 0 ${width} 0 ${width} ${r} l ${width} ${height - r} `
    + `b ${width} ${height} ${width} ${height} ${width - r} ${height} l ${r} ${height} `
    + `b 0 ${height} 0 ${height} 0 ${height - r} l 0 ${r} b 0 0 0 0 ${r} 0`;
}

function addInterludeEvents(events: AssEvent[], lyricEvents: AssEvent[], options: ResolvedPlanOptions): void {
  const interlude = options.interlude;
  if (!interlude || interlude.strategy === 'none') {
    return;
  }

  // Starts at 0 so a leading gap before the very first lyric (e.g. an instrumental intro) is detected too.
  let latestActiveEndMs = 0;
  for (const event of lyricEvents) {
    const bounds = resolveInterludeBounds(latestActiveEndMs, event.startMs, interlude);

    if (bounds) {
      const { startMs, endMs } = bounds;
      const style = interlude.style ?? INTERLUDE_STYLE_NAME;
      if (interlude.strategy === 'text') {
        events.push({ layer: 0, startMs, endMs, style, text: DEFAULT_INTERLUDE_TEXT });
      } else if (interlude.strategy === 'progress-bar') {
        const barLeft = options.layout.marginLeft;
        const barWidth = options.layout.resolutionX - options.layout.marginLeft - options.layout.marginRight;
        const barHeight = Math.min(PROGRESS_BAR_HEIGHT_PX, options.layout.resolutionY);
        const barTop = Math.round((options.layout.resolutionY - barHeight) / 2);
        const radius = Math.max(0, Math.min(PROGRESS_BAR_RADIUS_PX, barHeight / 2, barWidth / 2));
        const path = roundedRectPath(barWidth, barHeight, radius);
        const interludeStyleOptions = options.styles.interlude ?? {};
        const trackColor = assColorFromHex(interludeStyleOptions.secondaryColor ?? '#808080');
        const fillColor = assColorFromHex(interludeStyleOptions.primaryColor ?? '#FFFFFF');
        const borderColor = assColorFromHex(interludeStyleOptions.outlineColor ?? '#000000');
        events.push({
          layer: 0,
          startMs,
          endMs,
          style,
          text: `{\\p1\\an7\\pos(${barLeft},${barTop})\\shad0\\1c${trackColor}\\3c${borderColor}}${path}{\\p0}`,
        });
        events.push({
          layer: 1,
          startMs,
          endMs,
          style,
          text: `{\\p1\\an7\\pos(${barLeft},${barTop})\\shad0\\1c${fillColor}\\3c${borderColor}`
            + `\\clip(${barLeft},${barTop},${barLeft},${barTop + barHeight})`
            + `\\t(0,${endMs - startMs},\\clip(${barLeft},${barTop},${barLeft + barWidth},${barTop + barHeight}))}`
            + `${path}{\\p0}`,
        });
      } else {
        for (let countdownStartMs = startMs; countdownStartMs < endMs; countdownStartMs += 1000) {
          const countdownEndMs = Math.min(countdownStartMs + 1000, endMs);
          const secondsRemaining = Math.ceil((endMs - countdownStartMs) / 1000);
          events.push({
            layer: 0,
            startMs: countdownStartMs,
            endMs: countdownEndMs,
            style,
            text: String(secondsRemaining),
          });
        }
      }
    }

    latestActiveEndMs = Math.max(latestActiveEndMs, event.endMs);
  }
}

/**
 * Applies karaoke, layout, style, preset, and interlude options to produce an ASS document.
 */
export function planEvents(
  normalized: NormalizedLyrics,
  baseOptions: PlanOptions,
  overrideOptions?: PlanOverrideOptions,
): AssDocument {
  const options = resolvePlanOptions(baseOptions, overrideOptions);
  assertPlanOptions(options);
  const events: AssEvent[] = [];
  const lyricOccurrences: Array<{
    event: AssEvent;
    occurrence: NormalizedLyrics['occurrences'][number];
    showedPreSweep: boolean;
  }> = [];
  // Events exempted from fadeInMs/fadeOutMs at a Preview->Lyrics handoff (same row, no visual gap).
  const noFadeInEvents = new Set<AssEvent>();
  const noFadeOutEvents = new Set<AssEvent>();
  const interludeStyleName = options.interlude?.style ?? INTERLUDE_STYLE_NAME;
  const lyricsStyle = createStyle(LYRIC_STYLE_NAME, options.layout, options.styles.lyrics ?? {});
  const previewStyle = createStyle(PREVIEW_STYLE_NAME, options.layout, options.styles.preview ?? {});
  const isMultiLine = PLAN_PRESETS[options.preset].showPreview;

  const rowCount = options.maxPreviewLines + 1;
  const rowBlockTopMargin = computeRowBlockTopMargin(options.layout.resolutionY, options.layout.rowHeightPx, rowCount);
  // ASS's alignment values can't give each row its own anchor edge, so every row shares one
  // alignment and gets its own MarginV set per-event instead.
  const rowAlignment = options.layout.rowAlignment ?? previewStyle.alignment;
  const rowMarginForIndex = (index: number): number =>
    rowBlockTopMargin + (index % rowCount) * options.layout.rowHeightPx;

  // A lyric's box may start later than its own bracket timestamp when it has a large leading
  // enhanced-segment delay, deferred to just before its first sung word (never earlier than the bracket).
  const deferredStarts = normalized.occurrences.map((occurrence) =>
    quantizeBoundary(Math.max(occurrence.startMs, effectiveSungStartMs(occurrence) - options.mainLinePreRollMs)),
  );

  // Deferred starts can invert the source order, so the chronological successor (needed by
  // lyricEndMs below to judge interlude room) isn't always the next source-array occurrence. Only
  // occurrences whose own span is non-empty before any trailing-duration clamp (which can only
  // shrink it further) can end up emitted, so a collapsed one can't be a legitimate successor.
  const chronologicalOrder = deferredStarts
    .map((_, index) => index)
    .filter((index) => quantizeBoundary(normalized.occurrences[index].endMs) > deferredStarts[index])
    .sort((left, right) => deferredStarts[left] - deferredStarts[right]);
  const nextChronologicalStartMs: Array<number | undefined> = new Array(deferredStarts.length);
  // chronologicalOrder can hold several occurrences with the same deferred start (e.g. duet
  // lines); using the very next entry as a successor would then use a tied sibling's own start as
  // the gap boundary, so trailingLyricDurationMs would never apply to any but the last tied
  // member. Walk backward instead, reusing the next strictly-later start across a whole tied group.
  let nextStrictlyLaterStartMs: number | undefined;
  let previousStartMs: number | undefined;
  for (let position = chronologicalOrder.length - 1; position >= 0; position--) {
    const sourceIndex = chronologicalOrder[position];
    const startMs = deferredStarts[sourceIndex];
    if (previousStartMs !== undefined && startMs !== previousStartMs) {
      nextStrictlyLaterStartMs = previousStartMs;
    }
    nextChronologicalStartMs[sourceIndex] = nextStrictlyLaterStartMs;
    previousStartMs = startMs;
  }

  // Running max of all preceding *emitted* events' endMs (not just the immediately preceding one,
  // and not occurrences collapsed by quantization, which were never actually shown), used by the
  // pre-sweep gate below since overlapping lines can make an earlier occurrence outlast a later,
  // shorter one. Walked via chronologicalOrder, not source order, since deferred starts can make
  // a later source occurrence display before an earlier one.
  let latestActiveEndMs = -Infinity;
  for (const index of chronologicalOrder) {
    const occurrence = normalized.occurrences[index];
    const startMs = deferredStarts[index];
    const nextStartMs = nextChronologicalStartMs[index];
    const endMs = quantizeBoundary(lyricEndMs(occurrence, nextStartMs, options));
    if (endMs <= startMs) {
      continue;
    }

    // The pre-sweep count-in only earns its keep when there was genuine dead air before this
    // line; an earlier, longer-overlapping occurrence still being active also suppresses it, not
    // just the immediately preceding one. The very first line has no predecessor, so a leading
    // instrumental gap always counts.
    const showPreSweep = effectiveSungStartMs(occurrence) - latestActiveEndMs >= options.mainLinePreRollMs;

    const { text, showedPreSweep } = karaokeText(
      occurrence.text,
      occurrence.segments,
      occurrence.startMs,
      startMs,
      endMs,
      options.karaokeEffect,
      showPreSweep,
    );
    const event: AssEvent = {
      layer: 0,
      startMs,
      endMs,
      style: LYRIC_STYLE_NAME,
      text,
    };
    lyricOccurrences.push({ event, occurrence, showedPreSweep });
    events.push(event);
    latestActiveEndMs = Math.max(latestActiveEndMs, endMs);
  }

  // Deferred starts can invert the source order (a line with a long leading delay may end up
  // displayed after a later, undelayed line); row assignment and addInterludeEvents below both
  // need chronological order to reason about "previous"/gaps correctly.
  lyricOccurrences.sort((left, right) => left.event.startMs - right.event.startMs);

  if (isMultiLine) {
    // Rows normally rotate in occurrence order (row = rotation % rowCount), but whenever every
    // row's most recent occupant will have already ended before an occurrence's own natural
    // preview/appearance time — i.e. the screen would otherwise go genuinely blank, regardless of
    // whether that gap is long enough to also qualify for an interlude — the rotation restarts
    // from the top row instead of continuing wherever raw occurrence order would land it. This
    // accounts for lingerMaxMs: a same-row predecessor that would linger far enough to reach this
    // occurrence's own appearance is treated as still-visible coverage, not a blank gap.
    const effectiveRow: number[] = new Array(lyricOccurrences.length);
    const sameRowPredecessorIndex: Array<number | undefined> = new Array(lyricOccurrences.length);
    const sameRowSuccessorIndex: Array<number | undefined> = new Array(lyricOccurrences.length);
    const lastIndexForRow: Array<number | undefined> = new Array(rowCount).fill(undefined);

    const maxConcurrency = computeMaxConcurrentLyrics(lyricOccurrences.map(({ event }) => event));
    if (maxConcurrency > rowCount) {
      throw new RangeError(
        `Up to ${maxConcurrency} lyric lines are on screen at once, which exceeds the ${rowCount} `
        + `available rows (maxPreviewLines + 1 = ${options.maxPreviewLines} + 1); raise maxPreviewLines `
        + `or remove the overlapping occurrences.`,
      );
    }

    // A row being unused for a while isn't necessarily a pause in the song — other rows may keep
    // the screen busy throughout — so lingering is only skipped where a real, song-wide quiet gap
    // overlaps, not merely because this row's own next occupant happens to be a long way off.
    // Gated on blankGapMs (falling back to, and clamped by, minGapMs) rather than minGapMs alone,
    // so a real gap too short to warrant a full Interlude can still stop rows from lingering across
    // it; the clamp keeps a blankGapMs inherited from defaults harmless when a caller lowers minGapMs.
    const quietGaps = options.interlude !== undefined && options.interlude.strategy !== 'none'
      ? computeQuietGaps(
        lyricOccurrences,
        Math.min(options.interlude.blankGapMs ?? options.interlude.minGapMs, options.interlude.minGapMs),
      )
      : [];
    let rotation = 0;
    let screenBusyUntilMs = -Infinity;
    for (const [index, { event, occurrence }] of lyricOccurrences.entries()) {
      if (index > 0) {
        const naturalAppearanceMs = quantizeBoundary(effectiveSungStartMs(occurrence) - options.previewLeadMs);
        const provisionalRow = (rotation + 1) % rowCount;
        const predecessorIndex = lastIndexForRow[provisionalRow];
        // A non-mutating estimate of how far this same-row predecessor would linger if this
        // occurrence turns out to be its real successor; the actual lingering pass below applies
        // the real extension once row assignment (and thus same-row successors) are final.
        let predecessorCoverageMs = screenBusyUntilMs;
        if (predecessorIndex !== undefined) {
          const predecessorEndMs = lyricOccurrences[predecessorIndex].event.endMs;
          const gapMs = naturalAppearanceMs - predecessorEndMs;
          const lingerCeilingMs = quietGapCeilingMs(predecessorEndMs, naturalAppearanceMs, quietGaps);
          const lingeredEndMs = gapMs > 0 && options.lingerMaxMs > 0
            ? Math.min(predecessorEndMs + Math.min(gapMs, options.lingerMaxMs), lingerCeilingMs)
            : predecessorEndMs;
          predecessorCoverageMs = Math.max(predecessorCoverageMs, lingeredEndMs);
        }
        rotation = naturalAppearanceMs > predecessorCoverageMs ? 0 : rotation + 1;
        // The above only decides a preferred starting row; it doesn't guarantee that row's last
        // occupant has actually finished (by real event time, not the linger estimate used above),
        // so advance past any row still genuinely in use until an actually free one is found.
        // maxConcurrency <= rowCount (checked above) guarantees one exists within rowCount attempts.
        for (let attempt = 0; attempt < rowCount; attempt++) {
          const candidateRow = rotation % rowCount;
          const occupantIndex = lastIndexForRow[candidateRow];
          if (occupantIndex === undefined || lyricOccurrences[occupantIndex].event.endMs <= event.startMs) {
            break;
          }
          rotation++;
        }
      }
      const row = rotation % rowCount;
      effectiveRow[index] = row;
      sameRowPredecessorIndex[index] = lastIndexForRow[row];
      if (lastIndexForRow[row] !== undefined) {
        sameRowSuccessorIndex[lastIndexForRow[row]] = index;
      }
      lastIndexForRow[row] = index;
      screenBusyUntilMs = Math.max(screenBusyUntilMs, event.endMs);
    }

    // Tag each Lyrics event with the row it occupies; a line's row never changes between its
    // preview and current appearance (only its styling swaps in place).
    for (const [index, { event }] of lyricOccurrences.entries()) {
      event.marginVertical = rowMarginForIndex(effectiveRow[index]);
      event.text = alignmentTag(rowAlignment) + event.text;
    }

    // Each occurrence's preview window is computed independently (not just one line ahead of
    // "current"), so up to rowCount-1 upcoming lines can preview simultaneously once their own
    // windows overlap. A row can't preview its next occupant until its previous one (its same-row
    // predecessor, per the rotation above) has finished being current, which also prevents
    // same-row visual overlap.
    // rowNeededAtMs[index] records when this occurrence's row starts being needed for it (its own
    // preview start, or its own Lyrics start if no preview shows), used below for lingering.
    const rowNeededAtMs: number[] = new Array(lyricOccurrences.length);
    // Caps concurrent Preview events across all rows at maxPreviewLines: since previewEndMs is
    // this occurrence's own (non-decreasing, per the earlier chronological sort) startMs, expired
    // windows can simply be pruned as we go rather than needing a full interval-scheduling pass.
    const activePreviewEndTimes: number[] = [];
    for (let index = 1; index < lyricOccurrences.length; index++) {
      const { event, occurrence, showedPreSweep } = lyricOccurrences[index];
      // Before a row's first use, nothing has ever occupied it, but a preview still shouldn't
      // appear before the very first Lyrics event of the whole song (e.g. during a leading
      // instrumental gap) since nothing would yet be on screen to accompany it.
      const predecessorIndex = sameRowPredecessorIndex[index];
      const rowFreeAtMs = predecessorIndex !== undefined
        ? lyricOccurrences[predecessorIndex].event.endMs
        : lyricOccurrences[0].event.startMs;
      let previewStartMs = Math.max(
        rowFreeAtMs,
        quantizeBoundary(effectiveSungStartMs(occurrence) - options.previewLeadMs),
      );
      const previewEndMs = event.startMs;

      for (let active = activePreviewEndTimes.length - 1; active >= 0; active--) {
        if (activePreviewEndTimes[active] <= previewStartMs) {
          activePreviewEndTimes.splice(active, 1);
        }
      }
      while (activePreviewEndTimes.length >= options.maxPreviewLines) {
        const earliestEndMs = Math.min(...activePreviewEndTimes);
        previewStartMs = Math.max(previewStartMs, earliestEndMs);
        activePreviewEndTimes.splice(activePreviewEndTimes.indexOf(earliestEndMs), 1);
      }

      rowNeededAtMs[index] = event.startMs;
      if (previewEndMs > previewStartMs) {
        activePreviewEndTimes.push(previewEndMs);
        const previewEvent: AssEvent = {
          layer: -1,
          startMs: previewStartMs,
          endMs: previewEndMs,
          style: PREVIEW_STYLE_NAME,
          marginVertical: rowMarginForIndex(effectiveRow[index]),
          // Same row this occurrence's own Lyrics event will use, so it doesn't move when promoted to current.
          // Mirrors its own Lyrics event's pre-sweep dot prefix (static here) so nothing shifts at handoff.
          text: alignmentTag(rowAlignment)
            + (showedPreSweep ? PRE_SWEEP_STATIC_PREFIX : '')
            + escapeAssText(occurrence.text),
        };
        events.push(previewEvent);
        // The preview hands off to its own Lyrics event at the same instant with no visual gap
        // (same row, same line), so fading out/in right at that handoff would be a distracting
        // flicker; only fade in when the line first appears, and out when it truly leaves the screen.
        noFadeOutEvents.add(previewEvent);
        noFadeInEvents.add(event);
        rowNeededAtMs[index] = previewStartMs;
      }
    }

    // An already-sung line can keep showing on its row to fill what would otherwise be dead time
    // before that row's next occupant needs it, capped at lingerMaxMs and skipped for gaps long
    // enough to warrant an interlude instead (mirrors addInterludeEvents' own strategy check).
    if (options.lingerMaxMs > 0) {
      for (let index = 0; index < lyricOccurrences.length; index++) {
        const successorIndex = sameRowSuccessorIndex[index];
        if (successorIndex === undefined) {
          continue;
        }
        const current = lyricOccurrences[index].event;
        const gapMs = rowNeededAtMs[successorIndex] - current.endMs;
        if (gapMs > 0) {
          const lingerCeilingMs = quietGapCeilingMs(current.endMs, rowNeededAtMs[successorIndex], quietGaps);
          current.endMs = Math.min(current.endMs + Math.min(gapMs, options.lingerMaxMs), lingerCeilingMs);
        }
      }
    }
  }

  addInterludeEvents(events, lyricOccurrences.map(({ event }) => event), options);

  if (options.fadeInMs > 0 || options.fadeOutMs > 0) {
    for (const event of events) {
      const fadeInMs = noFadeInEvents.has(event) ? 0 : options.fadeInMs;
      const fadeOutMs = noFadeOutEvents.has(event) ? 0 : options.fadeOutMs;
      event.text = fadeTag(fadeInMs, fadeOutMs, event.endMs - event.startMs) + event.text;
    }
  }

  const orderedEvents = events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => left.event.startMs - right.event.startMs
      || left.event.layer - right.event.layer
      || left.index - right.index)
    .map(({ event }) => event);

  return {
    scriptInfo: {
      playResX: options.layout.resolutionX,
      playResY: options.layout.resolutionY,
    },
    styles: [
      lyricsStyle,
      previewStyle,
      createStyle(INTERLUDE_STYLE_NAME, options.layout, options.styles.interlude ?? {}),
      ...(interludeStyleName === LYRIC_STYLE_NAME
        || interludeStyleName === PREVIEW_STYLE_NAME
        || interludeStyleName === INTERLUDE_STYLE_NAME
        ? []
        : [createStyle(interludeStyleName, options.layout, options.styles.interlude ?? {})]),
    ],
    events: orderedEvents,
  };
}
