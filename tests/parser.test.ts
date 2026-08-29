import { describe, expect, it } from 'vitest';
import { parseLrc } from '../src/index.js';

describe('parseLrc', () => {
  it('parses metadata and a simple timestamped line', () => {
    const text = '[ar:Artist]\n[00:01.23]Hello';
    const result = parseLrc(text, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.metadata).toEqual({ ar: 'Artist' });
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('Hello');
    expect(result.document.lines[0].timestamps.map((timestamp) => timestamp.timeMs)).toEqual([1230]);
  });

  it('parses multiple leading timestamps on one line', () => {
    const result = parseLrc('[00:01.00][00:02.345]Hi', { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].timestamps.map((timestamp) => timestamp.timeMs)).toEqual([1000, 2345]);
  });

  it('parses enhanced inline segments as offsets from line start', () => {
    const result = parseLrc('[00:10.000]He<00:10.500>llo<00:11.000>!', { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('Hello!');
    expect(result.document.lines[0].enhancedSegments).toEqual([
      { text: 'He', timeMs: 0, location: { line: 1, column: 12 } },
      { text: 'llo', timeMs: 500, location: { line: 1, column: 25 } },
      { text: '!', timeMs: 1000, location: { line: 1, column: 39 } },
    ]);
  });

  it('stores unknown lines in tolerant mode', () => {
    const result = parseLrc('plain text line', { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toEqual([]);
    expect(result.document.unknownEntries).toEqual([{ raw: 'plain text line', location: { line: 1, column: 1 } }]);
  });

  it('warns and recovers malformed lyric lines in tolerant mode', () => {
    const result = parseLrc('[00:01.2]Bad', { mode: 'tolerant' });

    expect(result.document.lines).toEqual([]);
    expect(result.document.unknownEntries).toEqual([{ raw: '[00:01.2]Bad', location: { line: 1, column: 1 } }]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].severity).toBe('warning');
    expect(result.diagnostics[0].code).toBe('LRC_TIMESTAMP_INVALID');
  });

  it('fails fast on malformed lyric lines in strict mode', () => {
    const text = '[00:01.00]ok\n[00:01.2]bad\n[00:02.00]later';
    const result = parseLrc(text, { mode: 'strict' });

    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('ok');
    expect(result.document.lines[0].location).toEqual({ line: 1, column: 1 });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].severity).toBe('error');
    expect(result.diagnostics[0].code).toBe('LRC_TIMESTAMP_INVALID');
  });

  it('accepts arbitrary metadata keys', () => {
    const result = parseLrc('[foo-bar:baz]', { mode: 'tolerant' });
    expect(result.document.metadata).toEqual({ 'foo-bar': 'baz' });
  });

  it('accepts mm:ss timestamp variant', () => {
    const result = parseLrc('[01:02]Line', { mode: 'tolerant' });
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].timestamps[0].timeMs).toBe(62_000);
    expect(result.diagnostics).toEqual([]);
  });

  it('accepts mm:ss:cc timestamp variant', () => {
    const result = parseLrc('[01:02:34]Line', { mode: 'tolerant' });
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].timestamps[0].timeMs).toBe(62_340);
    expect(result.diagnostics).toEqual([]);
  });

  it('accepts leading whitespace before tags and timestamps', () => {
    const input = '   [ar:Artist]\n\t[00:01.00] lyric';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.document.metadata).toEqual({ ar: 'Artist' });
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('lyric');
    expect(result.document.lines[0].location).toEqual({ line: 2, column: 2 });
  });

  it('parses packed metadata tags on one line', () => {
    const result = parseLrc('[ar:Artist][ti:Title][offset:-100]', { mode: 'tolerant' });
    expect(result.document.metadata).toEqual({
      ar: 'Artist',
      ti: 'Title',
      offset: '-100',
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('keeps walaoke gender markers as lyric text', () => {
    const result = parseLrc('[00:17.20]F: Line 2 lyrics', { mode: 'tolerant' });
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('F: Line 2 lyrics');
  });

  it('parses timestamps with an hour component', () => {
    const result = parseLrc('[01:02:03.45]hour-format', { mode: 'tolerant' });
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].timestamps[0].timeMs).toBe(3_723_450);
  });

  it('ignores UTF-8 BOM at the start of a line', () => {
    const bom = '\uFEFF';
    const result = parseLrc(`${bom}[00:00.00]line1`, { mode: 'tolerant' });
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('line1');
    expect(result.document.unknownEntries).toEqual([]);
  });

  it('accepts case-variant metadata keys seen in wild files', () => {
    const result = parseLrc('[Encoding:iso-8859-15]\n[00:00.00]line1', { mode: 'tolerant' });
    expect(result.document.metadata).toEqual({ Encoding: 'iso-8859-15' });
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('line1');
  });
});
