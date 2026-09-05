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
- Serialization is deterministic: the same document always serializes to the same text. Presets, default option values, and the exact tags/output they produce are expected to evolve as the tool improves and are not a compatibility guarantee; public model/option/result *shapes* (field names and types) are what callers should be able to rely on across versions.
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
- Plain lines produce one dialogue event; enhanced segments use a selected standard ASS karaoke effect. A leading enhanced-timestamp gap is encoded as an empty karaoke syllable so timed text begins at its supplied offset, unless a pre-sweep dot count-in is shown instead (see Event Planner Defaults). The converter does not invent word timing or perform linguistic tokenization.
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
- `multi-line` is the default preset and also displays upcoming lyrics as non-karaoke `Preview` events (up to `maxPreviewLines` at once), each bounded to `previewLeadMs` before its own effective sung-start through its (possibly pre-rolled) event start, further clamped to not start before its row's previous occupant (`maxPreviewLines`+1 occurrences back) has finished being current, or before the song's very first `Lyrics` event for a row that's never been used yet — so a preview never appears before anything is on screen (e.g. during a leading instrumental gap) and never visually collides with an older line still sharing that row. `single-line` renders active lyrics only. Simultaneous lyrics are active together and do not create duplicate previews.
- For `multi-line`, the `Lyrics` and `Preview` events share one alignment (the `Preview` style's, default top-center) and each occupy their own row via a per-event `MarginV` override, evenly spaced and centered as one block using `layout.resolutionY` and `layout.rowGapPx` (the desired empty space between rows) rather than a fixed constant, so it stays correct at non-default resolutions. Each lyric keeps one permanently-assigned row by its position among planned lyric events — the first lyric always starts on the top row, regardless of any leading interlude — and its `Preview` event (if any) already occupies the row it will keep once promoted to current, so a line's on-screen position never changes when it switches from previewed to active; only its styling (size, color, karaoke) does. A simultaneous lyric group naturally lands on different rows this way too. ASS only offers 3 vertical alignment anchor edges (top/middle/bottom), which is why rows share one alignment with per-event margins instead of alternating alignments — this also lets the scheme extend cleanly past 2 rows.
- `maxPreviewLines` (1-8, default 3) raises the row count above 2 to preview that many upcoming lyrics at once, using the same per-event `MarginV` scheme. How many rows are simultaneously populated at a given moment is not fixed — it emerges from how many upcoming lyrics fall within `previewLeadMs` of the current moment, so faster passages naturally show more previews and slower ones show fewer, without resizing the block or moving the current line. Because the per-row margin is always computed, an explicit `styles.lyrics`/`styles.preview` `marginVertical` override only affects that style's own declaration (relevant to `single-line`, which has no rows), not the computed per-event row margins.
- Row assignment normally rotates in occurrence order (row = rotation modulo the row count), keeping a line's preview and current appearance on the same row. Whenever every row's most recent occupant will have already ended before an occurrence's own natural preview/appearance time — i.e. the screen would otherwise go genuinely blank for a moment, regardless of whether that gap also qualifies for an interlude — the rotation restarts from the top row instead of continuing wherever raw occurrence order would land it; that occurrence's preview (if any) uses the top row too, and later lines continue the rotation from that reset point until the next such gap. This detection accounts for `lingerMaxMs`: a same-row predecessor whose lingering would reach far enough to cover the gap is treated as still-visible coverage (no reset), while a gap `lingerMaxMs` only partially bridges still triggers a reset for its unfilled remainder.
- `lingerMaxMs` (default 5000) lets an already-sung `Lyrics` event keep showing on its row after it would otherwise end, filling the gap up to when that row's next occupant needs it (its own `Preview` start, or its own `Lyrics` start if no preview shows), capped at `lingerMaxMs`; the remainder of a longer gap is left blank. It's skipped for gaps long enough to also satisfy `interlude.minGapMs` (with a non-`'none'` strategy), deferring that dead air to the `Interlude` event instead, and is unconstrained by gap size when no `interlude` is configured. This is independent of `trailingLyricDurationMs`, which instead trims a lyric's own tail relative to its immediate next occurrence to make room for an interlude at all; `lingerMaxMs` decides how much of a same-row gap an older line keeps occupying once such a gap already exists.
- Because a `Preview` event's window is now anchored to the upcoming lyric's effective sung-start rather than spanning an entire gap, it may briefly overlap an `Interlude` event during a long instrumental break; this is expected and relies on `Interlude`'s default center alignment staying clear of both alternating `Lyrics`/`Preview` rows to avoid visual collision.
- A `text` interlude displays `♪ Instrumental ♪`; a `countdown` interlude emits one-second events labelled with whole seconds remaining.
- `fadeInMs`/`fadeOutMs` add a `\fad` tag to every emitted event; if their sum would exceed an event's own duration, both are scaled down proportionally so the event still reaches full opacity. A `Preview` event that hands off directly into its own `Lyrics` event (same row, no gap) is exempted from fading out, and that `Lyrics` event is exempted from fading in, so a line already visible as a preview doesn't flicker out and back in when it becomes current; only its true first entrance and final exit fade.
- Planner options are validated at runtime and invalid values throw `RangeError`.
- A pre-sweep dot count-in (four `·` characters, each its own karaoke slice) fills a line's leading enhanced-timestamp gap when there was genuine dead air beforehand — the gap since the previous lyric's `endMs` to this line's own effective sung-start must be at least `mainLinePreRollMs`, otherwise the gap stays an inert empty syllable as before. The first lyric of the song always qualifies (no predecessor to compare against). A line's own `Preview` event (multi-line preset) mirrors the same dot prefix (statically, without the animated timing) whenever its Lyrics event will show one, so nothing visually shifts at the Preview-to-Lyrics handoff. This gives the singer a visible, timed cue for exactly when to start, in place of an earlier attempt (a `\move`-animated drawn dot), which was tried and reverted.

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
