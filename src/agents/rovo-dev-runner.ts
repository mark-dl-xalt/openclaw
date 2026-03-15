/**
 * T023/T025: Rovo Dev CLI runner.
 *
 * Invokes `acli rovodev run --yolo <prompt>` via the process supervisor,
 * handles timeouts, ENOENT, credit exhaustion, and returns a typed
 * RovoDevOutput on success.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getProcessSupervisor } from "../process/supervisor/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Successful output from a Rovo Dev run. */
export type RovoDevOutput = {
  content: string;
  exitCode: number;
};

/** Error codes emitted by RovoDevError. */
export type RovoDevErrorCode =
  | "PROCESS_TIMEOUT"
  | "CLI_NOT_FOUND"
  | "CREDIT_EXHAUSTED"
  | "RUN_FAILED";

/** Typed error thrown by runRovoDev() on failure. */
export class RovoDevError extends Error {
  readonly code: RovoDevErrorCode;

  constructor(code: RovoDevErrorCode, message: string) {
    super(message);
    this.name = "RovoDevError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// runRovoDev params
// ---------------------------------------------------------------------------

export type RunRovoDevParams = {
  prompt: string;
  sessionId: string;
  workspaceDir: string;
  timeoutMs: number;
  runId: string;
  /** Additional env vars to inject into the subprocess. */
  env?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// runRovoDev
// ---------------------------------------------------------------------------

/**
 * Runs `acli rovodev run --yolo --output-file <tempfile> <prompt>` via the
 * process supervisor and returns the clean text output on success.
 *
 * The `--output-file` flag causes acli to write only the final response text
 * to a file, avoiding ANSI codes, spinners, and other terminal noise that
 * appear on stdout.  The temp file is read after the process exits and its
 * content is returned as `RovoDevOutput.content`.  If the file is empty or
 * missing, stdout is used as a fallback.  The temp file is always removed in
 * a finally block regardless of success or failure.
 *
 * Throws a RovoDevError with an appropriate `.code` on failure.
 */
export async function runRovoDev(params: RunRovoDevParams): Promise<RovoDevOutput> {
  const { prompt, sessionId, workspaceDir, timeoutMs, runId, env: extraEnv } = params;

  const supervisor = getProcessSupervisor();

  // acli authenticates via macOS keychain (ATAT tokens) — no env var injection needed.
  const spawnEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...extraEnv,
  };

  // Temp file that acli will write the clean final response into.
  const tempPath = path.join(os.tmpdir(), `rovo-dev-output-${runId}.txt`);

  // Build argv: acli rovodev run --yolo --output-file <tempPath> <prompt>
  // --output-file must come before the prompt positional argument.
  const argv = ["acli", "rovodev", "run", "--yolo", "--output-file", tempPath, prompt];

  let managedRun: Awaited<ReturnType<typeof supervisor.spawn>>;

  try {
    managedRun = await supervisor.spawn({
      mode: "child",
      runId,
      sessionId,
      backendId: "rovo-dev",
      cwd: workspaceDir,
      argv,
      env: spawnEnv,
      timeoutMs,
      captureOutput: true,
      input: prompt,
    });
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") {
      throw new RovoDevError(
        "CLI_NOT_FOUND",
        "acli not found: ensure @atlassian/acli is installed and on PATH",
      );
    }
    throw err;
  }

  try {
    const exit = await managedRun.wait();

    // Handle timeout conditions
    if (exit.timedOut || exit.noOutputTimedOut) {
      throw new RovoDevError("PROCESS_TIMEOUT", `Rovo Dev process timed out after ${timeoutMs}ms`);
    }

    if (exit.reason === "overall-timeout" || exit.reason === "no-output-timeout") {
      throw new RovoDevError("PROCESS_TIMEOUT", `Rovo Dev process timed out: ${exit.reason}`);
    }

    // Gather stdout/stderr for credit checks and fallback content.
    const stdoutContent = exit.stdout ?? "";
    const stderrContent = exit.stderr ?? "";

    // Read the output file written by acli --output-file.
    // Fall back to stdout if the file is absent or empty.
    let outputFileContent = "";
    try {
      outputFileContent = await fs.readFile(tempPath, "utf8");
    } catch {
      // File not written (e.g. acli errored before writing) — stdout fallback below.
    }

    const cleanContent = outputFileContent.trim() ? outputFileContent : stdoutContent;

    // Credit exhaustion can appear in stdout, stderr, or the output file.
    const combinedOutput = `${cleanContent}\n${stdoutContent}\n${stderrContent}`.toLowerCase();

    if (combinedOutput.includes("credit exhausted")) {
      throw new RovoDevError(
        "CREDIT_EXHAUSTED",
        "Rovo Dev credits exhausted — please top up your Atlassian account",
      );
    }

    // Non-zero exit is a general failure (credit exhaustion already handled above).
    if (exit.exitCode !== 0 && exit.exitCode !== null) {
      throw new RovoDevError(
        "RUN_FAILED",
        `acli exited with code ${exit.exitCode}: ${stderrContent || stdoutContent}`,
      );
    }

    return {
      content: cleanContent,
      exitCode: exit.exitCode ?? 0,
    };
  } finally {
    // Always clean up the temp file, ignoring errors if it was never created.
    fs.unlink(tempPath).catch(() => undefined);
  }
}
