import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveCliBackendConfig, resolveCliBackendIds } from "./cli-backends.js";

describe("resolveCliBackendConfig reliability merge", () => {
  it("defaults codex-cli to workspace-write for fresh and resume runs", () => {
    const resolved = resolveCliBackendConfig("codex-cli");

    expect(resolved).not.toBeNull();
    expect(resolved?.config.args).toEqual([
      "exec",
      "--json",
      "--color",
      "never",
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
    ]);
    expect(resolved?.config.resumeArgs).toEqual([
      "exec",
      "resume",
      "{sessionId}",
      "--color",
      "never",
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
    ]);
  });

  it("deep-merges reliability watchdog overrides for codex", () => {
    const cfg = {
      agents: {
        defaults: {
          cliBackends: {
            "codex-cli": {
              command: "codex",
              reliability: {
                watchdog: {
                  resume: {
                    noOutputTimeoutMs: 42_000,
                  },
                },
              },
            },
          },
        },
      },
    } satisfies OpenClawConfig;

    const resolved = resolveCliBackendConfig("codex-cli", cfg);

    expect(resolved).not.toBeNull();
    expect(resolved?.config.reliability?.watchdog?.resume?.noOutputTimeoutMs).toBe(42_000);
    // Ensure defaults are retained when only one field is overridden.
    expect(resolved?.config.reliability?.watchdog?.resume?.noOutputTimeoutRatio).toBe(0.3);
    expect(resolved?.config.reliability?.watchdog?.resume?.minMs).toBe(60_000);
    expect(resolved?.config.reliability?.watchdog?.resume?.maxMs).toBe(180_000);
    expect(resolved?.config.reliability?.watchdog?.fresh?.noOutputTimeoutRatio).toBe(0.8);
  });
});

describe("resolveCliBackendConfig claude-cli defaults", () => {
  it("uses non-interactive permission-mode defaults for fresh and resume args", () => {
    const resolved = resolveCliBackendConfig("claude-cli");

    expect(resolved).not.toBeNull();
    expect(resolved?.config.args).toContain("--permission-mode");
    expect(resolved?.config.args).toContain("bypassPermissions");
    expect(resolved?.config.args).not.toContain("--dangerously-skip-permissions");
    expect(resolved?.config.resumeArgs).toContain("--permission-mode");
    expect(resolved?.config.resumeArgs).toContain("bypassPermissions");
    expect(resolved?.config.resumeArgs).not.toContain("--dangerously-skip-permissions");
  });

  it("retains default claude safety args when only command is overridden", () => {
    const cfg = {
      agents: {
        defaults: {
          cliBackends: {
            "claude-cli": {
              command: "/usr/local/bin/claude",
            },
          },
        },
      },
    } satisfies OpenClawConfig;

    const resolved = resolveCliBackendConfig("claude-cli", cfg);

    expect(resolved).not.toBeNull();
    expect(resolved?.config.command).toBe("/usr/local/bin/claude");
    expect(resolved?.config.args).toContain("--permission-mode");
    expect(resolved?.config.args).toContain("bypassPermissions");
    expect(resolved?.config.resumeArgs).toContain("--permission-mode");
    expect(resolved?.config.resumeArgs).toContain("bypassPermissions");
  });

  it("normalizes legacy skip-permissions overrides to permission-mode bypassPermissions", () => {
    const cfg = {
      agents: {
        defaults: {
          cliBackends: {
            "claude-cli": {
              command: "claude",
              args: ["-p", "--dangerously-skip-permissions", "--output-format", "json"],
              resumeArgs: [
                "-p",
                "--dangerously-skip-permissions",
                "--output-format",
                "json",
                "--resume",
                "{sessionId}",
              ],
            },
          },
        },
      },
    } satisfies OpenClawConfig;

    const resolved = resolveCliBackendConfig("claude-cli", cfg);

    expect(resolved).not.toBeNull();
    expect(resolved?.config.args).not.toContain("--dangerously-skip-permissions");
    expect(resolved?.config.args).toContain("--permission-mode");
    expect(resolved?.config.args).toContain("bypassPermissions");
    expect(resolved?.config.resumeArgs).not.toContain("--dangerously-skip-permissions");
    expect(resolved?.config.resumeArgs).toContain("--permission-mode");
    expect(resolved?.config.resumeArgs).toContain("bypassPermissions");
  });

  it("keeps explicit permission-mode overrides while removing legacy skip flag", () => {
    const cfg = {
      agents: {
        defaults: {
          cliBackends: {
            "claude-cli": {
              command: "claude",
              args: ["-p", "--dangerously-skip-permissions", "--permission-mode", "acceptEdits"],
              resumeArgs: [
                "-p",
                "--dangerously-skip-permissions",
                "--permission-mode=acceptEdits",
                "--resume",
                "{sessionId}",
              ],
            },
          },
        },
      },
    } satisfies OpenClawConfig;

    const resolved = resolveCliBackendConfig("claude-cli", cfg);

    expect(resolved).not.toBeNull();
    expect(resolved?.config.args).not.toContain("--dangerously-skip-permissions");
    expect(resolved?.config.args).toEqual(["-p", "--permission-mode", "acceptEdits"]);
    expect(resolved?.config.resumeArgs).not.toContain("--dangerously-skip-permissions");
    expect(resolved?.config.resumeArgs).toEqual([
      "-p",
      "--permission-mode=acceptEdits",
      "--resume",
      "{sessionId}",
    ]);
    expect(resolved?.config.args).not.toContain("bypassPermissions");
    expect(resolved?.config.resumeArgs).not.toContain("bypassPermissions");
  });
});

