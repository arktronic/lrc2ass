import type {
  AssDocument,
  AssEvent,
  AssStyle,
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
const MULTI_LINE_LINE_HEIGHT_PX = 22; // approximate rendered line height at fontSize 28
const PRE_SWEEP_DOT_CHAR = '\u00B7';
const PRE_SWEEP_DOT_COUNT = 4;
/** Hard cap on maxPreviewLines; keeps the multi-line preset's row stack to a sane, readable size. */
const MAX_PREVIEW_LINES_CAP = 8;

// The multi-line preset's rows share one evenly-spaced block: this is the offset from the block's
// anchored edge to its first row. For the default 2-row case, an8 (top row) measures it from the
// top edge and an2 (bottom row) measures it from the bottom edge, so this single value centers both
// rows toward/away from each other at once (twice as fast as either edge alone).
function computeRowBlockTopMargin(resolutionY: number, rowGapPx: number, rowCount: number): number {
  return Math.round((resolutionY - rowCount * MULTI_LINE_LINE_HEIGHT_PX - (rowCount - 1) * rowGapPx) / 2);
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
  for (const margin of ['marginLeft', 'marginRight', 'marginVertical', 'rowGapPx'] as const) {
    assertNonNegativeSafeInteger(options.layout[margin], `layout.${margin}`);
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
  if (!['none', 'text', 'countdown'].includes(options.interlude.strategy)) {
    throw new RangeError(`interlude.strategy is invalid: ${String(options.interlude.strategy)}`);
  }
  if (options.interlude.style !== undefined && !/^[^,\r\n]+$/.test(options.interlude.style)) {
    throw new RangeError('interlude.style must be non-empty and cannot contain commas or line breaks');
  }
}

function quantizeBoundary(timeMs: number): number {
  return Math.round(timeMs / CENTISECOND_MS) * CENTISECOND_MS;
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
  return `{\\fad(${Math.round(fadeInMs * scale)},${Math.round(fadeOutMs * scale)})}`;
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

  const firstSegmentStartMs = Math.min(
    eventEndMs,
    Math.max(eventStartMs, quantizeBoundary(sourceStartMs + segments[0].timeMs)),
  );
  const leadingDurationMs = firstSegmentStartMs - eventStartMs;
  const showedPreSweep = leadingDurationMs > 0 && showPreSweep;
  const leadingTag = leadingDurationMs <= 0
    ? ''
    : showedPreSweep
      ? preSweepText(tag, leadingDurationMs)
      : `{\\${tag}${leadingDurationMs / CENTISECOND_MS}}`;

  const karaokeSegments = leadingTag + segments.map((segment, index) => {
    const segmentStart = Math.min(eventEndMs, Math.max(eventStartMs, quantizeBoundary(sourceStartMs + segment.timeMs)));
    const nextSegment = segments[index + 1];
    const segmentEnd = nextSegment
      ? Math.min(eventEndMs, Math.max(segmentStart, quantizeBoundary(sourceStartMs + nextSegment.timeMs)))
      : eventEndMs;
    const durationCentiseconds = (segmentEnd - segmentStart) / CENTISECOND_MS;
    // Some enhanced-LRC generators pad tags with a space on both sides; since a {\k} tag renders invisibly,
    // a trailing space on one segment plus a leading space on the next would visually double up. Keep only
    // the next segment's leading space as the word separator, and drop the very first segment's leading space.
    let segmentText = segment.text.trimEnd();
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
  if (nextOccurrenceStartMs - clampedEndMs < options.interlude!.minGapMs) {
    return occurrence.endMs;
  }
  return clampedEndMs;
}

/** The moment a lyric's first sung word actually occurs, per its enhanced segment timing (or its own timestamp if plain). */
function effectiveSungStartMs(occurrence: NormalizedLyrics['occurrences'][number]): number {
  const firstSegment = occurrence.segments?.[0];
  return firstSegment ? occurrence.startMs + firstSegment.timeMs : occurrence.startMs;
}

function addInterludeEvents(events: AssEvent[], lyricEvents: AssEvent[], options: ResolvedPlanOptions): void {
  const interlude = options.interlude;
  if (!interlude || interlude.strategy === 'none') {
    return;
  }

  const marginMs = interlude.marginMs ?? DEFAULT_INTERLUDE_MARGIN_MS;
  // Starts at 0 so a leading gap before the very first lyric (e.g. an instrumental intro) is detected too.
  let latestActiveEndMs = 0;
  for (const event of lyricEvents) {
    if (event.startMs - latestActiveEndMs >= interlude.minGapMs) {
      const startMs = quantizeBoundary(latestActiveEndMs + marginMs);
      const endMs = quantizeBoundary(event.startMs - marginMs);

      if (endMs > startMs) {
        const style = interlude.style ?? INTERLUDE_STYLE_NAME;
        if (interlude.strategy === 'text') {
          events.push({ layer: 0, startMs, endMs, style, text: DEFAULT_INTERLUDE_TEXT });
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
  const rowBlockTopMargin = computeRowBlockTopMargin(options.layout.resolutionY, options.layout.rowGapPx, rowCount);
  // ASS's alignment values can't give each row its own anchor edge, so every row shares one
  // alignment (the preview style's) and gets its own MarginV set per-event instead.
  const rowMarginForIndex = (index: number): number =>
    rowBlockTopMargin + (index % rowCount) * (MULTI_LINE_LINE_HEIGHT_PX + options.layout.rowGapPx);

  // A lyric's box may start later than its own bracket timestamp when it has a large leading
  // enhanced-segment delay, deferred to just before its first sung word (never earlier than the bracket).
  const deferredStarts = normalized.occurrences.map((occurrence) =>
    quantizeBoundary(Math.max(occurrence.startMs, effectiveSungStartMs(occurrence) - options.mainLinePreRollMs)),
  );

  for (const [index, occurrence] of normalized.occurrences.entries()) {
    const startMs = deferredStarts[index];
    const nextStartMs = deferredStarts[index + 1];
    const endMs = quantizeBoundary(lyricEndMs(occurrence, nextStartMs, options));
    if (endMs <= startMs) {
      continue;
    }

    // The pre-sweep count-in only earns its keep when there was genuine dead air before this
    // line; a previous line ending right up against this one's start shouldn't get a flicker.
    // The very first line has no predecessor, so a leading instrumental gap always counts.
    const previousEndMs = index > 0 ? normalized.occurrences[index - 1].endMs : -Infinity;
    const showPreSweep = effectiveSungStartMs(occurrence) - previousEndMs >= options.mainLinePreRollMs;

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
  }

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
          const isLongPause = options.interlude !== undefined
            && options.interlude.strategy !== 'none'
            && gapMs >= options.interlude.minGapMs;
          const lingeredEndMs = gapMs > 0 && !isLongPause && options.lingerMaxMs > 0
            ? predecessorEndMs + Math.min(gapMs, options.lingerMaxMs)
            : predecessorEndMs;
          predecessorCoverageMs = Math.max(predecessorCoverageMs, lingeredEndMs);
        }
        rotation = naturalAppearanceMs > predecessorCoverageMs ? 0 : rotation + 1;
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
      event.text = alignmentTag(previewStyle.alignment) + event.text;
    }

    // Each occurrence's preview window is computed independently (not just one line ahead of
    // "current"), so up to rowCount-1 upcoming lines can preview simultaneously once their own
    // windows overlap. A row can't preview its next occupant until its previous one (its same-row
    // predecessor, per the rotation above) has finished being current, which also prevents
    // same-row visual overlap.
    // rowNeededAtMs[index] records when this occurrence's row starts being needed for it (its own
    // preview start, or its own Lyrics start if no preview shows), used below for lingering.
    const rowNeededAtMs: number[] = new Array(lyricOccurrences.length);
    for (let index = 1; index < lyricOccurrences.length; index++) {
      const { event, occurrence, showedPreSweep } = lyricOccurrences[index];
      // Before a row's first use, nothing has ever occupied it, but a preview still shouldn't
      // appear before the very first Lyrics event of the whole song (e.g. during a leading
      // instrumental gap) since nothing would yet be on screen to accompany it.
      const predecessorIndex = sameRowPredecessorIndex[index];
      const rowFreeAtMs = predecessorIndex !== undefined
        ? lyricOccurrences[predecessorIndex].event.endMs
        : lyricOccurrences[0].event.startMs;
      const previewStartMs = Math.max(
        rowFreeAtMs,
        quantizeBoundary(effectiveSungStartMs(occurrence) - options.previewLeadMs),
      );
      const previewEndMs = event.startMs;
      rowNeededAtMs[index] = event.startMs;
      if (previewEndMs > previewStartMs) {
        const previewEvent: AssEvent = {
          layer: -1,
          startMs: previewStartMs,
          endMs: previewEndMs,
          style: PREVIEW_STYLE_NAME,
          marginVertical: rowMarginForIndex(effectiveRow[index]),
          // Same row this occurrence's own Lyrics event will use, so it doesn't move when promoted to current.
          // Mirrors its own Lyrics event's pre-sweep dot prefix (static here) so nothing shifts at handoff.
          text: alignmentTag(previewStyle.alignment)
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
        const isLongPause = options.interlude !== undefined
          && options.interlude.strategy !== 'none'
          && gapMs >= options.interlude.minGapMs;
        if (gapMs > 0 && !isLongPause) {
          current.endMs += Math.min(gapMs, options.lingerMaxMs);
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
