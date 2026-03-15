/**
 * T017-T018: Tests for runRovoDev() runner.
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
// fs/promises mock — captures readFile / unlink calls made by runRovoDev()
// ---------------------------------------------------------------------------
const fsReadFileMock = vi.fn();
const fsUnlinkMock = vi.fn().mockResolvedValue(undefined);

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => fsReadFileMock(...args),
  unlink: (...args: unknown[]) => fsUnlinkMock(...args),
}));

// ---------------------------------------------------------------------------
// T017: Successful acli run → correct RovoDevOutput
// ---------------------------------------------------------------------------
describe("runRovoDev – happy path (T017)", () => {
  beforeEach(() => {
    supervisorSpawnMock.mockClear();
    fsReadFileMock.mockClear();
    fsUnlinkMock.mockClear();
  });

  it("returns RovoDevOutput with content and exitCode 0 on success", async () => {
    const responseText = "Here is the answer from Rovo Dev.";
    const { spawnMock, mockReadFile } = createMockAcliSpawn({
      outputFileContent: responseText,
      exitCode: 0,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

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
    const { spawnMock, mockReadFile } = createMockAcliSpawn({ outputFileContent: "ok" });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

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

  it("includes --output-file flag in the spawn argv before the prompt", async () => {
    const { spawnMock, mockReadFile } = createMockAcliSpawn({ outputFileContent: "response" });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

    const prompt = "What is the capital of France?";
    await runRovoDev({
      prompt,
      sessionId: "test-session",
      workspaceDir: "/tmp",
      timeoutMs: 10_000,
      runId: "run-t017-outputfile",
    });

    const spawnInput = supervisorSpawnMock.mock.calls[0]?.[0] as { argv?: string[] };
    const argv = spawnInput.argv ?? [];

    // --output-file must be present
    expect(argv).toContain("--output-file");

    // --output-file must come before the prompt
    const outputFileIdx = argv.indexOf("--output-file");
    const promptIdx = argv.indexOf(prompt);
    expect(outputFileIdx).toBeGreaterThanOrEqual(0);
    expect(promptIdx).toBeGreaterThan(outputFileIdx + 1); // after --output-file <value>
  });

  it("temp file name includes the runId", async () => {
    const { spawnMock, mockReadFile } = createMockAcliSpawn({ outputFileContent: "ok" });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

    const runId = "run-t017-runid";
    await runRovoDev({
      prompt: "test",
      sessionId: "test-session",
      workspaceDir: "/tmp",
      timeoutMs: 10_000,
      runId,
    });

    const spawnInput = supervisorSpawnMock.mock.calls[0]?.[0] as { argv?: string[] };
    const argv = spawnInput.argv ?? [];
    const outputFileIdx = argv.indexOf("--output-file");
    const tempPath = argv[outputFileIdx + 1] ?? "";

    expect(tempPath).toContain(runId);
  });

  it("reads the output file content instead of stdout", async () => {
    const fileContent = "Clean response from output file.";
    const noisyStdout = "\u001b[32mspinner\u001b[0m ── some noisy tool output";
    const { spawnMock, mockReadFile } = createMockAcliSpawn({
      outputFileContent: fileContent,
      stdout: noisyStdout,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

    const result = await runRovoDev({
      prompt: "test",
      sessionId: "s",
      workspaceDir: "/tmp",
      timeoutMs: 10_000,
      runId: "run-t017-filecontent",
    });

    expect(result.content).toBe(fileContent);
    expect(result.content).not.toContain("spinner");
  });

  it("falls back to stdout when output file is empty", async () => {
    const stdoutFallback = "stdout fallback content";
    const { spawnMock, mockReadFile } = createMockAcliSpawn({
      outputFileContent: "",
      stdout: stdoutFallback,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

    const result = await runRovoDev({
      prompt: "test",
      sessionId: "s",
      workspaceDir: "/tmp",
      timeoutMs: 10_000,
      runId: "run-t017-fallback",
    });

    expect(result.content).toBe(stdoutFallback);
  });

  it("falls back to stdout when readFile throws (file missing)", async () => {
    const stdoutFallback = "stdout fallback when file missing";
    const { spawnMock } = createMockAcliSpawn({
      stdout: stdoutFallback,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const result = await runRovoDev({
      prompt: "test",
      sessionId: "s",
      workspaceDir: "/tmp",
      timeoutMs: 10_000,
      runId: "run-t017-missing-file",
    });

    expect(result.content).toBe(stdoutFallback);
  });

  it("cleans up the temp file after a successful run", async () => {
    const { spawnMock, mockReadFile } = createMockAcliSpawn({ outputFileContent: "result" });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

    await runRovoDev({
      prompt: "test",
      sessionId: "s",
      workspaceDir: "/tmp",
      timeoutMs: 10_000,
      runId: "run-t017-cleanup",
    });

    expect(fsUnlinkMock).toHaveBeenCalledTimes(1);
    const unlinkedPath = fsUnlinkMock.mock.calls[0]?.[0] as string;
    expect(unlinkedPath).toContain("run-t017-cleanup");
  });

  it("includes the prompt in the spawn call", async () => {
    const { spawnMock, mockReadFile } = createMockAcliSpawn({ outputFileContent: "response" });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

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
    fsReadFileMock.mockClear();
    fsUnlinkMock.mockClear();
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
    // readFile won't be reached but mock it to avoid leaking unresolved promises
    fsReadFileMock.mockResolvedValue("");

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
    fsReadFileMock.mockResolvedValue("");

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
    const { spawnMock, mockReadFile } = createMockAcliSpawn({
      stderr: "Error: credit exhausted – please top up your Atlassian account",
      exitCode: 1,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

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

  it("throws error with code CREDIT_EXHAUSTED when output file contains 'credit exhausted'", async () => {
    const { spawnMock, mockReadFile } = createMockAcliSpawn({
      outputFileContent: "credit exhausted",
      exitCode: 1,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

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

  it("cleans up the temp file even when an error is thrown", async () => {
    const { spawnMock, mockReadFile } = createMockAcliSpawn({
      stderr: "credit exhausted",
      exitCode: 1,
    });
    supervisorSpawnMock.mockImplementation(spawnMock);
    fsReadFileMock.mockImplementation(mockReadFile);

    await expect(
      runRovoDev({
        prompt: "test",
        sessionId: "s",
        workspaceDir: "/tmp",
        timeoutMs: 10_000,
        runId: "run-t018-cleanup-on-error",
      }),
    ).rejects.toMatchObject({ code: "CREDIT_EXHAUSTED" });

    expect(fsUnlinkMock).toHaveBeenCalledTimes(1);
    const unlinkedPath = fsUnlinkMock.mock.calls[0]?.[0] as string;
    expect(unlinkedPath).toContain("run-t018-cleanup-on-error");
  });
});
