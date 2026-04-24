/**
 * T015-T016: Tests for Rovo Dev backend config.
 *
 * These tests import from files that do not exist yet.
 * They MUST fail until the implementation is written.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
// T015 + T016: imports from the not-yet-created implementation file.
import { ROVODEV_BACKEND, checkRovoDevAvailability } from "./rovo-dev-backends.js";

// ---------------------------------------------------------------------------
// T015: ROVODEV_BACKEND static config shape
// ---------------------------------------------------------------------------
describe("ROVODEV_BACKEND static config (T015)", () => {
  it("command is 'acli'", () => {
    expect(ROVODEV_BACKEND.command).toBe("acli");
  });

  it("args array includes 'rovodev', 'run', and '--yolo'", () => {
    expect(ROVODEV_BACKEND.args).toEqual(expect.arrayContaining(["rovodev", "run", "--yolo"]));
  });

  it("output mode is 'text'", () => {
    expect(ROVODEV_BACKEND.output).toBe("text");
  });

  it("id/key is 'rovodev' or 'rovo-dev'", () => {
    // The backend id must be discoverable as 'rovodev' or 'rovo-dev'
    const id = ROVODEV_BACKEND.id ?? (ROVODEV_BACKEND as Record<string, unknown>)["id"];
    expect(typeof id === "string" && /rovo.?dev/i.test(id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T016: checkRovoDevAvailability
// ---------------------------------------------------------------------------
describe("checkRovoDevAvailability (T016)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns { available: true } when acli is on PATH and required env vars are present", async () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://test.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "test@example.com");

    const result = await checkRovoDevAvailability({
      checkPath: async () => true,
    });

    expect(result.available).toBe(true);
  });

  it("returns { available: false, reason } when acli is not on PATH", async () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://test.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "test@example.com");

    const result = await checkRovoDevAvailability({
      checkPath: async () => false,
    });

    expect(result.available).toBe(false);
    if (!result.available) {
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("returns { available: false, reason } when OPENCLAW_LIVE_ROVODEV_TOKEN env var is absent", async () => {
    // Do not stub any rovodev env vars
    const result = await checkRovoDevAvailability({
      checkPath: async () => true,
    });

    expect(result.available).toBe(false);
    if (!result.available) {
      expect(typeof result.reason).toBe("string");
    }
  });

  it("returns { available: false, reason } when OPENCLAW_LIVE_ROVODEV_SITE is missing", async () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    // OPENCLAW_LIVE_ROVODEV_SITE deliberately absent
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "test@example.com");

    const result = await checkRovoDevAvailability({
      checkPath: async () => true,
    });

    expect(result.available).toBe(false);
    if (!result.available) {
      expect(typeof result.reason).toBe("string");
    }
  });
});