// ---------------------------------------------------------------------------
// T021: Regression – existing backends still resolve after rovodev is added
// ---------------------------------------------------------------------------
describe("resolveCliBackendConfig regression after rovodev addition (T021)", () => {
  it("claude-cli resolves to command 'claude' with no config override", () => {
    const resolved = resolveCliBackendConfig("claude-cli", undefined);

    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe("claude-cli");
    expect(resolved!.config.command).toBe("claude");
  });

  it("claude-cli args include -p and --output-format json", () => {
    const resolved = resolveCliBackendConfig("claude-cli", undefined);

    expect(resolved).not.toBeNull();
    expect(resolved!.config.args).toEqual(
      expect.arrayContaining(["-p", "--output-format", "json"]),
    );
  });

  it("codex-cli resolves to command 'codex' with no config override", () => {
    const resolved = resolveCliBackendConfig("codex-cli", undefined);

    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe("codex-cli");
    expect(resolved!.config.command).toBe("codex");
  });

  it("codex-cli args include 'exec' and '--json'", () => {
    const resolved = resolveCliBackendConfig("codex-cli", undefined);

    expect(resolved).not.toBeNull();
    expect(resolved!.config.args).toEqual(expect.arrayContaining(["exec", "--json"]));
  });

  it("resolveCliBackendIds includes both claude-cli and codex-cli", () => {
    const ids = resolveCliBackendIds(undefined);

    expect(ids.has("claude-cli")).toBe(true);
    expect(ids.has("codex-cli")).toBe(true);
  });

  it("claude-cli config override is deep-merged and does not lose defaults", () => {
    const cfg = {
      agents: {
        defaults: {
          cliBackends: {
            "claude-cli": {
              command: "claude",
              reliability: {
                watchdog: {
                  resume: {
                    noOutputTimeoutMs: 90_000,
                  },
                },
              },
            },
          },
        },
      },
    } satisfies OpenClawConfig;

    const resolved = resolveCliBackendConfig("claude-cli", cfg);

    expect(resolved).not.toBeNull();
    expect(resolved!.config.command).toBe("claude");
    expect(resolved!.config.reliability?.watchdog?.resume?.noOutputTimeoutMs).toBe(90_000);
    // Default fresh watchdog ratio must still be present
    expect(resolved!.config.reliability?.watchdog?.fresh?.noOutputTimeoutRatio).toBe(0.8);
  });

  it("unknown backend without config override returns null", () => {
    const resolved = resolveCliBackendConfig("some-unknown-backend", undefined);

    expect(resolved).toBeNull();
  });

  it("rovodev backend is resolvable when registered in cliBackends config", () => {
    const cfg = {
      agents: {
        defaults: {
          cliBackends: {
            "rovo-dev": {
              command: "acli",
              args: ["rovodev", "run", "--yolo"],
              output: "text",
              input: "arg",
            },
          },
        },
      },
    } satisfies OpenClawConfig;

    const resolved = resolveCliBackendConfig("rovo-dev", cfg);

    expect(resolved).not.toBeNull();
    expect(resolved!.config.command).toBe("acli");
  });
});
