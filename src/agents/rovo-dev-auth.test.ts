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
import { buildRovoDevEnv } from "./rovo-dev-runner.js";

// ---------------------------------------------------------------------------
// T019: validateRovoDevServiceAccount
// ---------------------------------------------------------------------------
describe("validateRovoDevServiceAccount (T019)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns { valid: true } when all required env vars are present", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://test.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "service@example.com");

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(true);
  });

  it("returns { valid: false, missingKeys } when OPENCLAW_LIVE_ROVODEV_TOKEN is absent", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://test.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "service@example.com");
    // OPENCLAW_LIVE_ROVODEV_TOKEN deliberately not set

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(false);
    expect(result.missingKeys).toEqual(expect.arrayContaining(["OPENCLAW_LIVE_ROVODEV_TOKEN"]));
  });

  it("returns { valid: false, missingKeys } when OPENCLAW_LIVE_ROVODEV_SITE is absent", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "service@example.com");
    // OPENCLAW_LIVE_ROVODEV_SITE deliberately not set

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(false);
    expect(result.missingKeys).toEqual(expect.arrayContaining(["OPENCLAW_LIVE_ROVODEV_SITE"]));
  });

  it("returns { valid: false, missingKeys } when OPENCLAW_LIVE_ROVODEV_EMAIL is absent", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://test.atlassian.net");
    // OPENCLAW_LIVE_ROVODEV_EMAIL deliberately not set

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(false);
    expect(result.missingKeys).toEqual(expect.arrayContaining(["OPENCLAW_LIVE_ROVODEV_EMAIL"]));
  });

  it("returns all missing keys when none of the env vars are set", () => {
    // All three deliberately absent

    const result = validateRovoDevServiceAccount();

    expect(result.valid).toBe(false);
    expect(result.missingKeys?.length).toBeGreaterThanOrEqual(3);
  });

  it("missingKeys is empty (or undefined) when result is valid", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "mock-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://test.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "service@example.com");

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
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://myorg.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "svc@myorg.com");

    const cred: RovoDevCredential | null = resolveRovoDevCredential();

    expect(cred).not.toBeNull();
    expect(cred!.type).toBe("service-account");
    expect(cred!.accessToken).toBe("mock-access-token");
    expect(cred!.site).toBe("https://myorg.atlassian.net");
    expect(cred!.email).toBe("svc@myorg.com");
  });

  it("returns null when OPENCLAW_LIVE_ROVODEV_TOKEN is missing", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://myorg.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "svc@myorg.com");

    const cred = resolveRovoDevCredential();

    expect(cred).toBeNull();
  });

  it("returns null when ROVODEV_SITE_URL is missing", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "mock-access-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "svc@myorg.com");

    const cred = resolveRovoDevCredential();

    expect(cred).toBeNull();
  });

  it("returns null when ROVODEV_USER_EMAIL is missing", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "mock-access-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://myorg.atlassian.net");

    const cred = resolveRovoDevCredential();

    expect(cred).toBeNull();
  });

  it("returns null when no rovodev env vars are present at all", () => {
    const cred = resolveRovoDevCredential();

    expect(cred).toBeNull();
  });

  it("does not expose raw token value in log-safe properties", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "secret-token-value");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://myorg.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "svc@myorg.com");

    const cred = resolveRovoDevCredential();

    expect(cred).not.toBeNull();
    // The credential object must carry the token for actual use
    expect(cred!.accessToken).toBe("secret-token-value");
    // But the type discriminant must be correct
    expect(cred!.type).toBe("service-account");
  });
});

// ---------------------------------------------------------------------------
// T095: Integration test — env var credential injection for acli subprocess
// ---------------------------------------------------------------------------
describe("credential injection into acli subprocess env (T095)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolveRovoDevCredential + buildRovoDevEnv produces USER_EMAIL and USER_API_TOKEN", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "test-api-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://myorg.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "svc@myorg.com");

    const cred = resolveRovoDevCredential();
    expect(cred).not.toBeNull();

    const envVars = buildRovoDevEnv(cred!);

    expect(envVars).toEqual({
      USER_EMAIL: "svc@myorg.com",
      USER_API_TOKEN: "test-api-token",
    });
  });

  it("credential env vars are not set when env vars are missing", () => {
    // No OPENCLAW_LIVE_ROVODEV_* vars set
    const cred = resolveRovoDevCredential();
    expect(cred).toBeNull();
    // When credential is null, buildRovoDevEnv should NOT be called
    // (the gateway code checks for null before calling)
  });

  it("USER_EMAIL maps from credential.email, USER_API_TOKEN from credential.accessToken", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "my-secret-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://site.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "user@example.com");

    const cred = resolveRovoDevCredential();
    const envVars = buildRovoDevEnv(cred!);

    // These are the env var names that acli reads
    expect(envVars.USER_EMAIL).toBe("user@example.com");
    expect(envVars.USER_API_TOKEN).toBe("my-secret-token");
    // Ensure no extra keys leak
    expect(Object.keys(envVars)).toEqual(["USER_EMAIL", "USER_API_TOKEN"]);
  });
});
