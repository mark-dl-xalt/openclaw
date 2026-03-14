import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { runCliAgent } from "./cli-runner.js";
import { resolveCliNoOutputTimeoutMs } from "./cli-runner/helpers.js";
import { FailoverError } from "./failover-error.js";

const supervisorSpawnMock = vi.fn();
const enqueueSystemEventMock = vi.fn();
const requestHeartbeatNowMock = vi.fn();

vi.mock("../process/supervisor/index.js", () => ({
  getProcessSupervisor: () => ({
    spawn: (...args: unknown[]) => supervisorSpawnMock(...args),
    cancel: vi.fn(),
    cancelScope: vi.fn(),
    reconcileOrphans: vi.fn(),
    getRecord: vi.fn(),
  }),
}));

vi.mock("../infra/system-events.js", () => ({
  enqueueSystemEvent: (...args: unknown[]) => enqueueSystemEventMock(...args),
}));

vi.mock("../infra/heartbeat-wake.js", () => ({
  requestHeartbeatNow: (...args: unknown[]) => requestHeartbeatNowMock(...args),
}));

type MockRunExit = {
  reason:
    | "manual-cancel"
    | "overall-timeout"
    | "no-output-timeout"
    | "spawn-error"
    | "signal"
    | "exit";
  exitCode: number | null;
  exitSignal: NodeJS.Signals | number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  noOutputTimedOut: boolean;
};

function createManagedRun(exit: MockRunExit, pid = 1234) {
  return {
    runId: "run-supervisor",
    pid,
    startedAtMs: Date.now(),
    stdin: undefined,
    wait: vi.fn().mockResolvedValue(exit),
    cancel: vi.fn(),
  };
}

