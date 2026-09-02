# lrc2ass

[![CI](https://github.com/arktronic/lrc2ass/actions/workflows/ci.yml/badge.svg)](https://github.com/arktronic/lrc2ass/actions/workflows/ci.yml)

A TypeScript library and Node.js CLI for converting LRC lyrics into readable, libass-compatible ASS karaoke subtitles.

## Implemented

- Simple and enhanced word-timed LRC.
- Multiple timestamps per lyric line.
- Normalized line timing, overlap policies, and final-duration inference.
- ASS event planning with karaoke highlighting, configurable role styles and layout, instrumental gaps, and single-line/multi-line presets.
- ASS serialization of planned events.
- One-step conversion API.
- Strict and tolerant parsing with structured diagnostics.
- Editable LRC and ASS document models.
- Staged parsing, normalization, event-planning, and serialization APIs.

## Pending

- CLI support.

The dependency-free vanilla JS core is intended for all modern JavaScript runtimes. Planned output is deterministic and targets libass.

## Status

The project is in early implementation and is not published yet.

See [the design document](docs/design.md) for scope, architecture, and conversion decisions.
