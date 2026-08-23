# lrc2ass

[![CI](https://github.com/arktronic/lrc2ass/actions/workflows/ci.yml/badge.svg)](https://github.com/arktronic/lrc2ass/actions/workflows/ci.yml)

A TypeScript library and Node.js CLI for converting LRC lyrics into readable, libass-compatible ASS karaoke subtitles.

## Planned Capabilities

- Simple and enhanced word-timed LRC.
- Multiple timestamps per lyric line.
- Line timing and ASS karaoke highlighting.
- Configurable styles, layout, timing, and instrumental gaps.
- A multi-line presentation preset.
- Strict and tolerant parsing with structured diagnostics.
- Editable LRC and ASS document models.
- Staged APIs, a one-step conversion API, and a CLI.

The dependency-free vanilla JS core is intended for all modern JavaScript runtimes. Output will be deterministic and target libass.

## Status

The project is in early implementation and is not published yet.

See [the design document](docs/design.md) for scope, architecture, and conversion decisions.
