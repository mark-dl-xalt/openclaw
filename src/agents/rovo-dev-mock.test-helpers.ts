/**
 * T012: Mock helpers for Rovo Dev tests.
 *
 * These helpers create mock implementations of acli spawn and file I/O
 * so that rovo-dev tests do not require a real acli installation.
 */
import { vi } from "vitest";

export type MockAcliSpawnOptions = {
  /** Content that the mock acli process writes to the --output-file temp file */
  outputFileContent?: string;
  /** Content written to stderr */
  stderr?: string;
  /** Raw stdout (noisy terminal output); defaults to empty string */
  stdout?: string;
  /** Exit code; defaults to 0 */
  exitCode?: number;
  /** Artificial delay before resolving in ms */
  delayMs?: number;
  /** When true the spawn throws ENOENT as if acli is not installed */
  throwEnoent?: boolean;
};

/**
 * Creates a vi.fn() mock that stands in for the process-supervisor `spawn`
 * call made by `runRovoDev()`.  Resolves with a fake managed-run object whose
 * `.wait()` returns the configured exit result, or throws ENOENT.
 *
 * Also returns a `mockReadFile` function that should be used as the
 * implementation for `fs.readFile` in tests.  When `runRovoDev()` reads the
 * temp output file, `mockReadFile` returns the configured `outputFileContent`
 * (or an empty string when it is absent).
 */
export function createMockAcliSpawn(opts: MockAcliSpawnOptions): {
  /** A function (not a vi.fn mock) to pass to mockImplementation(). */
  spawnMock: (...args: unknown[]) => Promise<unknown>;
  mockReadFile: (filePath: string, encoding: string) => Promise<string>;
} {
  // Default mockReadFile — returns empty string unless overridden below.
  let mockReadFile = async (_filePath: string, _encoding: string): Promise<string> => "";

  if (opts.throwEnoent) {
    const enoent = Object.assign(new Error("spawn acli ENOENT"), { code: "ENOENT" });
    const spawnMock = async (): Promise<unknown> => {
      throw enoent;
    };
    return { spawnMock, mockReadFile };
  }

  const exitCode = opts.exitCode ?? 0;
  // stdout is the raw noisy terminal output (not the clean content).
  const stdoutRaw = opts.stdout ?? "";
  const stderr = opts.stderr ?? "";
  const fileContent = opts.outputFileContent ?? "";

  // mockReadFile simulates acli having written the clean response to the temp
  // file referenced by --output-file.
  mockReadFile = async (_filePath: string, _encoding: string): Promise<string> => {
    return fileContent;
  };

  const waitImpl = async () => {
    if (opts.delayMs && opts.delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, opts.delayMs));
    }
    return {
      reason: exitCode === 0 ? ("exit" as const) : ("exit" as const),
      exitCode,
      exitSignal: null,
      durationMs: opts.delayMs ?? 1,
      stdout: stdoutRaw,
      stderr,
      timedOut: false,
      noOutputTimedOut: false,
    };
  };

  const managedRun = {
    runId: "mock-run",
    pid: 99999,
    startedAtMs: Date.now(),
    stdin: undefined,
    wait: vi.fn().mockImplementation(waitImpl),
    cancel: vi.fn(),
  };

  // Return a plain function (not a vi.fn mock) so TypeScript accepts it in mockImplementation()
  const spawnMock = async (): Promise<unknown> => managedRun;
  return { spawnMock, mockReadFile };
}

export type MockOutputFileHelpers = {
  writeMock: ReturnType<typeof vi.fn>;
  readMock: ReturnType<typeof vi.fn>;
};

/**
 * Creates mock read/write implementations for temporary output files used
 * when capturing acli text output via a file rather than stdout.
 */
export function createMockOutputFile(): MockOutputFileHelpers {
  const writeMock = vi.fn().mockResolvedValue(undefined);
  const readMock = vi.fn().mockResolvedValue("");
  return { writeMock, readMock };
}
