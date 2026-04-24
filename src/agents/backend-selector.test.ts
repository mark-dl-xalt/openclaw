/**
 * T027-T030: Tests for BackendSelector — runtime backend switching.
 *
 * These tests import from `./backend-selector.js` which does NOT exist yet.
 * They MUST fail until the implementation is written.
 *
 * Test coverage:
 *   T027 – BackendSelector constructor and switchTo() behavior
 *   T028 – resolveDefaultBackend() logic
 *   T029 – Backend switch round-trip integration (prompt dispatch)
 *   T030 – onSwitch handler notification
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// ---------------------------------------------------------------------------
// Import from the not-yet-created implementation.
// These will cause an import error until the file exists.
// ---------------------------------------------------------------------------
import { BackendSelector, resolveDefaultBackend } from "./backend-selector.js";

// ---------------------------------------------------------------------------
// Shared mock helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal availability-check mock that returns `available: true`
 * for the given backend id and `available: false` for everything else.
 */
function makeAvailabilityMock(availableIds: string[]) {
  return vi.fn(async (id: string) => {
    if (availableIds.includes(id)) {
      return { available: true as const };
    }
    return { available: false as const, reason: `${id} not available in this mock` };
  });
}

// ---------------------------------------------------------------------------
// T027: BackendSelector constructor and switchTo()
// ---------------------------------------------------------------------------
describe("BackendSelector constructor (T027)", () => {
  it("default backend is 'rovo-dev' when constructed with 'rovo-dev'", () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli", "codex-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    expect(selector.active).toBe("rovo-dev");
  });

  it("default backend is 'claude-cli' when constructed with 'claude-cli'", () => {
    const checkAvailability = makeAvailabilityMock(["claude-cli"]);
    const selector = new BackendSelector({ default: "claude-cli", checkAvailability });

    expect(selector.active).toBe("claude-cli");
  });

  it("active getter returns the current backend id as a string", () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    expect(typeof selector.active).toBe("string");
  });
});

describe("BackendSelector.switchTo() (T027)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("switchTo available 'claude-cli' returns { success: true, newBackend: 'claude-cli' }", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    const result = await selector.switchTo("claude-cli");

    expect(result.success).toBe(true);
    expect((result as { success: true; newBackend: string }).newBackend).toBe("claude-cli");
  });

  it("switchTo available 'claude-cli' updates selector.active to 'claude-cli'", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    await selector.switchTo("claude-cli");

    expect(selector.active).toBe("claude-cli");
  });

  it("switchTo unavailable 'codex-cli' returns { success: false }", async () => {
    // Only rovo-dev is available; codex-cli is not
    const checkAvailability = makeAvailabilityMock(["rovo-dev"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    const result = await selector.switchTo("codex-cli");

    expect(result.success).toBe(false);
  });

  it("switchTo unavailable backend leaves selector.active unchanged", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    await selector.switchTo("codex-cli");

    expect(selector.active).toBe("rovo-dev");
  });

  it("switchTo the currently active backend is a no-op returning { success: true }", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    const result = await selector.switchTo("rovo-dev");

    expect(result.success).toBe(true);
    expect(selector.active).toBe("rovo-dev");
  });

  it("switchTo same active backend does not call checkAvailability for a redundant switch", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    // Clear call count set up by constructor
    checkAvailability.mockClear();

    await selector.switchTo("rovo-dev");

    // Should not re-check availability for the already-active backend
    expect(checkAvailability).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T028: resolveDefaultBackend()
// ---------------------------------------------------------------------------
describe("resolveDefaultBackend (T028)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 'rovo-dev' when rovodev env vars are set and acli is present", async () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("ROVODEV_SITE_URL", "https://test.atlassian.net");
    vi.stubEnv("ROVODEV_USER_EMAIL", "test@example.com");

    const checkPath = vi.fn(async () => true);

    const result = await resolveDefaultBackend({ checkPath });

    expect(result).toBe("rovo-dev");
  });

  it("returns 'claude-cli' when rovodev env vars are missing but claude-cli is available", async () => {
    // No rovodev env vars → rovo-dev unavailable
    // Claude CLI binary is available

    const checkPath = vi.fn(async (binary: string) => binary === "claude");

    const result = await resolveDefaultBackend({ checkPath });

    expect(result).toBe("claude-cli");
  });

  it("returns undefined when no backend is available and logs a warning", async () => {
    // No env vars, no binaries available
    const checkPath = vi.fn(async () => false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await resolveDefaultBackend({ checkPath });

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("returns 'rovo-dev' over 'claude-cli' when both are available (rovo-dev has priority)", async () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("ROVODEV_SITE_URL", "https://test.atlassian.net");
    vi.stubEnv("ROVODEV_USER_EMAIL", "test@example.com");

    // Both acli and claude are on PATH
    const checkPath = vi.fn(async () => true);

    const result = await resolveDefaultBackend({ checkPath });

    expect(result).toBe("rovo-dev");
  });
});

