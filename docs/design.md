# lrc2ass Design

`lrc2ass` is a TypeScript library and Node.js CLI for converting LRC lyrics into readable, libass-compatible ASS karaoke subtitles.

## Scope

- Parse simple LRC, enhanced word-timed LRC, multiple timestamps per line, metadata, and explicitly supported common variants. Sanity check against other libraries, such as https://github.com/jacquesh/foo_openlyrics.
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
- Diagnostic fields are public, but diagnostic code strings remain internal until the public API is stabilized.
- Times use integer milliseconds until conversion to ASS centiseconds.
- Presets are immutable option sets, not separate conversion paths. Explicit caller options override preset values.
- Serialization is deterministic. Public models, options, result shapes, presets, and serialized output are compatibility-sensitive.
- libass is the rendering baseline; renderer-specific extensions are initially out of scope.

## Conversion Rules

- Apply metadata and caller offsets before normalization.
- Expand every line timestamp into an occurrence. Equal starts remain distinct and retain source order.
- For enhanced repeated lines, apply each inline timestamp's offset from the first line timestamp to every occurrence.
- Infer a line end from the next later occurrence. For the final line, use LRC `length` metadata, `t_time` metadata, a caller-provided track end/duration, or the exported 5000 ms fallback, in that order. A bound that is not later than the final lyric is diagnosed and falls back in tolerant mode.
- Infer an enhanced segment's end from the next inline timestamp or the containing line end.
- Handle source overlaps through an explicit `preserve`, `truncate`, or `error` policy.
- Negative or decreasing effective times fail in strict mode; tolerant mode clamps them and emits diagnostics.
- Completely untimed lines remain in the model but cannot produce events without caller-supplied timing.
- Plain lines produce one dialogue event; enhanced segments use a selected standard ASS karaoke effect. A leading enhanced-timestamp gap is encoded as an empty karaoke syllable so timed text begins at its supplied offset. The converter does not invent word timing or perform linguistic tokenization.
- A lyric's effective sung-start is its first enhanced segment's absolute time (or its own timestamp if plain/segment-less).
- Interlude options define the minimum gap, margins, text/countdown strategy, style, and placement. `trailingLyricDurationMs` limits an enhanced lyric after its final timed segment (or a plain lyric after its start), creating a gap before the next lyric without truncating earlier enhanced timing. A gap before the very first lyric (e.g. an instrumental intro) is detected the same way as any inter-lyric gap.
- Escape lyric text so embedded ASS override syntax cannot execute.
- The parser accepts documented timestamp forms with flexible hour/minute widths, validates component ranges and safe integer precision, and rejects values outside that range.
- Public LRC and ASS models are directly editable. Callers who edit them are responsible for preserving their invariants.

## ASS Output

- Generate ASS `v4.00+` with `[Script Info]`, `[V4+ Styles]`, and `[Events]`.
- Include explicit play resolution and at least one lyric style.
- Quantize boundaries to centiseconds once. Derive karaoke durations from adjacent quantized boundaries; events that collapse to zero duration are omitted.
- Use stable ordering, naming, escaping, numeric formatting, and line endings. Planner events are ordered by start time, layer, then source insertion order.

### Event Planner Defaults

- The planner emits deterministic `Lyrics`, `Preview`, and `Interlude` styles. `PlanStyleOptions` configures font, colors, alignment, and margins for each role; colors use `#RRGGBB` values. A named interlude style is emitted when selected.
- `multi-line` is the default preset and also displays one next strictly later lyric as a non-karaoke `Preview` event, bounded to `previewLeadMs` before that lyric's effective sung-start (clamped to the active group's own start) through its (possibly pre-rolled) event start. `single-line` renders active lyrics only. Simultaneous lyrics are active together and do not create duplicate previews.
- Because a `Preview` event's window is now anchored to the upcoming lyric's effective sung-start rather than spanning an entire gap, it may briefly overlap an `Interlude` event during a long instrumental break; this is expected and relies on their differing default alignments (top-center vs. bottom-center) to avoid visual collision.
- A `text` interlude displays `♪ Instrumental ♪`; a `countdown` interlude emits one-second events labelled with whole seconds remaining.
- Planner options are validated at runtime and invalid values throw `RangeError`.

## Configuration Areas

- Timing, final duration, and overlap behavior.
- Karaoke effect.
- Resolution, alignment, margins, layers, and current/next preview timing.
- Font and ASS style values.
- Interlude behavior.
- Metadata emission and serialization formatting.

Options remain typed, declarative, and serializable. Advanced callers can edit the ASS model directly.

For `convert()`, normalization inherits `parse.mode` unless `normalize.mode` explicitly overrides it. Both default to tolerant mode.

## Verification

Tests should cover parsing and recovery, timing inference, event planning, deterministic serialization, staged/one-step equivalence, ESM loading, and browser use. Visual rendering verification against libass/ffmpeg is out of scope: output correctness is established through deterministic, structural assertions on serialized ASS text instead.
