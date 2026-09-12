import { describe, expect, it } from 'vitest';
import { parseLrc } from '../src/index.js';

describe('parseLrc snippet compatibility', () => {
  it('parses core simple LRC snippet', () => {
    const input = '[00:12.00]Line 1 lyrics\n[00:17.20]Line 2 lyrics';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toHaveLength(2);
    expect(result.document.lines[0].text).toBe('Line 1 lyrics');
    expect(result.document.lines[0].timestamps[0].timeMs).toBe(12_000);
    expect(result.document.lines[1].timestamps[0].timeMs).toBe(17_200);
  });

  it('parses repeated timestamp line snippet', () => {
    const input = '[00:21.10][00:45.10]Repeating lyrics';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].timestamps.map((t) => t.timeMs)).toEqual([21_100, 45_100]);
    expect(result.document.lines[0].text).toBe('Repeating lyrics');
  });

  it('parses packed metadata header snippet', () => {
    const input = '[ar:Artist][ti:Song Title][offset:-567]';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.metadata).toEqual({
      ar: 'Artist',
      ti: 'Song Title',
      offset: '-567',
    });
  });

  it('parses enhanced word-time snippet', () => {
    const input = '[00:13.45]One <00:14.05>two <00:15.05>three';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('One two three');
    expect(result.document.lines[0].enhancedSegments?.map((s) => [s.text, s.timeMs])).toEqual([
      ['One ', 0],
      ['two ', 600],
      ['three', 1600],
    ]);
  });

  it('accepts mm:ss and mm:ss:cc variants in one snippet', () => {
    const input = '[01:02]No fraction\n[01:02:34]Colon centiseconds';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toHaveLength(2);
    expect(result.document.lines[0].timestamps[0].timeMs).toBe(62_000);
    expect(result.document.lines[1].timestamps[0].timeMs).toBe(62_340);
  });

  it('accepts hour-form timestamp snippet', () => {
    const input = '[01:02:03.45]Long form';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].timestamps[0].timeMs).toBe(3_723_450);
  });

  it('accepts flexible digit widths and equal enhanced offsets', () => {
    const input = '[1:2:03.45]A<1:2:03.95>B<1:2:03.95>C';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines[0].enhancedSegments?.map((segment) => [segment.text, segment.timeMs])).toEqual([
      ['A', 0],
      ['B', 500],
      ['C', 500],
    ]);
  });

  it('preserves a leading enhanced timestamp as a timed-text gap', () => {
    const result = parseLrc('[00:10.00]<00:10.50>Hello', { mode: 'tolerant' });

    expect(result.document.lines[0].enhancedSegments?.map((segment) => [segment.text, segment.timeMs])).toEqual([
      ['Hello', 500],
    ]);
  });

  it('keeps walaoke marker prefixes as lyric text', () => {
    const input = '[00:17.20]F: Line 2 lyrics\n[00:21.10]M: Line 3 lyrics';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toHaveLength(2);
    expect(result.document.lines[0].text).toBe('F: Line 2 lyrics');
    expect(result.document.lines[1].text).toBe('M: Line 3 lyrics');
  });

  it('ignores BOM at line start snippet', () => {
    const input = '\uFEFF[00:00.00]line1';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.diagnostics).toEqual([]);
    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('line1');
  });

  it('recovers malformed snippet in tolerant mode', () => {
    const input = '[00:12.00]ok\n[00:01.2]bad';
    const result = parseLrc(input, { mode: 'tolerant' });

    expect(result.document.lines).toHaveLength(1);
    expect(result.document.lines[0].text).toBe('ok');
    expect(result.document.unknownEntries).toHaveLength(1);
    expect(result.document.unknownEntries[0].raw).toBe('[00:01.2]bad');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('LRC_TIMESTAMP_INVALID');
    expect(result.diagnostics[0].severity).toBe('warning');
  });
});
