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
        fontSize: 24,
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
        outlineColor: '#000000',
        backColor: '#000000',
        backOpacity: 0,
      }),
      preview: Object.freeze({
        fontName: 'Arial',
        fontSize: 24,
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
    alignment: options.alignment ?? layout.alignment,
    marginLeft: options.marginLeft ?? layout.marginLeft,
    marginRight: options.marginRight ?? layout.marginRight,
    marginVertical: options.marginVertical ?? layout.marginVertical,
  };
}

function karaokeText(
  text: string,
  segments: NormalizedLyrics['occurrences'][number]['segments'],
  sourceStartMs: number,
  eventStartMs: number,
  eventEndMs: number,
  effect: KaraokeEffect,
): string {
  const tag = karaokeTag(effect);
  if (!tag || !segments || segments.length === 0) {
    return escapeAssText(text);
  }

  const firstSegmentStartMs = Math.min(
    eventEndMs,
    Math.max(eventStartMs, quantizeBoundary(sourceStartMs + segments[0].timeMs)),
  );
  const leadingDurationCentiseconds = (firstSegmentStartMs - eventStartMs) / CENTISECOND_MS;
  const leadingTag = leadingDurationCentiseconds > 0 ? `{\\${tag}${leadingDurationCentiseconds}}` : '';

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
  return collapseSpaces(karaokeSegments);
}

function collapseSpaces(text: string): string {
  return text.replace(/ {2,}/g, ' ');
}

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
  const lyricOccurrences: Array<{ event: AssEvent; occurrence: NormalizedLyrics['occurrences'][number] }> = [];
  const interludeStyleName = options.interlude?.style ?? INTERLUDE_STYLE_NAME;

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

    const event: AssEvent = {
      layer: 0,
      startMs,
      endMs,
      style: LYRIC_STYLE_NAME,
      text: karaokeText(
        occurrence.text,
        occurrence.segments,
        occurrence.startMs,
        startMs,
        endMs,
        options.karaokeEffect,
      ),
    };
    lyricOccurrences.push({ event, occurrence });
    events.push(event);
  }

  if (PLAN_PRESETS[options.preset].showPreview) {
    for (let index = 0; index < lyricOccurrences.length - 1; index++) {
      const current = lyricOccurrences[index].event;
      const next = lyricOccurrences[index + 1];
      const previewStartMs = Math.max(
        current.startMs,
        quantizeBoundary(effectiveSungStartMs(next.occurrence) - options.previewLeadMs),
      );
      const previewEndMs = next.event.startMs;
      if (previewEndMs > previewStartMs) {
        events.push({
          layer: -1,
          startMs: previewStartMs,
          endMs: previewEndMs,
          style: PREVIEW_STYLE_NAME,
          text: escapeAssText(next.occurrence.text),
        });
      }
    }
  }

  addInterludeEvents(events, lyricOccurrences.map(({ event }) => event), options);
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
      createStyle(LYRIC_STYLE_NAME, options.layout, options.styles.lyrics ?? {}),
      createStyle(PREVIEW_STYLE_NAME, options.layout, options.styles.preview ?? {}),
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
