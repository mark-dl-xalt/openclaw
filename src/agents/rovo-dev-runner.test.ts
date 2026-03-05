/**
 * T017-T018: Tests for runRovoDev() runner.
 *
 * These tests import from files that do not exist yet.
 * They MUST fail until the implementation is written.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAcliSpawn } from "./rovo-dev-mock.test-helpers.js";
// T017 + T018: imports from the not-yet-created implementation file.
import { runRovoDev } from "./rovo-dev-runner.js";
import type { RovoDevOutput } from "./rovo-dev-runner.js";

// ---------------------------------------------------------------------------
// Supervisor mock (mirrors the pattern in cli-runner.test.ts)
// ---------------------------------------------------------------------------
const supervisorSpawnMock = vi.fn();

vi.mock("../process/supervisor/index.js", () => ({
  getProcessSupervisor: () => ({
    spawn: (...args: unknown[]) => supervisorSpawnMock(...args),
    cancel: vi.fn(),
    cancelScope: vi.fn(),
    reconcileOrphans: vi.fn(),
    getRecord: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// T017: Successful acli run → correct RovoDevOutput
// ---------------------------------------------------------------------------
describe("runRovoDev – happy path (T017)", () => {
  beforeEach(() => {
    supervisorSpawnMock.mockClear();
  });

  it("returns RovoDevOutput with content and exitCode 0 on success", async () => {
    const responseText = "Here is the answer from Rovo Dev.";
    const { spawnMock } = createMockAcliSpawn({
      outputFileContent: responseText,
      exitCode: 0,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);

    const result: RovoDevOutput = await runRovoDev({
      prompt: "Explain async/await",
      sessionId: "test-session",
      workspaceDir: "/tmp",
      timeoutMs: 10_000,
      runId: "run-t017",
    });

    expect(result.content).toBe(responseText);
    expect(result.exitCode).toBe(0);
  });

  it("spawns acli with 'rovodev', 'run', '--yolo' in argv", async () => {
    const { spawnMock } = createMockAcliSpawn({ outputFileContent: "ok" });
    supervisorSpawnMock.mockImplementation(spawnMock);

    await runRovoDev({
      prompt: "test prompt",
      sessionId: "test-session",
      workspaceDir: "/tmp",
      timeoutMs: 10_000,
      runId: "run-t017b",
    });

    expect(supervisorSpawnMock).toHaveBeenCalledTimes(1);
    const spawnInput = supervisorSpawnMock.mock.calls[0]?.[0] as { argv?: string[] };
    expect(spawnInput.argv).toEqual(expect.arrayContaining(["acli", "rovodev", "run", "--yolo"]));
  });

  it("includes the prompt in the spawn call", async () => {
    const { spawnMock } = createMockAcliSpawn({ outputFileContent: "response" });
    supervisorSpawnMock.mockImplementation(spawnMock);

    const prompt = "What is the capital of France?";
    await runRovoDev({
      prompt,
      sessionId: "test-session",
      workspaceDir: "/tmp",
      timeoutMs: 10_000,
      runId: "run-t017c",
    });

    const spawnInput = supervisorSpawnMock.mock.calls[0]?.[0] as {
      argv?: string[];
      input?: string;
    };
    // Prompt is either in argv or passed as stdin input
    const promptInArgv = spawnInput.argv?.includes(prompt) ?? false;
    const promptInInput = spawnInput.input?.includes(prompt) ?? false;
    expect(promptInArgv || promptInInput).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T018: Edge cases – timeout, ENOENT, credit exhausted
// ---------------------------------------------------------------------------
describe("runRovoDev – error edge cases (T018)", () => {
  beforeEach(() => {
    supervisorSpawnMock.mockClear();
  });

  it("throws error with code PROCESS_TIMEOUT when no-output timeout fires", async () => {
    supervisorSpawnMock.mockResolvedValueOnce({
      runId: "mock-run",
      pid: 12345,
      startedAtMs: Date.now(),
      stdin: undefined,
      cancel: vi.fn(),
      wait: vi.fn().mockResolvedValue({
        reason: "no-output-timeout",
        exitCode: null,
        exitSignal: "SIGKILL",
        durationMs: 5000,
        stdout: "",
        stderr: "",
        timedOut: true,
        noOutputTimedOut: true,
      }),
    });

    await expect(
      runRovoDev({
        prompt: "test",
        sessionId: "test-session",
        workspaceDir: "/tmp",
        timeoutMs: 5_000,
        runId: "run-t018-timeout",
      }),
    ).rejects.toMatchObject({ code: "PROCESS_TIMEOUT" });
  });

  it("throws error with code PROCESS_TIMEOUT when overall timeout fires", async () => {
    supervisorSpawnMock.mockResolvedValueOnce({
      runId: "mock-run",
      pid: 12345,
      startedAtMs: Date.now(),
      stdin: undefined,
      cancel: vi.fn(),
      wait: vi.fn().mockResolvedValue({
        reason: "overall-timeout",
        exitCode: null,
        exitSignal: "SIGKILL",
        durationMs: 5000,
        stdout: "",
        stderr: "",
        timedOut: true,
        noOutputTimedOut: false,
      }),
    });

    await expect(
      runRovoDev({
        prompt: "test",
        sessionId: "test-session",
        workspaceDir: "/tmp",
        timeoutMs: 5_000,
        runId: "run-t018-overall-timeout",
      }),
    ).rejects.toMatchObject({ code: "PROCESS_TIMEOUT" });
  });

  it("throws error with code CLI_NOT_FOUND when acli spawn throws ENOENT", async () => {
    const { spawnMock } = createMockAcliSpawn({ throwEnoent: true });
    supervisorSpawnMock.mockImplementation(spawnMock);

    await expect(
      runRovoDev({
        prompt: "test",
        sessionId: "test-session",
        workspaceDir: "/tmp",
        timeoutMs: 10_000,
        runId: "run-t018-enoent",
      }),
    ).rejects.toMatchObject({ code: "CLI_NOT_FOUND" });
  });

  it("throws error with code CREDIT_EXHAUSTED when stderr contains 'credit exhausted'", async () => {
    const { spawnMock } = createMockAcliSpawn({
      stderr: "Error: credit exhausted – please top up your Atlassian account",
      exitCode: 1,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);

    await expect(
      runRovoDev({
        prompt: "test",
        sessionId: "test-session",
        workspaceDir: "/tmp",
        timeoutMs: 10_000,
        runId: "run-t018-credits",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_EXHAUSTED" });
  });

  it("throws error with code CREDIT_EXHAUSTED when stdout contains 'credit exhausted'", async () => {
    const { spawnMock } = createMockAcliSpawn({
      outputFileContent: "credit exhausted",
      exitCode: 1,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);

    await expect(
      runRovoDev({
        prompt: "test",
        sessionId: "test-session",
        workspaceDir: "/tmp",
        timeoutMs: 10_000,
        runId: "run-t018-credits-stdout",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_EXHAUSTED" });
  });
});
