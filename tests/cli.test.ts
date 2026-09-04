import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';

function captureStream(): { stream: Writable; text: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });
  return { stream, text: () => Buffer.concat(chunks).toString('utf8') };
}

function io() {
  const stdout = captureStream();
  const stderr = captureStream();
  return {
    stdout: stdout.stream,
    stderr: stderr.stream,
    stdoutText: stdout.text,
    stderrText: stderr.text,
  };
}

describe('runCli', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lrc2ass-cli-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('prints usage and exits 0 for --help', async () => {
    const { stdout, stderr, stdoutText } = io();

    const code = await runCli(['--help'], { stdout, stderr });

    expect(code).toBe(0);
    expect(stdoutText()).toContain('Usage: lrc2ass');
  });

  it('rejects an unknown option with exit code 1', async () => {
    const { stdout, stderr, stderrText } = io();

    const code = await runCli(['--bogus'], { stdout, stderr });

    expect(code).toBe(1);
    expect(stderrText()).toContain('Unknown option: --bogus');
  });

  it('requires an input file argument', async () => {
    const { stdout, stderr, stderrText } = io();

    const code = await runCli([], { stdout, stderr });

    expect(code).toBe(1);
    expect(stderrText()).toContain('Missing required input file');
  });

  it('converts an input file to an explicit output file', async () => {
    const inputPath = join(dir, 'input.lrc');
    const outputPath = join(dir, 'custom.ass');
    await writeFile(inputPath, '[00:00.00]Hello world\r\n', 'utf8');
    const { stdout, stderr } = io();

    const code = await runCli([inputPath, outputPath], { stdout, stderr });

    expect(code).toBe(0);
    const output = await readFile(outputPath, 'utf8');
    expect(output).toContain('[Events]\r\n');
    expect(output).toContain('Hello world');
  });

  it('defaults the output filename to the input filename with its extension replaced', async () => {
    const inputPath = join(dir, 'song.lrc');
    await writeFile(inputPath, '[00:00.00]Hello world\r\n', 'utf8');
    const { stdout, stderr } = io();

    const code = await runCli([inputPath], { stdout, stderr });

    expect(code).toBe(0);
    const output = await readFile(join(dir, 'song.ass'), 'utf8');
    expect(output).toContain('Hello world');
  });

  it('reports warning diagnostics on stderr without failing the exit code', async () => {
    const inputPath = join(dir, 'input.lrc');
    await writeFile(inputPath, '[ti:Unclosed\r\n[00:00.00]Hello world\r\n', 'utf8');
    const { stdout, stderr, stderrText } = io();

    const code = await runCli([inputPath], { stdout, stderr });

    expect(code).toBe(0);
    expect(stderrText()).toContain('warning:');
  });

  it('exits with code 1 when the input file cannot be read', async () => {
    const { stdout, stderr, stderrText } = io();

    const code = await runCli([join(dir, 'missing.lrc')], { stdout, stderr });

    expect(code).toBe(1);
    expect(stderrText()).toContain('Failed to read input');
  });
});
