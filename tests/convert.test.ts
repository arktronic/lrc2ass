import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/parser.js', () => ({ parseLrc: vi.fn() }));
vi.mock('../src/core/normalizer.js', () => ({ normalizeLyrics: vi.fn() }));
vi.mock('../src/core/planner.js', () => ({ planEvents: vi.fn() }));
vi.mock('../src/core/serializer.js', () => ({ serializeAss: vi.fn() }));

import { convert } from '../src/core/convert.js';
import { parseLrc } from '../src/core/parser.js';
import { normalizeLyrics } from '../src/core/normalizer.js';
import { planEvents } from '../src/core/planner.js';
import { serializeAss } from '../src/core/serializer.js';
import { DEFAULT_PARSE_OPTIONS, DEFAULT_PLAN_OPTIONS } from '../src/core/defaults.js';
import type { AssDocument, Diagnostic, LrcDocument, NormalizedLyrics } from '../src/index.js';

const mockedParseLrc = vi.mocked(parseLrc);
const mockedNormalizeLyrics = vi.mocked(normalizeLyrics);
const mockedPlanEvents = vi.mocked(planEvents);
const mockedSerializeAss = vi.mocked(serializeAss);

describe('convert', () => {
  const document: LrcDocument = { metadata: {}, lines: [], unknownEntries: [] };
  const diagnostics: Diagnostic[] = [
    { code: 'test', message: 'test diagnostic', severity: 'warning' },
  ];
  const normalizeDiagnostics: Diagnostic[] = [
    { code: 'normalize-test', message: 'normalize diagnostic', severity: 'warning' },
  ];
  const normalized: NormalizedLyrics = { occurrences: [] };
  const ass: AssDocument = { scriptInfo: { playResX: 384, playResY: 288 }, styles: [], events: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedParseLrc.mockReturnValue({ document, diagnostics });
    mockedNormalizeLyrics.mockReturnValue({ normalized, diagnostics: normalizeDiagnostics });
    mockedPlanEvents.mockReturnValue(ass);
    mockedSerializeAss.mockReturnValue('serialized-ass-text');
  });

  it('threads each stage output into the next stage', () => {
    convert('lrc text', {});

    expect(mockedParseLrc).toHaveBeenCalledWith('lrc text', expect.anything());
    expect(mockedNormalizeLyrics).toHaveBeenCalledWith(document, expect.anything());
    expect(mockedPlanEvents).toHaveBeenCalledWith(normalized, expect.anything());
    expect(mockedSerializeAss).toHaveBeenCalledWith(ass, expect.anything());
  });

  it('returns the planned ASS document, serialized text, and merged diagnostics', () => {
    const result = convert('lrc text', {});

    expect(result).toEqual({
      ass,
      text: 'serialized-ass-text',
      diagnostics: [...diagnostics, ...normalizeDiagnostics],
    });
  });

  it('applies default parse and plan options when none are provided', () => {
    convert('lrc text', {});

    expect(mockedParseLrc).toHaveBeenCalledWith('lrc text', DEFAULT_PARSE_OPTIONS);
    expect(mockedNormalizeLyrics).toHaveBeenCalledWith(document, { mode: DEFAULT_PARSE_OPTIONS.mode });
    expect(mockedPlanEvents).toHaveBeenCalledWith(normalized, DEFAULT_PLAN_OPTIONS);
  });

  it('applies defaults when no options object is passed at all', () => {
    convert('lrc text');

    expect(mockedParseLrc).toHaveBeenCalledWith('lrc text', DEFAULT_PARSE_OPTIONS);
    expect(mockedNormalizeLyrics).toHaveBeenCalledWith(document, { mode: DEFAULT_PARSE_OPTIONS.mode });
    expect(mockedPlanEvents).toHaveBeenCalledWith(normalized, DEFAULT_PLAN_OPTIONS);
  });

  it('lets caller-provided parse options override the defaults', () => {
    convert('lrc text', { parse: { mode: 'strict' } });

    expect(mockedParseLrc).toHaveBeenCalledWith('lrc text', { mode: 'strict' });
    expect(mockedNormalizeLyrics).toHaveBeenCalledWith(document, { mode: 'strict' });
  });

  it('lets caller-provided normalize mode override parse mode', () => {
    convert('lrc text', { parse: { mode: 'strict' }, normalize: { mode: 'tolerant' } });

    expect(mockedNormalizeLyrics).toHaveBeenCalledWith(document, { mode: 'tolerant' });
  });

  it('lets caller-provided plan options override the defaults', () => {
    const layout = { ...DEFAULT_PLAN_OPTIONS.layout, alignment: 8 as const };
    convert('lrc text', { plan: { karaokeEffect: 'sweep', layout } });

    expect(mockedPlanEvents).toHaveBeenCalledWith(normalized, { karaokeEffect: 'sweep', layout });
  });

  it('lets caller override only part of plan layout while preserving defaults', () => {
    convert('lrc text', { plan: { layout: { alignment: 8 } } });

    expect(mockedPlanEvents).toHaveBeenCalledWith(normalized, {
      ...DEFAULT_PLAN_OPTIONS,
      layout: { ...DEFAULT_PLAN_OPTIONS.layout, alignment: 8 },
    });
  });
});
