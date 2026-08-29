import type {
  Diagnostic,
  EnhancedSegment,
  LrcDocument,
  NormalizeOptions,
  NormalizeResult,
  Occurrence,
  SourceLocation,
} from '../types/index.js';

const DEFAULT_TRAILING_DURATION_MS = 5000;

interface UnresolvedOccurrence {
  startMs: number;
  text: string;
  segments?: EnhancedSegment[];
  location: SourceLocation;
  sourceIndex: number;
}

function parseLengthMetadata(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const cleanValue = value.trim().replace(/^\(|\)$/g, '').trim();
  const dotMatch = cleanValue.match(/^(?:(\d+):)?(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
  if (dotMatch) {
    const hours = dotMatch[1] === undefined ? 0 : Number.parseInt(dotMatch[1], 10);
    const minutes = Number.parseInt(dotMatch[2], 10);
    const seconds = Number.parseInt(dotMatch[3], 10);
    if (seconds > 59) {
      return undefined;
    }
    if (dotMatch[1] !== undefined && minutes > 59) {
      return undefined;
    }
    const fraction = dotMatch[4];
    let fractionMs = 0;
    if (fraction) {
      if (fraction.length === 1) {
        fractionMs = Number.parseInt(fraction, 10) * 100;
      } else if (fraction.length === 2) {
        fractionMs = Number.parseInt(fraction, 10) * 10;
      } else {
        fractionMs = Number.parseInt(fraction, 10);
      }
    }
    return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + fractionMs;
  }
  return undefined;
}

function parseOffsetMetadata(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Applies offsets, expands repeated timestamps, orders occurrences, and infers boundaries.
 */
export function normalizeLyrics(
  document: LrcDocument,
  options: NormalizeOptions = {},
): NormalizeResult {
  const mode = options.mode ?? 'tolerant';
  const overlapPolicy = options.overlapPolicy ?? 'preserve';
  const metadataOffsetMs = parseOffsetMetadata(document.metadata.offset);
  const callerOffsetMs = options.offsetMs ?? 0;
  const totalOffsetMs = metadataOffsetMs + callerOffsetMs;

  const diagnostics: Diagnostic[] = [];
  const rawOccurrences: UnresolvedOccurrence[] = [];

  // Check per-line monotonicity across line-level timestamps in document order
  let previousLineTimeMs: number | undefined;
  for (const line of document.lines) {
    if (line.timestamps.length === 0) {
      continue;
    }

    // Check line-to-line ordering
    const firstEffectiveMs = line.timestamps[0].timeMs + totalOffsetMs;
    if (previousLineTimeMs !== undefined && firstEffectiveMs < previousLineTimeMs) {
      if (mode === 'strict') {
        diagnostics.push({
          code: 'LRC_NON_MONOTONIC_TIMESTAMP',
          message: `Line timestamp ${firstEffectiveMs}ms is earlier than previous line timestamp ${previousLineTimeMs}ms.`,
          severity: 'error',
          location: line.timestamps[0].location ?? line.location,
        });
      } else {
        diagnostics.push({
          code: 'LRC_NON_MONOTONIC_TIMESTAMP',
          message: `Line timestamp ${firstEffectiveMs}ms is earlier than previous line timestamp ${previousLineTimeMs}ms.`,
          severity: 'warning',
          location: line.timestamps[0].location ?? line.location,
        });
      }
    }
    previousLineTimeMs = firstEffectiveMs;

    // Check intra-line multi-timestamp monotonicity
    for (let t = 1; t < line.timestamps.length; t++) {
      const prevTs = line.timestamps[t - 1].timeMs + totalOffsetMs;
      const currTs = line.timestamps[t].timeMs + totalOffsetMs;
      if (currTs < prevTs) {
        if (mode === 'strict') {
          diagnostics.push({
            code: 'LRC_NON_MONOTONIC_TIMESTAMP',
            message: `Timestamp ${currTs}ms is earlier than preceding timestamp ${prevTs}ms on the same line.`,
            severity: 'error',
            location: line.timestamps[t].location ?? line.location,
          });
        } else {
          diagnostics.push({
            code: 'LRC_NON_MONOTONIC_TIMESTAMP',
            message: `Timestamp ${currTs}ms is earlier than preceding timestamp ${prevTs}ms on the same line.`,
            severity: 'warning',
            location: line.timestamps[t].location ?? line.location,
          });
        }
      }
    }
  }

  let sourceIndex = 0;
  for (const line of document.lines) {
    if (line.timestamps.length === 0) {
      continue;
    }

    for (const ts of line.timestamps) {
      const effectiveStartMs = ts.timeMs + totalOffsetMs;
      rawOccurrences.push({
        startMs: effectiveStartMs,
        text: line.text,
        segments: line.enhancedSegments ? [...line.enhancedSegments] : undefined,
        location: ts.location ?? line.location,
        sourceIndex: sourceIndex++,
      });
    }
  }

  // Handle negative effective start times
  for (const occ of rawOccurrences) {
    if (occ.startMs < 0) {
      if (mode === 'strict') {
        diagnostics.push({
          code: 'LRC_NEGATIVE_TIME',
          message: `Effective timestamp ${occ.startMs}ms is negative after applying offsets.`,
          severity: 'error',
          location: occ.location,
        });
      } else {
        diagnostics.push({
          code: 'LRC_NEGATIVE_TIME',
          message: `Effective timestamp ${occ.startMs}ms is negative after applying offsets; clamped to 0.`,
          severity: 'warning',
          location: occ.location,
        });
        const shiftMs = -occ.startMs;
        occ.startMs = 0;
        if (occ.segments && occ.segments.length > 0) {
          occ.segments = occ.segments.map((seg) => ({
            ...seg,
            timeMs: Math.max(0, seg.timeMs - shiftMs),
          }));
        }
      }
    }
  }

  if (mode === 'strict' && diagnostics.some((d) => d.severity === 'error')) {
    return {
      normalized: { occurrences: [] },
      diagnostics,
    };
  }

  // Stable sort: by startMs ascending, preserving sourceIndex for equal start times
  rawOccurrences.sort((a, b) => {
    if (a.startMs !== b.startMs) {
      return a.startMs - b.startMs;
    }
    return a.sourceIndex - b.sourceIndex;
  });

  // Precompute next distinct start times in O(N) backward pass
  const nextDistinctStarts: (number | undefined)[] = new Array(rawOccurrences.length);
  let nextDistinct: number | undefined;
  for (let i = rawOccurrences.length - 1; i >= 0; i--) {
    if (i < rawOccurrences.length - 1 && rawOccurrences[i + 1].startMs > rawOccurrences[i].startMs) {
      nextDistinct = rawOccurrences[i + 1].startMs;
    }
    nextDistinctStarts[i] = nextDistinct;
  }

  const metadataLengthMs = parseLengthMetadata(document.metadata.length) ?? parseLengthMetadata(document.metadata.t_time);
  const defaultTrailingDurationMs = options.defaultTrailingDurationMs ?? DEFAULT_TRAILING_DURATION_MS;

  // Infer occurrence boundaries
  const occurrences: Occurrence[] = [];

  for (let i = 0; i < rawOccurrences.length; i++) {
    const curr = rawOccurrences[i];
    let endMs: number;

    const nextStartMs = nextDistinctStarts[i];

    // Minimum required duration if enhanced segments are present
    let minEnhancedEndMs: number | undefined;
    if (curr.segments && curr.segments.length > 0) {
      const lastSegment = curr.segments[curr.segments.length - 1];
      minEnhancedEndMs = curr.startMs + lastSegment.timeMs;
    }

    if (nextStartMs !== undefined) {
      endMs = nextStartMs;
      // Under 'preserve', if enhanced segments extend beyond nextStartMs, allow the line to extend
      if (overlapPolicy === 'preserve' && minEnhancedEndMs !== undefined && minEnhancedEndMs > endMs) {
        endMs = minEnhancedEndMs;
      }
    } else if (metadataLengthMs !== undefined && metadataLengthMs > curr.startMs) {
      endMs = metadataLengthMs;
    } else if (options.trackEndMs !== undefined && options.trackEndMs > curr.startMs) {
      endMs = options.trackEndMs;
    } else {
      const baseDuration = minEnhancedEndMs !== undefined
        ? minEnhancedEndMs - curr.startMs + defaultTrailingDurationMs
        : defaultTrailingDurationMs;
      endMs = curr.startMs + baseDuration;
    }

    // Ensure endMs is never less than the last enhanced segment start
    if (minEnhancedEndMs !== undefined && endMs < minEnhancedEndMs && overlapPolicy !== 'truncate') {
      endMs = minEnhancedEndMs;
    }

    const occ: Occurrence = {
      startMs: curr.startMs,
      endMs,
      text: curr.text,
    };

    if (curr.segments && curr.segments.length > 0) {
      occ.segments = curr.segments;
    }

    occurrences.push(occ);
  }

  // Overlap handling
  if (overlapPolicy === 'truncate') {
    for (let i = 0; i < occurrences.length - 1; i++) {
      const nextStrictlyLaterStart = nextDistinctStarts[i];
      if (nextStrictlyLaterStart !== undefined && occurrences[i].endMs > nextStrictlyLaterStart) {
        occurrences[i].endMs = nextStrictlyLaterStart;
      }
    }
  } else if (overlapPolicy === 'error') {
    for (let i = 0; i < occurrences.length - 1; i++) {
      const nextStrictlyLaterStart = nextDistinctStarts[i];
      if (nextStrictlyLaterStart !== undefined && occurrences[i].endMs > nextStrictlyLaterStart) {
        diagnostics.push({
          code: 'LRC_OVERLAPPING_OCCURRENCE',
          message: `Occurrence starting at ${occurrences[i].startMs}ms overlaps with next occurrence starting at ${nextStrictlyLaterStart}ms.`,
          severity: mode === 'strict' ? 'error' : 'warning',
          location: rawOccurrences[i].location,
        });
      }
    }
  }

  return {
    normalized: { occurrences },
    diagnostics,
  };
}
