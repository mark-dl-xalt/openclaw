/**
 * T023/T025: Rovo Dev CLI runner.
 *
 * Invokes `acli rovodev run --yolo <prompt>` via the process supervisor,
 * handles timeouts, ENOENT, credit exhaustion, and returns a typed
 * RovoDevOutput on success.
 */

import { getProcessSupervisor } from "../process/supervisor/index.js";
import type { RovoDevCredential } from "./rovo-dev-auth.js";

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
  /** Optional credential (injected env vars). */
  credential?: RovoDevCredential;
  /** Additional env vars to inject into the subprocess. */
  env?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// buildRovoDevEnv (T025)
// ---------------------------------------------------------------------------

/**
 * Builds the env var object to inject into the acli subprocess.
 * `USER_EMAIL` and `USER_API_TOKEN` are the env vars acli reads.
 */
export function buildRovoDevEnv(credential: RovoDevCredential): Record<string, string> {
  return {
    USER_EMAIL: credential.email,
    USER_API_TOKEN: credential.accessToken,
  };
}

// ---------------------------------------------------------------------------
// runRovoDev
// ---------------------------------------------------------------------------

/**
 * Runs `acli rovodev run --yolo <prompt>` via the process supervisor and
 * returns the text output on success.
 *
 * Throws a RovoDevError with an appropriate `.code` on failure.
 */
export async function runRovoDev(params: RunRovoDevParams): Promise<RovoDevOutput> {
  const { prompt, sessionId, workspaceDir, timeoutMs, runId, credential, env: extraEnv } = params;

  const supervisor = getProcessSupervisor();

  // Build the env to inject
  const credentialEnv = credential ? buildRovoDevEnv(credential) : {};
  const spawnEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...credentialEnv,
    ...extraEnv,
  };

  // Build argv: acli rovodev run --yolo <prompt>
  const argv = ["acli", "rovodev", "run", "--yolo", prompt];

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

  const exit = await managedRun.wait();

  // Handle timeout conditions
  if (exit.timedOut || exit.noOutputTimedOut) {
    throw new RovoDevError("PROCESS_TIMEOUT", `Rovo Dev process timed out after ${timeoutMs}ms`);
  }

  if (exit.reason === "overall-timeout" || exit.reason === "no-output-timeout") {
    throw new RovoDevError("PROCESS_TIMEOUT", `Rovo Dev process timed out: ${exit.reason}`);
  }

  // Gather all output for credit check and content
  const stdoutContent = exit.stdout ?? "";
  const stderrContent = exit.stderr ?? "";
  const combinedOutput = `${stdoutContent}\n${stderrContent}`.toLowerCase();

  // Check for credit exhaustion in either stdout or stderr
  if (combinedOutput.includes("credit exhausted")) {
    throw new RovoDevError(
      "CREDIT_EXHAUSTED",
      "Rovo Dev credits exhausted — please top up your Atlassian account",
    );
  }

  // Non-zero exit is a general failure (but credit exhaustion already handled above)
  if (exit.exitCode !== 0 && exit.exitCode !== null) {
    throw new RovoDevError(
      "RUN_FAILED",
      `acli exited with code ${exit.exitCode}: ${stderrContent || stdoutContent}`,
    );
  }

  return {
    content: stdoutContent,
    exitCode: exit.exitCode ?? 0,
  };
}
