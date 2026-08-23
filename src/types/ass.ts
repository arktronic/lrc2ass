/** 'none': plain dialogue. 'instant': \k, flips color at each syllable. 'sweep': \kf, wipes fill. 'sweep-outline': \ko, wipes outline. */
export type KaraokeEffect = 'none' | 'instant' | 'sweep' | 'sweep-outline';

/**
 * ASS numpad alignment (the \an override tag): position maps to a phone keypad layout —
 * 7=top-left, 8=top-center, 9=top-right, 4=middle-left, 5=middle-center, 6=middle-right,
 * 1=bottom-left, 2=bottom-center, 3=bottom-right.
 */
export type AssAlignment = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** An ASS `&HAABBGGRR&` color string (alpha, then blue/green/red — not RGB order). Construct via `assColorFromHex`. */
export type AssColor = string & { readonly __brand: 'AssColor' };

export interface ScriptInfo {
  title?: string;
  /** Script's authoring coordinate space (ASS "PlayResX"), not necessarily the video's actual resolution. */
  playResX: number;
  /** Script's authoring coordinate space (ASS "PlayResY"), not necessarily the video's actual resolution. */
  playResY: number;
}

export interface AssStyle {
  name: string;
  fontName: string;
  fontSize: number;
  primaryColor: AssColor;
  /** Color of the not-yet-sung portion during a karaoke sweep. */
  secondaryColor: AssColor;
  outlineColor: AssColor;
  backColor: AssColor;
  alignment: AssAlignment;
  marginLeft: number;
  marginRight: number;
  marginVertical: number;
}

export interface AssEvent {
  /** Rendering order among overlapping events; lower layers are drawn first. */
  layer: number;
  startMs: number;
  endMs: number;
  style: string;
  text: string;
}

export interface AssDocument {
  scriptInfo: ScriptInfo;
  styles: AssStyle[];
  events: AssEvent[];
}
