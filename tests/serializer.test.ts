import { describe, expect, it } from 'vitest';
import { serializeAss } from '../src/index.js';
import { assColorFromHex } from '../src/index.js';
import type { AssDocument, AssEvent } from '../src/index.js';

function makeDocument(partial: Partial<AssDocument>): AssDocument {
  return {
    scriptInfo: { playResX: 384, playResY: 288 },
    styles: [],
    events: [],
    ...partial,
  };
}

describe('serializeAss', () => {
  it('emits the v4.00+ script type and play resolution for an empty document', () => {
    const text = serializeAss(makeDocument({}), {});

    expect(text).toContain('[Script Info]\r\n');
    expect(text).toContain('ScriptType: v4.00+');
    expect(text).toContain('PlayResX: 384');
    expect(text).toContain('PlayResY: 288');
    expect(text).toContain('[V4+ Styles]\r\n');
    expect(text).toContain('[Events]\r\n');
    expect(text).toContain(
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    );
    expect(text).toContain(
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    );
  });

  it('ends with a trailing newline and uses CRLF line endings throughout', () => {
    const document = makeDocument({
      styles: [{
        name: 'Lyrics', fontName: 'Arial', fontSize: 28,
        primaryColor: assColorFromHex('#FFFFFF'), secondaryColor: assColorFromHex('#808080'),
        outlineColor: assColorFromHex('#000000'), backColor: assColorFromHex('#000000', 0),
        alignment: 2, marginLeft: 10, marginRight: 10, marginVertical: 10,
      }],
      events: [{ layer: 0, startMs: 0, endMs: 1000, style: 'Lyrics', text: 'hi' }],
    });
    const text = serializeAss(document, {});

    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.includes('\n')).toBe(true);
    expect(text.includes('\r\n')).toBe(true);
    expect(/[^\r]\n/.test(text)).toBe(false);
  });

  it('formats styles with a Format line followed by one Style line per entry, in order', () => {
    const document = makeDocument({
      styles: [{
        name: 'Lyrics', fontName: 'Arial', fontSize: 28,
        primaryColor: assColorFromHex('#FFFFFF'), secondaryColor: assColorFromHex('#808080'),
        outlineColor: assColorFromHex('#000000'), backColor: assColorFromHex('#000000', 0),
        alignment: 2, marginLeft: 10, marginRight: 10, marginVertical: 10,
      }],
      events: [],
    });
    const text = serializeAss(document, {});

    expect(text).toContain(
      '[V4+ Styles]\r\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\r\nStyle: Lyrics,Arial,28,&H00FFFFFF&,&H00808080&,&H00000000&,&HFF000000&,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1',
    );
  });

  it('preserves the input order of multiple styles and events', () => {
    const document = makeDocument({
      styles: [
        { name: 'Lyrics', fontName: 'Arial', fontSize: 28, primaryColor: assColorFromHex('#FFFFFF'), secondaryColor: assColorFromHex('#808080'), outlineColor: assColorFromHex('#000000'), backColor: assColorFromHex('#000000', 0), alignment: 2, marginLeft: 10, marginRight: 10, marginVertical: 10 },
        { name: 'Preview', fontName: 'Arial', fontSize: 24, primaryColor: assColorFromHex('#C0C0C0'), secondaryColor: assColorFromHex('#808080'), outlineColor: assColorFromHex('#000000'), backColor: assColorFromHex('#000000', 0), alignment: 8, marginLeft: 10, marginRight: 10, marginVertical: 10 },
      ],
      events: [
        { layer: 0, startMs: 0, endMs: 1000, style: 'Lyrics', text: 'one' },
        { layer: -1, startMs: 0, endMs: 1000, style: 'Preview', text: 'two' },
      ],
    });
    const text = serializeAss(document, {});

    expect(text).toContain('Style: Lyrics,');
    expect(text).toContain('Style: Preview,');
    expect(text.indexOf('Style: Lyrics,')).toBeLessThan(text.indexOf('Style: Preview,'));
    expect(text).toContain('Dialogue: 0,0:00:00.00,0:00:01.00,Lyrics,,0,0,0,,one');
    expect(text).toContain('Dialogue: -1,0:00:00.00,0:00:01.00,Preview,,0,0,0,,two');
  });

  it('formats times as H:MM:SS.CC across boundaries', () => {
    const makeEvent = (text: string, timing: Pick<AssEvent, 'startMs' | 'endMs'>): AssEvent =>
      ({ layer: 0, style: 'Lyrics', text, ...timing });
    const document = makeDocument({
      events: [
        makeEvent('zero', { startMs: 0, endMs: 0 }),
        makeEvent('subminute', { startMs: 5, endMs: 5999 }),
        makeEvent('full', { startMs: 3_600_000, endMs: 3_600_000 }),
        makeEvent('rounds', { startMs: 104, endMs: 104 }),
      ],
    });
    const text = serializeAss(document, {});

    expect(text).toContain('0:00:00.00,0:00:00.00');
    expect(text).toContain('0:00:00.01,0:00:06.00');
    expect(text).toContain('1:00:00.00,1:00:00.00');
    expect(text).toContain('0:00:00.10,0:00:00.10');
  });

  it('omits the Title line when includeMetadataComments is false even if title is set', () => {
    const document = makeDocument({
      scriptInfo: { playResX: 384, playResY: 288, title: 'My Song' },
      styles: [],
      events: [],
    });

    expect(serializeAss(document, { includeMetadataComments: false })).not.toContain('Title:');
  });

  it('emits the Title line only when includeMetadataComments is true and title is set', () => {
    const document = makeDocument({
      scriptInfo: { playResX: 384, playResY: 288, title: 'My Song' },
      styles: [],
      events: [],
    });

    expect(serializeAss(document, { includeMetadataComments: true })).toContain('Title: My Song');
  });

  it('omits the Title line when title is unset', () => {
    const document = makeDocument({
      scriptInfo: { playResX: 384, playResY: 288 },
      styles: [],
      events: [],
    });

    expect(serializeAss(document, { includeMetadataComments: true })).not.toContain('Title:');
  });

  it('leaves event text verbatim without re-escaping already-escaped content', () => {
    const event: AssEvent = { layer: 0, startMs: 0, endMs: 1000, style: 'Lyrics', text: 'a\\Nd\\re{b}\\c' };
    const text = serializeAss(makeDocument({ events: [event] }), {});

    expect(text).toContain('Lyrics,,0,0,0,,a\\Nd\\re{b}\\c');
  });

  it('uses exactly one blank line between sections and one trailing newline when styles and events are empty', () => {
    const text = serializeAss(makeDocument({}), {});

    expect(text).toBe(
      '[Script Info]\r\nScriptType: v4.00+\r\nPlayResX: 384\r\nPlayResY: 288\r\n\r\n'
      + '[V4+ Styles]\r\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\r\n\r\n'
      + '[Events]\r\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\r\n',
    );
  });
});
