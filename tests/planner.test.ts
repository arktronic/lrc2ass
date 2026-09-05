import { describe, expect, it } from 'vitest';
import { planEvents } from '../src/index.js';
import type { NormalizedLyrics, PlanOptions } from '../src/index.js';

const options: PlanOptions = {
  karaokeEffect: 'none',
  mainLinePreRollMs: 1000,
  previewLeadMs: 4000,
  fadeInMs: 0,
  fadeOutMs: 0,
  maxPreviewLines: 1,
  lingerMaxMs: 0,
  layout: {
    resolutionX: 384,
    resolutionY: 288,
    alignment: 2,
    marginLeft: 10,
    marginRight: 10,
    marginVertical: 10,
    rowGapPx: 8,
  },
};

describe('planEvents', () => {
  it('creates a styled, escaped dialogue event from a plain lyric', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [{ startMs: 15, endMs: 1_044, text: 'a{b}\\c\nd\re\r\nf' }],
    };

    const document = planEvents(normalized, options);

    expect(document.scriptInfo).toEqual({ playResX: 384, playResY: 288 });
    expect(document.styles.map((style) => style.name)).toEqual(['Lyrics', 'Preview', 'Interlude']);
    expect(document.events).toEqual([
      { layer: 0, startMs: 20, endMs: 1_040, style: 'Lyrics', text: 'a\\{b\\}\\\\c\\Nd\\Ne\\Nf' },
    ]);
  });

  it('preserves base values when overrides are undefined and applies defined layout overrides', () => {
    const document = planEvents(
      { occurrences: [] },
      options,
      { karaokeEffect: undefined, layout: { alignment: 8, marginLeft: undefined } },
    );

    expect(document.styles[0]).toMatchObject({ alignment: 8, marginLeft: 10, marginRight: 10 });
  });

  it('merges defined interlude overrides with inherited settings', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 5_000, text: 'First' },
        { startMs: 10_000, endMs: 12_000, text: 'Second' },
      ],
    };

    const document = planEvents(
      normalized,
      {
        ...options,
        interlude: {
          minGapMs: 1_000,
          strategy: 'text',
          marginMs: 500,
          style: 'Inherited',
          trailingLyricDurationMs: 5_000,
        },
      },
      { interlude: { minGapMs: 2_000, strategy: 'countdown' } },
    );

    expect(document.styles.map((style) => style.name)).toContain('Inherited');
    expect(document.events.filter((event) => event.style === 'Inherited')).toEqual([
      { layer: 0, startMs: 5_500, endMs: 6_500, style: 'Inherited', text: '4' },
      { layer: 0, startMs: 6_500, endMs: 7_500, style: 'Inherited', text: '3' },
      { layer: 0, startMs: 7_500, endMs: 8_500, style: 'Inherited', text: '2' },
      { layer: 0, startMs: 8_500, endMs: 9_500, style: 'Inherited', text: '1' },
    ]);
  });

  it('resolves preset defaults before base and caller style overrides', () => {
    const document = planEvents(
      { occurrences: [] },
      {
        ...options,
        preset: 'multi-line',
        styles: { preview: { fontName: 'Base Font', primaryColor: '#112233' } },
      },
      { styles: { preview: { fontSize: 18, primaryColor: '#445566' } } },
    );

    expect(document.styles.find((style) => style.name === 'Preview')).toMatchObject({
      fontName: 'Base Font',
      fontSize: 18,
      primaryColor: '&H00665544&',
      alignment: 8,
    });
  });

  it.each([
    ['instant', 'k'],
    ['sweep', 'kf'],
    ['sweep-outline', 'ko'],
  ] as const)('uses %s karaoke tags with durations from quantized boundaries', (karaokeEffect, tag) => {
    const normalized: NormalizedLyrics = {
      occurrences: [{
        startMs: 15,
        endMs: 74,
        text: 'onetwo',
        segments: [
          { text: 'one', timeMs: 0, location: { line: 1, column: 1 } },
          { text: 'two', timeMs: 26, location: { line: 1, column: 4 } },
        ],
      }],
    };

    const [event] = planEvents(normalized, { ...options, karaokeEffect }).events;

    expect(event).toMatchObject({ startMs: 20, endMs: 70, text: `{\\${tag}2}one{\\${tag}3}two` });
  });

  it('trims padding whitespace from the outer edges of karaoke segments without collapsing interior spacing', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [{
        startMs: 0,
        endMs: 100,
        text: ' Foo  bar ',
        segments: [
          { text: ' Foo ', timeMs: 0, location: { line: 1, column: 1 } },
          { text: ' bar ', timeMs: 50, location: { line: 1, column: 7 } },
        ],
      }],
    };

    const [event] = planEvents(normalized, { ...options, karaokeEffect: 'sweep' }).events;

    expect(event.text).toBe('{\\kf5}Foo{\\kf5} bar');
  });

  it('encodes a leading enhanced-timestamp delay as an empty karaoke syllable', () => {
    const [event] = planEvents({
      occurrences: [{
        startMs: 10_000,
        endMs: 12_000,
        text: 'Hello',
        segments: [{ text: 'Hello', timeMs: 500, location: { line: 1, column: 1 } }],
      }],
    }, { ...options, karaokeEffect: 'sweep' }).events;

    // First line, so its leading gap is always pre-sweep-eligible (no predecessor to compare against).
    expect(event.text).toBe('{\\kf13}\u00B7{\\kf12}\u00B7{\\kf13}\u00B7{\\kf12}\u00B7 {\\kf150}Hello');
  });

  it('defers a lyric event start when its leading enhanced-segment delay exceeds mainLinePreRollMs', () => {
    const [event] = planEvents({
      occurrences: [{
        startMs: 0,
        endMs: 20_000,
        text: 'La la la',
        segments: [{ text: 'La la la', timeMs: 15_000, location: { line: 1, column: 1 } }],
      }],
    }, { ...options, karaokeEffect: 'sweep' }).events;

    // 15_000ms delay minus the 1_000ms default pre-roll = starts at 14_000ms instead of 0.
    expect(event.startMs).toBe(14_000);
    // First line, so its leading gap is always pre-sweep-eligible (no predecessor to compare against).
    expect(event.text).toBe('{\\kf25}\u00B7{\\kf25}\u00B7{\\kf25}\u00B7{\\kf25}\u00B7 {\\kf500}La la la');
  });

  it('shows a pre-sweep dot count-in when the gap since the previous line is at least mainLinePreRollMs', () => {
    const [, second] = planEvents({
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        {
          startMs: 1_000,
          endMs: 3_000,
          text: 'Second',
          segments: [{ text: 'Second', timeMs: 1_000, location: { line: 1, column: 1 } }],
        },
      ],
    }, { ...options, karaokeEffect: 'sweep' }).events;

    // Gap from First's endMs (1_000) to Second's sung start (2_000) is 1_000ms, meeting mainLinePreRollMs.
    expect(second.text).toBe('{\\kf25}\u00B7{\\kf25}\u00B7{\\kf25}\u00B7{\\kf25}\u00B7 {\\kf100}Second');
  });

  it('does not show a pre-sweep dot count-in when the gap since the previous line is too short', () => {
    const [, second] = planEvents({
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        {
          startMs: 1_000,
          endMs: 2_500,
          text: 'Second',
          segments: [{ text: 'Second', timeMs: 500, location: { line: 1, column: 1 } }],
        },
      ],
    }, { ...options, karaokeEffect: 'sweep' }).events;

    // Gap from First's endMs (1_000) to Second's sung start (1_500) is only 500ms, under mainLinePreRollMs.
    expect(second.text).toBe('{\\kf50}{\\kf100}Second');
  });

  it("mirrors a line's pre-sweep dot prefix in its own Preview event so text doesn't shift at handoff", () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        {
          startMs: 1_000,
          endMs: 3_000,
          text: 'Second',
          segments: [{ text: 'Second', timeMs: 1_000, location: { line: 1, column: 1 } }],
        },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line', karaokeEffect: 'sweep' });

    const preview = document.events.find((event) => event.style === 'Preview');
    expect(preview?.text).toBe('{\\an8}\u00B7\u00B7\u00B7\u00B7 Second');
  });

  it('does not add a dot prefix to a Preview event when its line has no pre-sweep', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        {
          startMs: 1_000,
          endMs: 2_500,
          text: 'Second',
          segments: [{ text: 'Second', timeMs: 500, location: { line: 1, column: 1 } }],
        },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line', karaokeEffect: 'sweep' });

    const preview = document.events.find((event) => event.style === 'Preview');
    expect(preview?.text).toBe('{\\an8}Second');
  });

  it('does not defer a lyric event start when there is no leading delay', () => {
    const [event] = planEvents({
      occurrences: [{
        startMs: 5_000,
        endMs: 8_000,
        text: 'Hello',
        segments: [{ text: 'Hello', timeMs: 0, location: { line: 1, column: 1 } }],
      }],
    }, { ...options, karaokeEffect: 'sweep' }).events;

    expect(event.startMs).toBe(5_000);
  });

  it('adds a next-line preview for the multi-line preset', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'Current' },
        { startMs: 2_000, endMs: 3_000, text: 'Next' },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line' });

    expect(document.events).toContainEqual({
      layer: -1,
      startMs: 0,
      endMs: 2_000,
      style: 'Preview',
      marginVertical: 148,
      text: '{\\an8}Next',
    });
  });

  it('bounds a next-line preview to previewLeadMs before a delayed next lyric, instead of spanning the whole prior gap', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'Current' },
        {
          startMs: 20_000,
          endMs: 40_000,
          text: 'La la la',
          segments: [{ text: 'La la la', timeMs: 15_000, location: { line: 1, column: 1 } }],
        },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line', karaokeEffect: 'sweep' });

    // Next lyric's effective sung-start is 35_000ms (20_000 + 15_000); preview shows for the
    // 4_000ms previewLeadMs before that, ending when the (pre-rolled) next lyric box begins. The
    // ~30s gap before that is a genuine full blank, so "La la la" resets to the top row (row 0)
    // instead of continuing the raw rotation to row 1.
    expect(document.events).toContainEqual({
      layer: -1,
      startMs: 31_000,
      endMs: 34_000,
      style: 'Preview',
      marginVertical: 118,
      text: '{\\an8}\u00B7\u00B7\u00B7\u00B7 La la la',
    });
  });

  it('emits one future preview for a simultaneous active lyric group', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'Singer one' },
        { startMs: 0, endMs: 1_000, text: 'Singer two' },
        { startMs: 2_000, endMs: 3_000, text: 'Next line' },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line' });

    // "Next line" reuses "Singer one"'s row (occurrence index 2 mod rowCount 2 = 0), so its preview
    // can't start until that row frees up at 1_000, even though "Singer two" started earlier at 0.
    expect(document.events.filter((event) => event.style === 'Preview')).toEqual([
      { layer: -1, startMs: 1_000, endMs: 2_000, style: 'Preview', marginVertical: 118, text: '{\\an8}Next line' },
    ]);
    expect(document.events.slice(0, 3).map((event) => event.style)).toEqual(['Lyrics', 'Lyrics', 'Preview']);
    // Simultaneous occurrences alternate rows via marginVertical; alignment tag stays the same.
    const [singerOne, singerTwo] = document.events.filter((event) => event.style === 'Lyrics');
    expect(singerOne.text).toBe('{\\an8}Singer one');
    expect(singerTwo.text).toBe('{\\an8}Singer two');
    expect(singerOne.marginVertical).not.toBe(singerTwo.marginVertical);
  });

  it('alternates row marginVertical across consecutive lyric lines for the multi-line preset', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 2_000, endMs: 3_000, text: 'Second' },
        { startMs: 4_000, endMs: 5_000, text: 'Third' },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line' });

    const lyricEvents = document.events.filter((event) => event.style === 'Lyrics');
    // Every row shares the same alignment tag; only the per-event MarginV distinguishes rows.
    expect(lyricEvents.map((event) => event.text)).toEqual(['{\\an8}First', '{\\an8}Second', '{\\an8}Third']);
    expect(lyricEvents.map((event) => event.marginVertical)).toEqual([118, 148, 118]);
  });

  it('starts the first lyric on the top row even after a leading interlude gap', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 20_000, endMs: 21_000, text: 'First' },
        { startMs: 22_000, endMs: 23_000, text: 'Second' },
      ],
    };

    const document = planEvents(normalized, {
      ...options,
      preset: 'multi-line',
      interlude: { minGapMs: 1_000, strategy: 'text' },
    });

    expect(document.events.some((event) => event.style === 'Interlude')).toBe(true);
    const [firstLyric] = document.events.filter((event) => event.style === 'Lyrics');
    expect(firstLyric.text.startsWith('{\\an8}')).toBe(true);
  });

  it('does not preview a line before the first lyric of the song has actually started', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 20_000, endMs: 21_000, text: 'First' },
        { startMs: 22_000, endMs: 23_000, text: 'Second' },
      ],
    };

    // previewLeadMs (4_000) before "Second"'s sung-start (22_000) is 18_000, which is before
    // "First" even starts (20_000) — nothing should be on screen before that.
    const document = planEvents(normalized, { ...options, preset: 'multi-line' });

    const preview = document.events.find((event) => event.style === 'Preview');
    expect(preview?.startMs).toBe(20_000);
  });

  it('shows a preview already in the row the line keeps once promoted to current', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 2_000, endMs: 3_000, text: 'Second' },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line' });

    const preview = document.events.find((event) => event.style === 'Preview');
    const secondLyric = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('Second'));
    expect(preview?.text.slice(0, preview.text.indexOf('}') + 1)).toBe(secondLyric?.text.slice(0, secondLyric.text.indexOf('}') + 1));
  });

  it('emits no row alignment tag for the single-line preset', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [{ startMs: 0, endMs: 1_000, text: 'Solo' }],
    };

    const document = planEvents(normalized, { ...options, preset: 'single-line' });

    expect(document.events).toEqual([
      { layer: 0, startMs: 0, endMs: 1_000, style: 'Lyrics', text: 'Solo' },
    ]);
  });

  it('derives the multi-line rows\' per-event marginVertical from layout.resolutionY and layout.rowGapPx', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 1_000, endMs: 2_000, text: 'Second' },
      ],
    };

    const document = planEvents(normalized, {
      ...options,
      preset: 'multi-line',
      layout: { ...options.layout, resolutionY: 288, rowGapPx: 8 },
    });

    // topMargin = (288 - 2*22 - 1*8)/2 = 118; rows alternate 118/148.
    const lyricEvents = document.events.filter((event) => event.style === 'Lyrics');
    expect(lyricEvents.map((event) => event.marginVertical)).toEqual([118, 148]);
  });

  it('computes per-row event margins regardless of an explicit style-level marginVertical override', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 1_000, endMs: 2_000, text: 'Second' },
      ],
    };

    const document = planEvents(normalized, {
      ...options,
      preset: 'multi-line',
      styles: { lyrics: { marginVertical: 42 } },
    });

    // The style's own MarginV reflects the override (relevant for the single-line preset), but each
    // multi-line row still gets its own computed per-event MarginV, which always takes precedence.
    const lyrics = document.styles.find((style) => style.name === 'Lyrics');
    expect(lyrics?.marginVertical).toBe(42);
    const lyricEvents = document.events.filter((event) => event.style === 'Lyrics');
    expect(lyricEvents.map((event) => event.marginVertical)).toEqual([118, 148]);
  });

  it('gives every occurrence its own permanent row and per-event MarginV when maxPreviewLines > 1', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 1_000, endMs: 2_000, text: 'Second' },
        { startMs: 2_000, endMs: 3_000, text: 'Third' },
        { startMs: 3_000, endMs: 4_000, text: 'Fourth' },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line', maxPreviewLines: 3 });

    // 4 rows share resolutionY 288 at rowGapPx 8: topMargin = (288 - 4*22 - 3*8)/2 = 88.
    const lyricEvents = document.events.filter((event) => event.style === 'Lyrics');
    expect(lyricEvents.map((event) => ({ text: event.text, marginVertical: event.marginVertical }))).toEqual([
      { text: '{\\an8}First', marginVertical: 88 },
      { text: '{\\an8}Second', marginVertical: 118 },
      { text: '{\\an8}Third', marginVertical: 148 },
      { text: '{\\an8}Fourth', marginVertical: 178 },
    ]);
  });

  it('shows more than one simultaneous preview line when maxPreviewLines > 1 and lines arrive close together', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 1_000, endMs: 2_000, text: 'Second' },
        { startMs: 2_000, endMs: 3_000, text: 'Third' },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line', maxPreviewLines: 2 });

    // Both "Second" and "Third" fall within previewLeadMs (4000ms) of the song's start, and neither
    // needs to wait for a same-row predecessor (rowCount 3 > either occurrence's own index), so both
    // preview from t=0, genuinely overlapping in time on their own permanently-assigned rows.
    const previewEvents = document.events.filter((event) => event.style === 'Preview');
    expect(previewEvents).toEqual([
      { layer: -1, startMs: 0, endMs: 1_000, style: 'Preview', marginVertical: 133, text: '{\\an8}Second' },
      { layer: -1, startMs: 0, endMs: 2_000, style: 'Preview', marginVertical: 163, text: '{\\an8}Third' },
    ]);
  });

  it('previews more than one line ahead, not just the immediately next line, when they all fall within previewLeadMs', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 1_000, endMs: 2_000, text: 'Second' },
        { startMs: 2_000, endMs: 3_000, text: 'Third' },
        { startMs: 3_000, endMs: 4_000, text: 'Fourth' },
      ],
    };

    const document = planEvents(normalized, { ...options, preset: 'multi-line', maxPreviewLines: 3 });

    // With 4 permanently-assigned rows and no same-row predecessor yet, Second/Third/Fourth all
    // preview from t=0 (bounded only by previewLeadMs, here effectively unconstrained since they're
    // all within 4_000ms of the song's start) — three simultaneous previews, not just one.
    const previewTexts = document.events
      .filter((event) => event.style === 'Preview' && event.startMs === 0)
      .map((event) => event.text);
    expect(previewTexts).toEqual(['{\\an8}Second', '{\\an8}Third', '{\\an8}Fourth']);
  });

  it('delays a preview until its row frees up from its same-row predecessor', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 1_000, endMs: 2_000, text: 'Second' },
        { startMs: 2_000, endMs: 3_000, text: 'Third' },
      ],
    };

    // rowCount 2: "Third" (index 2) shares "First"'s row (index 0), so its preview can't start
    // before "First"'s own Lyrics event ends at 1_000, even though previewLeadMs would allow t=0.
    const document = planEvents(normalized, { ...options, preset: 'multi-line', maxPreviewLines: 1 });

    const thirdPreview = document.events.find((event) => event.style === 'Preview' && event.text.endsWith('Third'));
    expect(thirdPreview?.startMs).toBe(1_000);
  });

  it('resets the row rotation to the top row after a genuine full-blank gap', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 10_000, endMs: 11_000, text: 'Second' },
        { startMs: 11_000, endMs: 12_000, text: 'Third' },
      ],
    };

    // "First" ends at 1_000 and nothing shows again until 9_500 (Second's natural appearance,
    // 10_000 - 500ms previewLeadMs) — a genuine ~8.5s blank with every row empty.
    const document = planEvents(
      normalized,
      { ...options, preset: 'multi-line', maxPreviewLines: 1, previewLeadMs: 500 },
    );

    const first = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('First'));
    const secondPreview = document.events.find((event) => event.style === 'Preview' && event.text.endsWith('Second'));
    const second = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('Second'));
    const third = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('Third'));

    // "Second" (and its preview) reset to the top row instead of continuing to row 1...
    expect(secondPreview?.marginVertical).toBe(first?.marginVertical);
    expect(second?.marginVertical).toBe(first?.marginVertical);
    // ...and rotation continues normally from the reset point, so "Third" takes row 1.
    expect(third?.marginVertical).not.toBe(second?.marginVertical);
  });

  it('resets the row rotation even when the gap is too short to qualify for an interlude', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 10_000, endMs: 11_000, text: 'Second' },
      ],
    };

    const document = planEvents(normalized, {
      ...options,
      preset: 'multi-line',
      maxPreviewLines: 1,
      previewLeadMs: 500,
      interlude: { minGapMs: 20_000, strategy: 'text' },
    });

    const first = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('First'));
    const second = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('Second'));
    expect(second?.marginVertical).toBe(first?.marginVertical);
  });

  it('does not reset the row rotation when lingerMaxMs fully bridges a same-row gap', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 1_000, endMs: 2_000, text: 'Second' },
        { startMs: 2_000, endMs: 3_000, text: 'Third' },
        { startMs: 3_000, endMs: 4_000, text: 'Fourth' },
        { startMs: 6_000, endMs: 7_000, text: 'Fifth' },
      ],
    };

    // rowCount 3: "Fifth" (index 4) would reuse "Second"'s row (index 1). Its natural appearance
    // (5_500 = 6_000 - 500ms previewLeadMs) is 3_500ms after "Second"'s endMs, which fits
    // entirely within lingerMaxMs, so that row is never truly blank.
    const document = planEvents(normalized, {
      ...options,
      preset: 'multi-line',
      maxPreviewLines: 2,
      previewLeadMs: 500,
      lingerMaxMs: 4_000,
    });

    const second = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('Second'));
    const fifth = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('Fifth'));
    expect(fifth?.marginVertical).toBe(second?.marginVertical);
  });

  it('still resets the row rotation when lingerMaxMs only partially bridges a same-row gap', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 1_000, endMs: 2_000, text: 'Second' },
        { startMs: 2_000, endMs: 3_000, text: 'Third' },
        { startMs: 3_000, endMs: 4_000, text: 'Fourth' },
        { startMs: 6_000, endMs: 7_000, text: 'Fifth' },
      ],
    };

    // Same setup, but lingerMaxMs only covers 1_000ms of "Second"'s 3_500ms gap, leaving a
    // genuine blank before "Fifth" appears, so it resets to the top row instead.
    const document = planEvents(normalized, {
      ...options,
      preset: 'multi-line',
      maxPreviewLines: 2,
      previewLeadMs: 500,
      lingerMaxMs: 1_000,
    });

    const first = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('First'));
    const fifth = document.events.find((event) => event.style === 'Lyrics' && event.text.endsWith('Fifth'));
    expect(fifth?.marginVertical).toBe(first?.marginVertical);
  });

  it('rejects a maxPreviewLines outside 1-8', () => {
    expect(() => planEvents({ occurrences: [] }, { ...options, maxPreviewLines: 0 })).toThrow(RangeError);
    expect(() => planEvents({ occurrences: [] }, { ...options, maxPreviewLines: 9 })).toThrow(RangeError);
  });

  describe('lingerMaxMs', () => {
    // rowCount 2 ("First"/index0 and "Third"/index2 share a row); previewLeadMs is short enough
    // to leave a real gap between "First"'s own endMs and "Third"'s preview, but generous enough
    // that neither gap here is a genuine full-blank row-reset trigger (see the dedicated
    // "resets the row rotation..." tests below for that).
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 3_000, endMs: 4_000, text: 'Second' },
        { startMs: 6_000, endMs: 7_000, text: 'Third' },
      ],
    };
    const lingerOptions = { ...options, preset: 'multi-line' as const, maxPreviewLines: 1, previewLeadMs: 2_000 };

    it('lets a line linger all the way to its row\'s next preview when the gap fits within lingerMaxMs', () => {
      const document = planEvents(normalized, { ...lingerOptions, lingerMaxMs: 10_000 });

      const first = document.events.find((event) => event.text.endsWith('First'));
      expect(first?.endMs).toBe(4_000);
    });

    it('caps lingering at lingerMaxMs and leaves the remainder of the gap blank', () => {
      const document = planEvents(normalized, { ...lingerOptions, lingerMaxMs: 1_500 });

      const first = document.events.find((event) => event.text.endsWith('First'));
      expect(first?.endMs).toBe(2_500);
    });

    it('does not linger across a gap long enough to warrant an interlude', () => {
      const document = planEvents(normalized, {
        ...lingerOptions,
        lingerMaxMs: 10_000,
        interlude: { minGapMs: 2_000, strategy: 'text' },
      });

      const first = document.events.find((event) => event.text.endsWith('First'));
      expect(first?.endMs).toBe(1_000);
    });

    it('lingers regardless of gap size when no interlude is configured', () => {
      const document = planEvents(normalized, { ...lingerOptions, lingerMaxMs: 10_000, interlude: undefined });

      const first = document.events.find((event) => event.text.endsWith('First'));
      expect(first?.endMs).toBe(4_000);
    });

    it('does not linger when lingerMaxMs is 0 (the default fixture value)', () => {
      const document = planEvents(normalized, lingerOptions);

      const first = document.events.find((event) => event.text.endsWith('First'));
      expect(first?.endMs).toBe(1_000);
    });

    it('lingers past a row-local gap that isn\'t a real song-wide pause (other rows keep the screen busy)', () => {
      // 3 rows (A/D/E-F cycle row0, B/F cycle row1, C cycles row2). A small real gap before "E"
      // (4000->5010) triggers a row-reset that diverts what would've been row1's turn to row0
      // instead, delaying "B"'s own row1 successor ("F") well past lingerMaxMs — a rotation
      // artifact, not an actual pause: every gap between consecutive occurrences here stays under
      // minGapMs, so nothing here would ever actually become an Interlude.
      const rowSkipFixture: NormalizedLyrics = {
        occurrences: [
          { startMs: 0, endMs: 1_000, text: 'A' },
          { startMs: 1_000, endMs: 2_000, text: 'B' },
          { startMs: 2_000, endMs: 3_000, text: 'C' },
          { startMs: 3_000, endMs: 4_000, text: 'D' },
          { startMs: 5_010, endMs: 6_010, text: 'E' },
          { startMs: 6_010, endMs: 7_010, text: 'F' },
        ],
      };

      const document = planEvents(rowSkipFixture, {
        ...options,
        preset: 'multi-line',
        maxPreviewLines: 2,
        previewLeadMs: 0,
        lingerMaxMs: 3_000,
        interlude: { minGapMs: 4_000, strategy: 'text' },
      });

      const b = document.events.find((event) => event.text.endsWith('B'));
      expect(b?.endMs).toBe(5_000);
    });

    it('does not linger across a real gap masked by a large pre-sweep count-in delay', () => {
      // "C" has a plausible (small) bracket timestamp, but its enhanced segment defers its actual
      // first sung word another 6500ms out (a big count-in, same shape as an enhanced-LRC line
      // whose line tag arrives well before its first real word). The gap as measured by C's own
      // *display* start (bracket + segment offset - mainLinePreRollMs) is only 7500ms - under the
      // 8000ms minGapMs - but the real gap (to its actual first sung word) is 8500ms, and should
      // still be recognized and stop "A" from lingering across it.
      const preSweepMaskedFixture: NormalizedLyrics = {
        occurrences: [
          { startMs: 0, endMs: 1_000, text: 'A' },
          {
            startMs: 3_000,
            endMs: 10_500,
            text: 'C',
            segments: [{ text: 'C', timeMs: 6_500, location: { line: 1, column: 1 } }],
          },
        ],
      };

      const document = planEvents(preSweepMaskedFixture, {
        ...options,
        preset: 'multi-line',
        maxPreviewLines: 1,
        previewLeadMs: 0,
        lingerMaxMs: 5_000,
        interlude: { minGapMs: 8_000, strategy: 'text' },
      });

      const a = document.events.find((event) => event.text.endsWith('A'));
      expect(a?.endMs).toBe(1_000);
    });

    describe('blankGapMs', () => {
      const preSweepFixture: NormalizedLyrics = {
        occurrences: [
          { startMs: 0, endMs: 1_000, text: 'A' },
          {
            startMs: 2_000,
            endMs: 7_500,
            text: 'C',
            segments: [{ text: 'C', timeMs: 3_000, location: { line: 1, column: 1 } }],
          },
        ],
      };
      // The real gap here (A's end at 1000 to C's actual sung start at 5000) is 4000ms - real, but
      // short of the 8000ms minGapMs, so no Interlude appears either way.

      it('lingers across a real gap shorter than minGapMs when blankGapMs is unset', () => {
        const document = planEvents(preSweepFixture, {
          ...options,
          preset: 'multi-line',
          maxPreviewLines: 1,
          previewLeadMs: 0,
          mainLinePreRollMs: 0,
          lingerMaxMs: 5_000,
          interlude: { minGapMs: 8_000, strategy: 'text' },
        });

        const a = document.events.find((event) => event.text.endsWith('A'));
        expect(a?.endMs).toBe(5_000);
      });

      it('clears all rows instead of lingering once a real gap reaches blankGapMs, even below minGapMs', () => {
        const document = planEvents(preSweepFixture, {
          ...options,
          preset: 'multi-line',
          maxPreviewLines: 1,
          previewLeadMs: 0,
          mainLinePreRollMs: 0,
          lingerMaxMs: 5_000,
          interlude: { minGapMs: 8_000, strategy: 'text', blankGapMs: 3_000 },
        });

        const a = document.events.find((event) => event.text.endsWith('A'));
        expect(a?.endMs).toBe(1_000);
      });
    });
  });

  it('prepends a fad tag to every event when fadeInMs/fadeOutMs are set', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [{ startMs: 0, endMs: 1_000, text: 'Solo' }],
    };

    const document = planEvents(normalized, { ...options, preset: 'single-line', fadeInMs: 200, fadeOutMs: 300 });

    expect(document.events).toEqual([
      { layer: 0, startMs: 0, endMs: 1_000, style: 'Lyrics', text: '{\\fad(200,300)}Solo' },
    ]);
  });

  it('scales fadeInMs/fadeOutMs down so they never exceed an event\'s own duration', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [{ startMs: 0, endMs: 500, text: 'Short' }],
    };

    const document = planEvents(normalized, { ...options, preset: 'single-line', fadeInMs: 400, fadeOutMs: 400 });

    // fadeInMs + fadeOutMs (800) exceeds the 500ms event duration, so both are scaled by 500/800 = 0.625.
    expect(document.events).toEqual([
      { layer: 0, startMs: 0, endMs: 500, style: 'Lyrics', text: '{\\fad(250,250)}Short' },
    ]);
  });

  it('emits no fad tag when fadeInMs and fadeOutMs are both 0', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [{ startMs: 0, endMs: 1_000, text: 'Solo' }],
    };

    const document = planEvents(normalized, { ...options, preset: 'single-line' });

    expect(document.events).toEqual([
      { layer: 0, startMs: 0, endMs: 1_000, style: 'Lyrics', text: 'Solo' },
    ]);
  });

  it('omits events that collapse after centisecond quantization', () => {
    const document = planEvents({ occurrences: [{ startMs: 1, endMs: 4, text: 'Too short' }] }, options);
    expect(document.events).toEqual([]);
  });

  it('rejects invalid planner options', () => {
    expect(() => planEvents({ occurrences: [] }, {
      ...options,
      interlude: { minGapMs: -1, strategy: 'none' },
    })).toThrow(RangeError);
    expect(() => planEvents({ occurrences: [] }, {
      ...options,
      styles: { lyrics: { primaryColor: 'red' } },
    })).toThrow(RangeError);
    expect(() => planEvents({ occurrences: [] }, {
      ...options,
      styles: { lyrics: { fontName: 'Unsafe, Font' } },
    })).toThrow(RangeError);
    expect(() => planEvents({ occurrences: [] }, {
      ...options,
      styles: { lyrics: { fontName: 'Unsafe\nFont' } },
    })).toThrow(RangeError);
  });

  it('adds buffered text and countdown interludes', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 5_000, endMs: 6_000, text: 'Second' },
      ],
    };

    const textInterlude = planEvents(normalized, {
      ...options,
      interlude: { minGapMs: 3_000, marginMs: 100, strategy: 'text' },
    });
    const countdown = planEvents(normalized, {
      ...options,
      interlude: { minGapMs: 0, strategy: 'countdown' },
    });

    expect(textInterlude.events).toContainEqual({
      layer: 0,
      startMs: 1_100,
      endMs: 4_900,
      style: 'Interlude',
      text: '♪ Instrumental ♪',
    });
    const customStyleInterlude = planEvents(normalized, {
      ...options,
      interlude: { minGapMs: 3_000, strategy: 'text', style: 'Instrumental' },
    });
    expect(customStyleInterlude.styles.map((style) => style.name)).toContain('Instrumental');
    expect(countdown.events.filter((event) => event.style === 'Interlude')).toEqual([
      { layer: 0, startMs: 1_000, endMs: 2_000, style: 'Interlude', text: '4' },
      { layer: 0, startMs: 2_000, endMs: 3_000, style: 'Interlude', text: '3' },
      { layer: 0, startMs: 3_000, endMs: 4_000, style: 'Interlude', text: '2' },
      { layer: 0, startMs: 4_000, endMs: 5_000, style: 'Interlude', text: '1' },
    ]);
  });

  it('draws a track and animated fill event for the progress-bar interlude strategy', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 1_000, text: 'First' },
        { startMs: 5_000, endMs: 6_000, text: 'Second' },
      ],
    };

    const document = planEvents(normalized, {
      ...options,
      interlude: { minGapMs: 3_000, marginMs: 100, strategy: 'progress-bar' },
    });

    // layout: resolutionX 384, marginLeft/Right 10 -> barLeft 10, barWidth 364; resolutionY 288,
    // barHeight 24 -> barTop 132; radius clamps to 8. Single-line preset interlude colors:
    // primaryColor #FFFFFF (fill), secondaryColor #808080 (track), outlineColor #000000 (border).
    const path = 'm 8 0 l 356 0 b 364 0 364 0 364 8 l 364 16 b 364 24 364 24 356 24 l 8 24 '
      + 'b 0 24 0 24 0 16 l 0 8 b 0 0 0 0 8 0';

    expect(document.events.filter((event) => event.style === 'Interlude')).toEqual([
      {
        layer: 0,
        startMs: 1_100,
        endMs: 4_900,
        style: 'Interlude',
        text: `{\\p1\\an7\\pos(10,132)\\shad0\\1c&H00808080&\\3c&H00000000&}${path}{\\p0}`,
      },
      {
        layer: 1,
        startMs: 1_100,
        endMs: 4_900,
        style: 'Interlude',
        text: '{\\p1\\an7\\pos(10,132)\\shad0\\1c&H00FFFFFF&\\3c&H00000000&'
          + '\\clip(10,132,10,156)\\t(0,3800,\\clip(10,132,374,156))}'
          + `${path}{\\p0}`,
      },
    ]);
  });

  it('adds an interlude for a leading gap before the very first lyric', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [{ startMs: 10_000, endMs: 11_000, text: 'First' }],
    };

    const document = planEvents(normalized, {
      ...options,
      interlude: { minGapMs: 3_000, marginMs: 100, strategy: 'text' },
    });

    expect(document.events.filter((event) => event.style === 'Interlude')).toEqual([
      { layer: 0, startMs: 100, endMs: 9_900, style: 'Interlude', text: '♪ Instrumental ♪' },
    ]);
  });

  it('waits for every overlapping lyric to end before adding an interlude', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        { startMs: 0, endMs: 3_000, text: 'Long lyric' },
        { startMs: 0, endMs: 1_000, text: 'Short lyric' },
        { startMs: 5_000, endMs: 6_000, text: 'Next lyric' },
      ],
    };

    const document = planEvents(normalized, {
      ...options,
      interlude: { minGapMs: 1_000, strategy: 'text' },
    });

    expect(document.events.filter((event) => event.style === 'Interlude')).toEqual([
      { layer: 0, startMs: 3_000, endMs: 5_000, style: 'Interlude', text: '♪ Instrumental ♪' },
    ]);
  });

  it('uses the final enhanced segment as the interlude tail anchor', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        {
          startMs: 0,
          endMs: 10_000,
          text: 'First line',
          segments: [
            { text: 'First ', timeMs: 0, location: { line: 1, column: 1 } },
            { text: 'line', timeMs: 5_000, location: { line: 1, column: 7 } },
          ],
        },
        { startMs: 10_000, endMs: 12_000, text: 'Second line' },
      ],
    };

    const document = planEvents(normalized, {
      ...options,
      interlude: { minGapMs: 3_000, strategy: 'text', trailingLyricDurationMs: 1_500 },
    });

    expect(document.events).toContainEqual({
      layer: 0,
      startMs: 0,
      endMs: 6_500,
      style: 'Lyrics',
      text: 'First line',
    });
    expect(document.events).toContainEqual({
      layer: 0,
      startMs: 6_500,
      endMs: 10_000,
      style: 'Interlude',
      text: '♪ Instrumental ♪',
    });
  });

  it('does not truncate the final lyric with trailingLyricDurationMs when no lyric follows', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        {
          startMs: 0,
          endMs: 20_000,
          text: 'Last line',
          segments: [
            { text: 'Last ', timeMs: 0, location: { line: 1, column: 1 } },
            { text: 'line', timeMs: 5_000, location: { line: 1, column: 6 } },
          ],
        },
      ],
    };

    const document = planEvents(normalized, {
      ...options,
      interlude: { minGapMs: 3_000, strategy: 'text', trailingLyricDurationMs: 1_500 },
    });

    expect(document.events).toContainEqual({
      layer: 0,
      startMs: 0,
      endMs: 20_000,
      style: 'Lyrics',
      text: 'Last line',
    });
  });

  it('does not truncate a lyric with trailingLyricDurationMs when the following gap is below minGapMs', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [
        {
          startMs: 0,
          endMs: 10_000,
          text: 'First line',
          segments: [
            { text: 'First ', timeMs: 0, location: { line: 1, column: 1 } },
            { text: 'line', timeMs: 5_000, location: { line: 1, column: 7 } },
          ],
        },
        { startMs: 10_000, endMs: 12_000, text: 'Second line' },
      ],
    };

    const document = planEvents(normalized, {
      ...options,
      interlude: { minGapMs: 10_000, strategy: 'text', trailingLyricDurationMs: 1_500 },
    });

    expect(document.events).toContainEqual({
      layer: 0,
      startMs: 0,
      endMs: 10_000,
      style: 'Lyrics',
      text: 'First line',
    });
  });
});
