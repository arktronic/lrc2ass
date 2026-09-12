import type { Diagnostic, SourceLocation } from './diagnostics.js';

export type ValidationMode = 'strict' | 'tolerant';

export interface LrcTimestamp {
  /** Milliseconds from the start of the track. */
  timeMs: number;
  location: SourceLocation;
}

export interface EnhancedSegment {
  text: string;
  /** Offset in ms from the line's first timestamp; 0 for the leading segment. */
  timeMs: number;
  location: SourceLocation;
}

export interface LrcLine {
  timestamps: LrcTimestamp[];
  text: string;
  enhancedSegments?: EnhancedSegment[];
  location: SourceLocation;
}

export interface UnknownEntry {
  raw: string;
  location: SourceLocation;
}

export interface LrcMetadata {
  [tag: string]: string;
}

export interface LrcDocument {
  metadata: LrcMetadata;
  lines: LrcLine[];
  unknownEntries: UnknownEntry[];
}

export interface ParseOptions {
  mode: ValidationMode;
}

export interface ParseResult {
  document: LrcDocument;
  diagnostics: Diagnostic[];
}
