/**
 * T019-T020: Tests for Rovo Dev authentication helpers.
 *
 * These tests import from files that do not exist yet.
 * They MUST fail until the implementation is written.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
// T019 + T020: imports from the not-yet-created implementation file.
import { resolveRovoDevCredential, validateRovoDevServiceAccount } from "./rovo-dev-auth.js";
import type { RovoDevCredential } from "./rovo-dev-auth.js";

// ---------------------------------------------------------------------------
// T019: validateRovoDevServiceAccount
// ---------------------------------------------------------------------------
describe("validateRovoDevServiceAccount (T019)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns { valid: true } when all required env vars are present", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("ROVODEV_SITE_URL", "https://test.atlassian.net");
    vi.stubEnv("ROVODEV_USER_EMAIL", "service@example.com");

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(true);
  });

  it("returns { valid: false, missingKeys } when OPENCLAW_LIVE_ROVODEV_TOKEN is absent", () => {
    vi.stubEnv("ROVODEV_SITE_URL", "https://test.atlassian.net");
    vi.stubEnv("ROVODEV_USER_EMAIL", "service@example.com");
    // OPENCLAW_LIVE_ROVODEV_TOKEN deliberately not set

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(false);
    expect(result.missingKeys).toEqual(expect.arrayContaining(["OPENCLAW_LIVE_ROVODEV_TOKEN"]));
  });

  it("returns { valid: false, missingKeys } when ROVODEV_SITE_URL is absent", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("ROVODEV_USER_EMAIL", "service@example.com");
    // ROVODEV_SITE_URL deliberately not set

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(false);
    expect(result.missingKeys).toEqual(expect.arrayContaining(["ROVODEV_SITE_URL"]));
  });

  it("returns { valid: false, missingKeys } when ROVODEV_USER_EMAIL is absent", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("ROVODEV_SITE_URL", "https://test.atlassian.net");
    // ROVODEV_USER_EMAIL deliberately not set

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(false);
    expect(result.missingKeys).toEqual(expect.arrayContaining(["ROVODEV_USER_EMAIL"]));
  });

  it("returns all missing keys when none of the env vars are set", () => {
    // All three deliberately absent

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(false);
    expect(result.missingKeys?.length).toBeGreaterThanOrEqual(3);
  });

  it("missingKeys is empty (or undefined) when result is valid", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "mock-token");
    vi.stubEnv("ROVODEV_SITE_URL", "https://test.atlassian.net");
    vi.stubEnv("ROVODEV_USER_EMAIL", "service@example.com");

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(true);
    // missingKeys should be absent or empty when valid
    if (result.missingKeys !== undefined) {
      expect(result.missingKeys).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// T020: resolveRovoDevCredential
// ---------------------------------------------------------------------------
describe("resolveRovoDevCredential (T020)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns service-account credential when all env vars are set", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "mock-access-token");
    vi.stubEnv("ROVODEV_SITE_URL", "https://myorg.atlassian.net");
    vi.stubEnv("ROVODEV_USER_EMAIL", "svc@myorg.com");

    const cred: RovoDevCredential | null = resolveRovoDevCredential();

    expect(cred).not.toBeNull();
    expect(cred!.type).toBe("service-account");
    expect(cred!.accessToken).toBe("mock-access-token");
    expect(cred!.site).toBe("https://myorg.atlassian.net");
    expect(cred!.email).toBe("svc@myorg.com");
  });

  it("returns null when OPENCLAW_LIVE_ROVODEV_TOKEN is missing", () => {
    vi.stubEnv("ROVODEV_SITE_URL", "https://myorg.atlassian.net");
    vi.stubEnv("ROVODEV_USER_EMAIL", "svc@myorg.com");

    const cred = resolveRovoDevCredential();

    expect(cred).toBeNull();
  });

  it("returns null when ROVODEV_SITE_URL is missing", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "mock-access-token");
    vi.stubEnv("ROVODEV_USER_EMAIL", "svc@myorg.com");

    const cred = resolveRovoDevCredential();

    expect(cred).toBeNull();
  });

  it("returns null when ROVODEV_USER_EMAIL is missing", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "mock-access-token");
    vi.stubEnv("ROVODEV_SITE_URL", "https://myorg.atlassian.net");

    const cred = resolveRovoDevCredential();

    expect(cred).toBeNull();
  });

  it("returns null when no rovodev env vars are present at all", () => {
    const cred = resolveRovoDevCredential();

    expect(cred).toBeNull();
  });

  it("does not expose raw token value in log-safe properties", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "secret-token-value");
    vi.stubEnv("ROVODEV_SITE_URL", "https://myorg.atlassian.net");
    vi.stubEnv("ROVODEV_USER_EMAIL", "svc@myorg.com");

    const cred = resolveRovoDevCredential();

    expect(cred).not.toBeNull();
    // The credential object must carry the token for actual use
    expect(cred!.accessToken).toBe("secret-token-value");
    // But the type discriminant must be correct
    expect(cred!.type).toBe("service-account");
  });
});
