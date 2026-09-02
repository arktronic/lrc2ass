import type { AssDocument, SerializeOptions } from '../types/index.js';

/** Fixed libass standard style fields not modeled by {@link AssStyle}. */
const DEFAULT_STYLE_FIELDS = {
  bold: 0,
  italic: 0,
  underline: 0,
  strikeout: 0,
  scalex: 100,
  scaley: 100,
  spacing: 0,
  angle: 0,
  borderstyle: 1,
  outline: 2,
  shadow: 0,
  encoding: 1,
} as const;

/** Converts integer milliseconds to an ASS time field: `H:MM:SS.CC`, hour unpadded. */
function formatAssTime(timeMs: number): string {
  const totalCentiseconds = Math.round(timeMs / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const pad = (value: number, width: number): string => value.toString().padStart(width, '0');
  return `${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(centiseconds, 2)}`;
}

function formatScriptInfo(document: AssDocument, includeMetadata: boolean): string {
  const lines = ['ScriptType: v4.00+', `PlayResX: ${document.scriptInfo.playResX}`, `PlayResY: ${document.scriptInfo.playResY}`];
  if (includeMetadata && document.scriptInfo.title) {
    lines.push(`Title: ${document.scriptInfo.title}`);
  }
  return lines.join('\r\n');
}

const STYLE_FORMAT_LINE = 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding';

function formatStyle(style: AssDocument['styles'][number]): string {
  const values = [
    style.name,
    style.fontName,
    style.fontSize,
    style.primaryColor,
    style.secondaryColor,
    style.outlineColor,
    style.backColor,
    DEFAULT_STYLE_FIELDS.bold,
    DEFAULT_STYLE_FIELDS.italic,
    DEFAULT_STYLE_FIELDS.underline,
    DEFAULT_STYLE_FIELDS.strikeout,
    DEFAULT_STYLE_FIELDS.scalex,
    DEFAULT_STYLE_FIELDS.scaley,
    DEFAULT_STYLE_FIELDS.spacing,
    DEFAULT_STYLE_FIELDS.angle,
    DEFAULT_STYLE_FIELDS.borderstyle,
    DEFAULT_STYLE_FIELDS.outline,
    DEFAULT_STYLE_FIELDS.shadow,
    style.alignment,
    style.marginLeft,
    style.marginRight,
    style.marginVertical,
    DEFAULT_STYLE_FIELDS.encoding,
  ];
  return `Style: ${values.join(',')}`;
}

const EVENT_FORMAT_LINE = 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text';

function formatEvent(event: AssDocument['events'][number]): string {
  const values = [
    event.layer,
    formatAssTime(event.startMs),
    formatAssTime(event.endMs),
    event.style,
    '',
    0,
    0,
    0,
    '',
    event.text,
  ];
  return `Dialogue: ${values.join(',')}`;
}

/**
 * Produces canonical, deterministic ASS text from an {@link AssDocument}.
 * Emits `v4.00+` `[Script Info]`, `[V4+ Styles]`, and `[Events]` sections joined by CRLF.
 * Event text is left verbatim; escaping is applied upstream by the event planner.
 */
export function serializeAss(document: AssDocument, options: SerializeOptions): string {
  const includeMetadata = options.includeMetadataComments ?? false;

  const scriptInfo = `[Script Info]\r\n${formatScriptInfo(document, includeMetadata)}`;
  const styleBlock = `[V4+ Styles]\r\n${STYLE_FORMAT_LINE}\r\n${document.styles.map(formatStyle).join('\r\n')}`;
  const eventBlock = `[Events]\r\n${EVENT_FORMAT_LINE}\r\n${document.events.map(formatEvent).join('\r\n')}`;

  return `${scriptInfo}\r\n\r\n${styleBlock}\r\n\r\n${eventBlock}\r\n`;
}