describe("runCliAgent with process supervisor", () => {
  beforeEach(() => {
    supervisorSpawnMock.mockClear();
    enqueueSystemEventMock.mockClear();
    requestHeartbeatNowMock.mockClear();
  });

  it("runs CLI through supervisor and returns payload", async () => {
    supervisorSpawnMock.mockResolvedValueOnce(
      createManagedRun({
        reason: "exit",
        exitCode: 0,
        exitSignal: null,
        durationMs: 50,
        stdout: "ok",
        stderr: "",
        timedOut: false,
        noOutputTimedOut: false,
      }),
    );

    const result = await runCliAgent({
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      prompt: "hi",
      provider: "codex-cli",
      model: "gpt-5.2-codex",
      timeoutMs: 1_000,
      runId: "run-1",
      cliSessionId: "thread-123",
    });

    expect(result.payloads?.[0]?.text).toBe("ok");
    expect(supervisorSpawnMock).toHaveBeenCalledTimes(1);
    const input = supervisorSpawnMock.mock.calls[0]?.[0] as {
      argv?: string[];
      mode?: string;
      timeoutMs?: number;
      noOutputTimeoutMs?: number;
      replaceExistingScope?: boolean;
      scopeKey?: string;
    };
    expect(input.mode).toBe("child");
    expect(input.argv?.[0]).toBe("codex");
    expect(input.timeoutMs).toBe(1_000);
    expect(input.noOutputTimeoutMs).toBeGreaterThanOrEqual(1_000);
    expect(input.replaceExistingScope).toBe(true);
    expect(input.scopeKey).toContain("thread-123");
  });

  it("fails with timeout when no-output watchdog trips", async () => {
    supervisorSpawnMock.mockResolvedValueOnce(
      createManagedRun({
        reason: "no-output-timeout",
        exitCode: null,
        exitSignal: "SIGKILL",
        durationMs: 200,
        stdout: "",
        stderr: "",
        timedOut: true,
        noOutputTimedOut: true,
      }),
    );

    await expect(
      runCliAgent({
        sessionId: "s1",
        sessionFile: "/tmp/session.jsonl",
        workspaceDir: "/tmp",
        prompt: "hi",
        provider: "codex-cli",
        model: "gpt-5.2-codex",
        timeoutMs: 1_000,
        runId: "run-2",
        cliSessionId: "thread-123",
      }),
    ).rejects.toThrow("produced no output");
  });

  it("enqueues a system event and heartbeat wake on no-output watchdog timeout for session runs", async () => {
    supervisorSpawnMock.mockResolvedValueOnce(
      createManagedRun({
        reason: "no-output-timeout",
        exitCode: null,
        exitSignal: "SIGKILL",
        durationMs: 200,
        stdout: "",
        stderr: "",
        timedOut: true,
        noOutputTimedOut: true,
      }),
    );

    await expect(
      runCliAgent({
        sessionId: "s1",
        sessionKey: "agent:main:main",
        sessionFile: "/tmp/session.jsonl",
        workspaceDir: "/tmp",
        prompt: "hi",
        provider: "codex-cli",
        model: "gpt-5.2-codex",
        timeoutMs: 1_000,
        runId: "run-2b",
        cliSessionId: "thread-123",
      }),
    ).rejects.toThrow("produced no output");

    expect(enqueueSystemEventMock).toHaveBeenCalledTimes(1);
    const [notice, opts] = enqueueSystemEventMock.mock.calls[0] ?? [];
    expect(String(notice)).toContain("produced no output");
    expect(String(notice)).toContain("interactive input or an approval prompt");
    expect(opts).toMatchObject({ sessionKey: "agent:main:main" });
    expect(requestHeartbeatNowMock).toHaveBeenCalledWith({
      reason: "cli:watchdog:stall",
      sessionKey: "agent:main:main",
    });
  });

  it("fails with timeout when overall timeout trips", async () => {
    supervisorSpawnMock.mockResolvedValueOnce(
      createManagedRun({
        reason: "overall-timeout",
        exitCode: null,
        exitSignal: "SIGKILL",
        durationMs: 200,
        stdout: "",
        stderr: "",
        timedOut: true,
        noOutputTimedOut: false,
      }),
    );

    await expect(
      runCliAgent({
        sessionId: "s1",
        sessionFile: "/tmp/session.jsonl",
        workspaceDir: "/tmp",
        prompt: "hi",
        provider: "codex-cli",
        model: "gpt-5.2-codex",
        timeoutMs: 1_000,
        runId: "run-3",
        cliSessionId: "thread-123",
      }),
    ).rejects.toThrow("exceeded timeout");
  });

  it("rethrows the retry failure when session-expired recovery retry also fails", async () => {
    supervisorSpawnMock.mockResolvedValueOnce(
      createManagedRun({
        reason: "exit",
        exitCode: 1,
        exitSignal: null,
        durationMs: 150,
        stdout: "",
        stderr: "session expired",
        timedOut: false,
        noOutputTimedOut: false,
      }),
    );
    supervisorSpawnMock.mockResolvedValueOnce(
      createManagedRun({
        reason: "exit",
        exitCode: 1,
        exitSignal: null,
        durationMs: 150,
        stdout: "",
        stderr: "rate limit exceeded",
        timedOut: false,
        noOutputTimedOut: false,
      }),
    );

    await expect(
      runCliAgent({
        sessionId: "s1",
        sessionKey: "agent:main:subagent:retry",
        sessionFile: "/tmp/session.jsonl",
        workspaceDir: "/tmp",
        prompt: "hi",
        provider: "codex-cli",
        model: "gpt-5.2-codex",
        timeoutMs: 1_000,
        runId: "run-retry-failure",
        cliSessionId: "thread-123",
      }),
    ).rejects.toThrow("rate limit exceeded");

    expect(supervisorSpawnMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to per-agent workspace when workspaceDir is missing", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cli-runner-"));
    const fallbackWorkspace = path.join(tempDir, "workspace-main");
    await fs.mkdir(fallbackWorkspace, { recursive: true });
    const cfg = {
      agents: {
        defaults: {
          workspace: fallbackWorkspace,
        },
      },
    } satisfies OpenClawConfig;

    supervisorSpawnMock.mockResolvedValueOnce(
      createManagedRun({
        reason: "exit",
        exitCode: 0,
        exitSignal: null,
        durationMs: 25,
        stdout: "ok",
        stderr: "",
        timedOut: false,
        noOutputTimedOut: false,
      }),
    );

    try {
      await runCliAgent({
        sessionId: "s1",
        sessionKey: "agent:main:subagent:missing-workspace",
        sessionFile: "/tmp/session.jsonl",
        workspaceDir: undefined as unknown as string,
        config: cfg,
        prompt: "hi",
        provider: "codex-cli",
        model: "gpt-5.2-codex",
        timeoutMs: 1_000,
        runId: "run-4",
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    const input = supervisorSpawnMock.mock.calls[0]?.[0] as { cwd?: string };
    expect(input.cwd).toBe(path.resolve(fallbackWorkspace));
  });
});

describe("resolveCliNoOutputTimeoutMs", () => {
  it("uses backend-configured resume watchdog override", () => {
    const timeoutMs = resolveCliNoOutputTimeoutMs({
      backend: {
        command: "codex",
        reliability: {
          watchdog: {
            resume: {
              noOutputTimeoutMs: 42_000,
            },
          },
        },
      },
      timeoutMs: 120_000,
      useResume: true,
    });
    expect(timeoutMs).toBe(42_000);
  });
});

// ---------------------------------------------------------------------------
// T100-T103: OAuth credential wiring into cli-runner
// ---------------------------------------------------------------------------

const resolveRovoDevCredentialV2Spy = vi.fn();
const resolveRovoDevCredentialSpy = vi.fn();

vi.mock("./rovo-dev-auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rovo-dev-auth.js")>();
  return {
    ...actual,
    resolveRovoDevCredential: (...args: unknown[]) => resolveRovoDevCredentialSpy(...args),
    resolveRovoDevCredentialV2: (...args: unknown[]) => resolveRovoDevCredentialV2Spy(...args),
  };
});

