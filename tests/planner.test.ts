import { describe, expect, it } from 'vitest';
import { planEvents } from '../src/index.js';
import type { NormalizedLyrics, PlanOptions } from '../src/index.js';

const options: PlanOptions = {
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

describe('planEvents', () => {
  it('creates a styled, escaped dialogue event from a plain lyric', () => {
    const normalized: NormalizedLyrics = {
      occurrences: [{ startMs: 15, endMs: 1_044, text: 'a{b}\\c\nd' }],
    };

    const document = planEvents(normalized, options);

    expect(document.scriptInfo).toEqual({ playResX: 384, playResY: 288 });
    expect(document.styles.map((style) => style.name)).toEqual(['Lyrics', 'Preview', 'Interlude']);
    expect(document.events).toEqual([
      { layer: 0, startMs: 20, endMs: 1_040, style: 'Lyrics', text: 'a\\{b\\}\\\\c\\Nd' },
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
      text: 'Next',
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

    expect(document.events.filter((event) => event.style === 'Preview')).toEqual([
      { layer: -1, startMs: 0, endMs: 2_000, style: 'Preview', text: 'Next line' },
    ]);
    expect(document.events.slice(0, 3).map((event) => event.style)).toEqual(['Preview', 'Lyrics', 'Lyrics']);
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
});