// ---------------------------------------------------------------------------
// T029: Backend switch round-trip integration test
// ---------------------------------------------------------------------------
describe("BackendSelector round-trip prompt dispatch (T029)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes first prompt to rovo-dev mock, then routes second prompt to claude after switch", async () => {
    const rovoDevSendMock = vi.fn(async (_prompt: string) => "rovo-dev response");
    const claudeSendMock = vi.fn(async (_prompt: string) => "claude response");

    const backendDispatch: Record<string, (prompt: string) => Promise<string>> = {
      "rovo-dev": rovoDevSendMock,
      "claude-cli": claudeSendMock,
    };

    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    // Helper to dispatch a prompt through the selector's active backend
    const sendPrompt = async (prompt: string): Promise<string> => {
      const dispatch = backendDispatch[selector.active];
      if (!dispatch) {
        throw new Error(`No mock for backend: ${selector.active}`);
      }
      return dispatch(prompt);
    };

    // First prompt goes to rovo-dev
    const firstResponse = await sendPrompt("What is TypeScript?");
    expect(firstResponse).toBe("rovo-dev response");
    expect(rovoDevSendMock).toHaveBeenCalledTimes(1);
    expect(claudeSendMock).not.toHaveBeenCalled();

    // Switch to claude-cli
    const switchResult = await selector.switchTo("claude-cli");
    expect(switchResult.success).toBe(true);

    // Second prompt goes to claude-cli, not acli
    const secondResponse = await sendPrompt("Explain async/await");
    expect(secondResponse).toBe("claude response");
    expect(claudeSendMock).toHaveBeenCalledTimes(1);
    expect(claudeSendMock).toHaveBeenCalledWith("Explain async/await");

    // rovo-dev mock was NOT called again
    expect(rovoDevSendMock).toHaveBeenCalledTimes(1);
  });

  it("active backend id is 'claude-cli' after switching from 'rovo-dev'", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    expect(selector.active).toBe("rovo-dev");

    await selector.switchTo("claude-cli");

    expect(selector.active).toBe("claude-cli");
  });

  it("can switch back from claude-cli to rovo-dev", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    await selector.switchTo("claude-cli");
    expect(selector.active).toBe("claude-cli");

    await selector.switchTo("rovo-dev");
    expect(selector.active).toBe("rovo-dev");
  });
});

// ---------------------------------------------------------------------------
// T030: onSwitch handler
// ---------------------------------------------------------------------------
describe("BackendSelector.onSwitch() handler (T030)", () => {
  it("calls registered handler with (newId, previousId) when backend switches", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    const handler = vi.fn();
    selector.onSwitch(handler);

    await selector.switchTo("claude-cli");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("claude-cli", "rovo-dev");
  });

  it("handler receives newId as first argument and previousId as second argument", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli", "codex-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    const capturedArgs: [string, string][] = [];
    selector.onSwitch((newId, previousId) => {
      capturedArgs.push([newId, previousId]);
    });

    await selector.switchTo("claude-cli");
    await selector.switchTo("codex-cli");

    expect(capturedArgs).toHaveLength(2);
    expect(capturedArgs[0]).toEqual(["claude-cli", "rovo-dev"]);
    expect(capturedArgs[1]).toEqual(["codex-cli", "claude-cli"]);
  });

  it("handler is NOT called when switching to an unavailable backend (switch fails)", async () => {
    // Only rovo-dev is available; codex-cli is not
    const checkAvailability = makeAvailabilityMock(["rovo-dev"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    const handler = vi.fn();
    selector.onSwitch(handler);

    await selector.switchTo("codex-cli");

    expect(handler).not.toHaveBeenCalled();
  });

  it("handler is NOT called for a no-op switch to the same backend", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    const handler = vi.fn();
    selector.onSwitch(handler);

    await selector.switchTo("rovo-dev");

    expect(handler).not.toHaveBeenCalled();
  });

  it("multiple handlers are all called on a successful switch", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    const handlerA = vi.fn();
    const handlerB = vi.fn();
    selector.onSwitch(handlerA);
    selector.onSwitch(handlerB);

    await selector.switchTo("claude-cli");

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
  });

  it("handler registered via onSwitch returns an unsubscribe function that stops future calls", async () => {
    const checkAvailability = makeAvailabilityMock(["rovo-dev", "claude-cli", "codex-cli"]);
    const selector = new BackendSelector({ default: "rovo-dev", checkAvailability });

    const handler = vi.fn();
    const unsubscribe = selector.onSwitch(handler);

    // First switch: handler fires
    await selector.switchTo("claude-cli");
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe, then switch again
    unsubscribe();
    await selector.switchTo("codex-cli");

    // Handler should not have been called again
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
