import { execFile, type ExecFileException } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const binPath = fileURLToPath(new URL('../dist/bin.js', import.meta.url));

async function runBin(execPath: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [execPath, ...args]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    const execError = error as ExecFileException & { stdout: string; stderr: string };
    return { code: typeof execError.code === 'number' ? execError.code : 1, stdout: execError.stdout, stderr: execError.stderr };
  }
}

// Exercises the built package.json "bin" entry point as a real subprocess. Argument parsing,
// error paths, and diagnostics are already covered by unit tests against runCli() in cli.test.ts;
// these tests only need to prove the packaged entry point actually wires up to it.
describe('bin.js smoke test', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lrc2ass-bin-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('converts an input file to an output file', async () => {
    const inputPath = join(dir, 'song.lrc');
    const outputPath = join(dir, 'song.ass');
    await writeFile(inputPath, '[00:00.00]Hello world\r\n', 'utf8');

    const { code } = await runBin(binPath, [inputPath, outputPath]);

    expect(code).toBe(0);
    const output = await readFile(outputPath, 'utf8');
    expect(output).toContain('Hello world');
  });

  it('still runs when invoked through a symlink to the bin script', async (context) => {
    const inputPath = join(dir, 'song.lrc');
    const outputPath = join(dir, 'song.ass');
    await writeFile(inputPath, '[00:00.00]Hello world\r\n', 'utf8');
    const linkPath = join(dir, 'lrc2ass-link.js');

    try {
      await symlink(binPath, linkPath, 'file');
    } catch (error) {
      // Creating file symlinks needs elevated privileges/Developer Mode on some Windows setups.
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        context.skip();
      }
      throw error;
    }

    const { code } = await runBin(linkPath, [inputPath, outputPath]);

    expect(code).toBe(0);
    const output = await readFile(outputPath, 'utf8');
    expect(output).toContain('Hello world');
  });
});
