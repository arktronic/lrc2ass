#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { parse, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { convert } from './core/convert.js';

export interface CliIO {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

const USAGE = `Usage: lrc2ass <input.lrc> [output.ass]

Converts an LRC lyrics file to an ASS karaoke subtitle file.
When output.ass is omitted, it defaults to the input's filename with its extension replaced by ".ass".

Options:
  -h, --help  Show this help message
`;

function writeStream(stream: NodeJS.WritableStream, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(text, (error) => (error ? reject(error) : resolve()));
  });
}

function defaultOutputPath(inputPath: string): string {
  const { dir, name } = parse(inputPath);
  return join(dir, `${name}.ass`);
}

/** Parses CLI args, converts an LRC file to an ASS file, and reports diagnostics. Returns the process exit code. */
export async function runCli(
  argv: string[],
  io: CliIO = { stdout: process.stdout, stderr: process.stderr },
): Promise<number> {
  let inputPath: string | undefined;
  let outputPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      await writeStream(io.stdout, USAGE);
      return 0;
    } else if (arg.startsWith('-') && arg !== '-') {
      await writeStream(io.stderr, `Unknown option: ${arg}\n${USAGE}`);
      return 1;
    } else if (inputPath === undefined) {
      inputPath = arg;
    } else if (outputPath === undefined) {
      outputPath = arg;
    } else {
      await writeStream(io.stderr, `Unexpected argument: ${arg}\n${USAGE}`);
      return 1;
    }
  }

  if (inputPath === undefined) {
    await writeStream(io.stderr, `Missing required input file\n${USAGE}`);
    return 1;
  }

  let text: string;
  try {
    text = await readFile(inputPath, 'utf8');
  } catch (error) {
    await writeStream(io.stderr, `Failed to read input: ${(error as Error).message}\n`);
    return 1;
  }

  const { text: ass, diagnostics } = convert(text);

  for (const diagnostic of diagnostics) {
    const location = diagnostic.location ? ` (${diagnostic.location.line}:${diagnostic.location.column})` : '';
    await writeStream(io.stderr, `${diagnostic.severity}: ${diagnostic.message}${location}\n`);
  }

  try {
    await writeFile(outputPath ?? defaultOutputPath(inputPath), ass, 'utf8');
  } catch (error) {
    await writeStream(io.stderr, `Failed to write output: ${(error as Error).message}\n`);
    return 1;
  }

  return diagnostics.some((diagnostic) => diagnostic.severity === 'error') ? 1 : 0;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
