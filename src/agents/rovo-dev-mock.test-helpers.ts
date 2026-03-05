/**
 * T012: Mock helpers for Rovo Dev tests.
 *
 * These helpers create mock implementations of acli spawn and file I/O
 * so that rovo-dev tests do not require a real acli installation.
 */
import { vi } from "vitest";

export type MockAcliSpawnOptions = {
  /** Content that the mock acli process writes as stdout */
  outputFileContent?: string;
  /** Content written to stderr */
  stderr?: string;
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
 */
export function createMockAcliSpawn(opts: MockAcliSpawnOptions): {
  spawnMock: ReturnType<typeof vi.fn>;
} {
  const spawnMock = vi.fn();

  if (opts.throwEnoent) {
    const enoent = Object.assign(new Error("spawn acli ENOENT"), { code: "ENOENT" });
    spawnMock.mockRejectedValue(enoent);
    return { spawnMock };
  }

  const exitCode = opts.exitCode ?? 0;
  const stdout = opts.outputFileContent ?? "";
  const stderr = opts.stderr ?? "";

  const waitImpl = async () => {
    if (opts.delayMs && opts.delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, opts.delayMs));
    }
    return {
      reason: exitCode === 0 ? ("exit" as const) : ("exit" as const),
      exitCode,
      exitSignal: null,
      durationMs: opts.delayMs ?? 1,
      stdout,
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

  spawnMock.mockResolvedValue(managedRun);
  return { spawnMock };
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