vi.mock("./rovo-dev-runner.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rovo-dev-runner.js")>();
  return {
    ...actual,
    buildRovoDevEnv: vi.fn().mockReturnValue({
      USER_EMAIL: "mock@example.com",
      USER_API_TOKEN: "mock-token",
    }),
  };
});

const ROVO_PARAMS = {
  sessionId: "s-oauth-test",
  sessionFile: "/tmp/session.jsonl",
  workspaceDir: "/tmp",
  prompt: "hello rovo",
  provider: "rovo-dev",
  model: "default",
  timeoutMs: 5_000,
  runId: "run-oauth-test",
} as const;

// T100: OAuth happy path
describe("T100: cli-runner uses resolveRovoDevCredentialV2 when tokenStore is provided", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resolveRovoDevCredentialV2Spy.mockReset();
    resolveRovoDevCredentialSpy.mockReset();
    supervisorSpawnMock.mockReset();
  });

  it("calls resolveRovoDevCredentialV2 (not V1) when tokenStore is provided", async () => {
    const mockTokenStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      delete: vi.fn(),
    };

    resolveRovoDevCredentialV2Spy.mockResolvedValue({
      credential: {
        type: "oauth",
        accessToken: "oauth-token-t100",
        refreshToken: "oauth-refresh-t100",
        site: "https://myorg.atlassian.net",
        email: "user@myorg.com",
        expiresAtMs: Date.now() + 300_000,
      },
    });

    supervisorSpawnMock.mockResolvedValueOnce(
      createManagedRun({
        reason: "exit",
        exitCode: 0,
        exitSignal: null,
        durationMs: 50,
        stdout: "response from rovo",
        stderr: "",
        timedOut: false,
        noOutputTimedOut: false,
      }),
    );

    await runCliAgent({ ...ROVO_PARAMS, tokenStore: mockTokenStore });

    expect(resolveRovoDevCredentialV2Spy).toHaveBeenCalledTimes(1);
    expect(resolveRovoDevCredentialSpy).not.toHaveBeenCalled();
  });
});

// T101: AUTH_REQUIRED -> FailoverError
describe("T101: AUTH_REQUIRED propagates as FailoverError(reason=auth_required, status=401)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resolveRovoDevCredentialV2Spy.mockReset();
    resolveRovoDevCredentialSpy.mockReset();
  });

  it("throws FailoverError when tokenStore has no token", async () => {
    const mockTokenStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      delete: vi.fn(),
    };

    resolveRovoDevCredentialV2Spy.mockResolvedValue({
      credential: null,
      reason: "AUTH_REQUIRED",
    });

    let thrown: unknown;
    try {
      await runCliAgent({ ...ROVO_PARAMS, tokenStore: mockTokenStore });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(FailoverError);
    const fe = thrown as FailoverError;
    expect(fe.reason).toBe("auth_required");
    expect(fe.status).toBe(401);
  });
});

// T102: REFRESH_FAILED -> FailoverError
describe("T102: REFRESH_FAILED propagates as FailoverError(reason=auth_required, status=401)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resolveRovoDevCredentialV2Spy.mockReset();
    resolveRovoDevCredentialSpy.mockReset();
  });

  it("throws FailoverError when token refresh fails", async () => {
    const mockTokenStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      delete: vi.fn(),
    };

    resolveRovoDevCredentialV2Spy.mockResolvedValue({
      credential: null,
      reason: "REFRESH_FAILED",
    });

    let thrown: unknown;
    try {
      await runCliAgent({ ...ROVO_PARAMS, tokenStore: mockTokenStore });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(FailoverError);
    const fe = thrown as FailoverError;
    expect(fe.reason).toBe("auth_required");
    expect(fe.status).toBe(401);
  });
});

// T103: No tokenStore -> V1 fallback
describe("T103: no tokenStore falls back to resolveRovoDevCredential (V1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resolveRovoDevCredentialV2Spy.mockReset();
    resolveRovoDevCredentialSpy.mockReset();
    supervisorSpawnMock.mockReset();
  });

  it("calls V1 and does NOT call V2 when tokenStore is absent", async () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "env-token-t103");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://myorg.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "svc@myorg.com");

    resolveRovoDevCredentialSpy.mockReturnValue({
      type: "service-account",
      accessToken: "env-token-t103",
      site: "https://myorg.atlassian.net",
      email: "svc@myorg.com",
    });

    supervisorSpawnMock.mockResolvedValueOnce(
      createManagedRun({
        reason: "exit",
        exitCode: 0,
        exitSignal: null,
        durationMs: 50,
        stdout: "ok from rovo",
        stderr: "",
        timedOut: false,
        noOutputTimedOut: false,
      }),
    );

    // No tokenStore — should use V1 path
    await runCliAgent({ ...ROVO_PARAMS });

    expect(resolveRovoDevCredentialV2Spy).not.toHaveBeenCalled();
    expect(supervisorSpawnMock).toHaveBeenCalledTimes(1);
  });
});
