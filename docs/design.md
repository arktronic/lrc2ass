# lrc2ass Design

`lrc2ass` is a TypeScript library and Node.js CLI for converting LRC lyrics into readable, libass-compatible ASS karaoke subtitles.

## Scope

- Parse simple LRC, enhanced word-timed LRC, multiple timestamps per line, metadata, and explicitly supported common variants.
- Generate line-timed and word-highlighted ASS.
- Support configurable timing, styles, layout, gaps/interludes, and a multi-line preset.
- Expose editable LRC and ASS models, staged APIs, and a one-step conversion API.
- Keep plugins, complex effects, and graphical tools out of the initial release.

## Architecture

```text
LRC text -> parse -> LRC document -> normalize timing -> plan events
         -> ASS document -> serialize -> ASS text
```

- **Parser:** recognizes supported LRC and returns a document plus diagnostics.
- **Normalizer:** applies offsets, expands repeated timestamps, orders occurrences, and infers boundaries.
- **Event planner:** applies karaoke, layout, style, preset, and interlude options.
- **Serializer:** produces canonical ASS text.
- **CLI:** handles Node.js files, streams, messages, and exit codes; it contains no conversion rules.

The public API provides parse, convert, and serialize stages plus a one-step function composed from those stages.

## Core Decisions

- The core has no runtime dependencies or Node.js APIs. It supports ESM, browsers, and other modern JavaScript runtimes.
- LRC and ASS models are public and editable. The LRC model preserves source order, locations, multiple timestamps, and recoverable unknown entries, but need not reproduce the original bytes.
- Parsing requires an explicit `strict` or `tolerant` mode. Recoverable source problems use stable structured diagnostics; exceptions are reserved for API misuse and broken invariants.
- Times use integer milliseconds until conversion to ASS centiseconds.
- Presets are immutable option sets, not separate conversion paths. Explicit caller options override preset values.
- Serialization is deterministic. Public models, options, result shapes, diagnostic codes, presets, and serialized output are compatibility-sensitive.
- libass is the rendering baseline; renderer-specific extensions are initially out of scope.

## Conversion Rules

- Apply metadata and caller offsets before normalization.
- Expand every line timestamp into an occurrence. Equal starts remain distinct and retain source order.
- For enhanced repeated lines, apply each inline timestamp's offset from the first line timestamp to every occurrence.
- Infer a line end from the next later occurrence. For the final line, use LRC length metadata, a caller-provided track end/duration, or a default fallback, in that order.
- Infer an enhanced segment's end from the next inline timestamp or the containing line end.
- Handle source overlaps through an explicit `preserve`, `truncate`, or `error` policy.
- Negative or decreasing effective times fail in strict mode; tolerant mode clamps them and emits diagnostics.
- Completely untimed lines remain in the model but cannot produce events without caller-supplied timing.
- Plain lines produce one dialogue event; enhanced segments use a selected standard ASS karaoke effect. The converter does not invent word timing or perform linguistic tokenization.
- Interlude options define the minimum gap, margins, text/countdown strategy, style, and placement.
- Escape lyric text so embedded ASS override syntax cannot execute.

## ASS Output

- Generate ASS `v4.00+` with `[Script Info]`, `[V4+ Styles]`, and `[Events]`.
- Include explicit play resolution and at least one lyric style.
- Quantize boundaries to centiseconds once. Derive karaoke durations from adjacent quantized boundaries so they sum to the event duration.
- Use stable ordering, naming, escaping, numeric formatting, and line endings.

## Configuration Areas

- Timing, final duration, and overlap behavior.
- Karaoke effect.
- Resolution, alignment, margins, layers, and current/next preview timing.
- Font and ASS style values.
- Interlude behavior.
- Metadata emission and serialization formatting.

Options remain typed, declarative, and serializable. Advanced callers can edit the ASS model directly.

## Verification

Tests should cover parsing and recovery, timing inference, event planning, deterministic serialization, staged/one-step equivalence, ESM loading, browser use, and selected libass rendering fixtures.
