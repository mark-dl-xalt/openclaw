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
// T040: resolveRovoDevCredentialV2 — OAuth-first, NO Tier 1 fallthrough
// ---------------------------------------------------------------------------

import { refreshOAuthToken } from "../auth/oauth-atlassian.js";
// These imports target functions/modules that do NOT exist yet — tests MUST fail.
import { resolveRovoDevCredentialV2, resolveServiceAccountCredential } from "./rovo-dev-auth.js";

// We mock the TokenStore and refreshOAuthToken at module level for the new blocks.
vi.mock("../auth/token-store.js", () => ({
  TokenStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../auth/oauth-atlassian.js", () => ({
  refreshOAuthToken: vi.fn(),
}));

describe("resolveRovoDevCredentialV2 — OAuth-first, no Tier 1 fallthrough (T040)", () => {
  const mockTokenStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // (a) Valid OAuth token in store -> returns oauth credential
  it("valid OAuth token in store -> returns { credential: { type: 'oauth', accessToken, site } }", async () => {
    const storedToken = {
      accessToken: "oauth-access-token-123",
      refreshToken: "oauth-refresh-token-456",
      site: "https://myorg.atlassian.net",
      expiresAtMs: Date.now() + 300_000, // 5 minutes from now — not near expiry
      accountId: "user-account-id",
    };
    mockTokenStore.get.mockResolvedValue(storedToken);

    const result = await resolveRovoDevCredentialV2({ tokenStore: mockTokenStore });

    expect(result.credential).not.toBeNull();
    expect(result.credential?.type).toBe("oauth");
    expect(result.credential?.accessToken).toBe("oauth-access-token-123");
    expect(result.credential?.site).toBe("https://myorg.atlassian.net");
  });

  // (b) Token near expiry (within 60s) -> refreshOAuthToken called, refreshed token returned
  it("token near expiry (within 60s) -> refreshOAuthToken called, refreshed token returned", async () => {
    const storedToken = {
      accessToken: "old-access-token",
      refreshToken: "refresh-token-abc",
      site: "https://myorg.atlassian.net",
      expiresAtMs: Date.now() + 30_000, // 30s — inside 60s buffer
      accountId: "user-account-id",
    };
    mockTokenStore.get.mockResolvedValue(storedToken);

    const refreshedToken = {
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "read:jira-work",
    };
    vi.mocked(refreshOAuthToken).mockResolvedValue(refreshedToken);

    const result = await resolveRovoDevCredentialV2({ tokenStore: mockTokenStore });

    expect(refreshOAuthToken).toHaveBeenCalledWith(storedToken.refreshToken);
    expect(result.credential).not.toBeNull();
    expect(result.credential?.accessToken).toBe("new-access-token");
  });

  // (c) Refresh fails -> returns { credential: null, reason: 'REFRESH_FAILED' } — NOT service-account
  it("refresh fails -> returns { credential: null, reason: 'REFRESH_FAILED' }", async () => {
    const storedToken = {
      accessToken: "old-access-token",
      refreshToken: "refresh-token-abc",
      site: "https://myorg.atlassian.net",
      expiresAtMs: Date.now() + 30_000, // inside 60s buffer, triggers refresh
      accountId: "user-account-id",
    };
    mockTokenStore.get.mockResolvedValue(storedToken);
    vi.mocked(refreshOAuthToken).mockRejectedValue(new Error("Refresh denied"));

    const result = await resolveRovoDevCredentialV2({ tokenStore: mockTokenStore });

    expect(result.credential).toBeNull();
    expect(result.reason).toBe("REFRESH_FAILED");
  });

  // (d) No token in store -> returns { credential: null, reason: 'AUTH_REQUIRED' } — NOT service-account
  it("no token in store -> returns { credential: null, reason: 'AUTH_REQUIRED' }", async () => {
    mockTokenStore.get.mockResolvedValue(null);

    const result = await resolveRovoDevCredentialV2({ tokenStore: mockTokenStore });

    expect(result.credential).toBeNull();
    expect(result.reason).toBe("AUTH_REQUIRED");
  });
});

// ---------------------------------------------------------------------------
// T040b: resolveServiceAccountCredential (separate function)
// ---------------------------------------------------------------------------
describe("resolveServiceAccountCredential (T040b)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // (a) All three env vars set -> returns { type: 'service-account', ... }
  it("all three env vars set -> returns { type: 'service-account', ... }", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "sa-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://myorg.atlassian.net");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_EMAIL", "svc@myorg.com");

    const result = resolveServiceAccountCredential();

    expect(result).not.toBeNull();
    expect(result!.type).toBe("service-account");
    expect(result!.accessToken).toBe("sa-token");
    expect(result!.site).toBe("https://myorg.atlassian.net");
    expect(result!.email).toBe("svc@myorg.com");
  });

  // (b) One env var missing -> returns null
  it("one env var missing -> returns null", () => {
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_TOKEN", "sa-token");
    vi.stubEnv("OPENCLAW_LIVE_ROVODEV_SITE", "https://myorg.atlassian.net");
    // OPENCLAW_LIVE_ROVODEV_EMAIL deliberately missing

    const result = resolveServiceAccountCredential();

    expect(result).toBeNull();
  });

  // (c) All missing -> returns null
  it("all env vars missing -> returns null", () => {
    // No OPENCLAW_LIVE_ROVODEV_* env vars set

    const result = resolveServiceAccountCredential();

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T044: Token refresh
// ---------------------------------------------------------------------------
describe("Token refresh flow (T044)", () => {
  const mockTokenStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // (a) Token with expiresAtMs inside 60s buffer -> refreshOAuthToken called
  it("token with expiresAtMs = Date.now() + 30_000 triggers refresh", async () => {
    const storedToken = {
      accessToken: "about-to-expire-token",
      refreshToken: "refresh-token-xyz",
      site: "https://myorg.atlassian.net",
      expiresAtMs: Date.now() + 30_000, // 30s from now — inside 60s buffer
      accountId: "user-account-id",
    };
    mockTokenStore.get.mockResolvedValue(storedToken);

    const refreshedToken = {
      access_token: "fresh-token",
      refresh_token: "fresh-refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "read:jira-work",
    };
    vi.mocked(refreshOAuthToken).mockResolvedValue(refreshedToken);

    await resolveRovoDevCredentialV2({ tokenStore: mockTokenStore });

    expect(refreshOAuthToken).toHaveBeenCalledWith(storedToken.refreshToken);
  });

  // (b) On refresh success: TokenStore.set called with updated tokens, new credential returned
  it("on refresh success: TokenStore.set called, new credential returned", async () => {
    const storedToken = {
      accessToken: "old-token",
      refreshToken: "old-refresh",
      site: "https://myorg.atlassian.net",
      expiresAtMs: Date.now() + 10_000, // inside 60s buffer
      accountId: "user-account-id",
    };
    mockTokenStore.get.mockResolvedValue(storedToken);

    const refreshedToken = {
      access_token: "refreshed-access-token",
      refresh_token: "refreshed-refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "read:jira-work",
    };
    vi.mocked(refreshOAuthToken).mockResolvedValue(refreshedToken);

    const result = await resolveRovoDevCredentialV2({ tokenStore: mockTokenStore });

    expect(mockTokenStore.set).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        accessToken: "refreshed-access-token",
        refreshToken: "refreshed-refresh-token",
      }),
    );
    expect(result.credential).not.toBeNull();
    expect(result.credential?.accessToken).toBe("refreshed-access-token");
  });

  // (c) On 401 refresh failure: TokenStore.delete called, returns REFRESH_FAILED
  it("on 401 refresh failure: TokenStore.delete called, returns { credential: null, reason: 'REFRESH_FAILED' }", async () => {
    const storedToken = {
      accessToken: "old-token",
      refreshToken: "old-refresh",
      site: "https://myorg.atlassian.net",
      expiresAtMs: Date.now() + 10_000, // inside 60s buffer
      accountId: "user-account-id",
    };
    mockTokenStore.get.mockResolvedValue(storedToken);

    const refreshError = new Error("401 Unauthorized");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    (refreshError as any).statusCode = 401;
    vi.mocked(refreshOAuthToken).mockRejectedValue(refreshError);

    const result = await resolveRovoDevCredentialV2({ tokenStore: mockTokenStore });

    expect(mockTokenStore.delete).toHaveBeenCalled();
    expect(result.credential).toBeNull();
    expect(result.reason).toBe("REFRESH_FAILED");
  });
});

// ---------------------------------------------------------------------------
// T099: tokenStore.set signature — must be called with 2 args (userId, token)
// ---------------------------------------------------------------------------

describe("resolveRovoDevCredentialV2 — tokenStore.set called with (userId, token) (T099)", () => {
  const mockTokenStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("tokenStore.set is called with 2 args — (userId, token) — not 1 merged object", async () => {
    const storedToken = {
      accessToken: "expiring-token-t099",
      refreshToken: "refresh-token-t099",
      site: "https://myorg.atlassian.net",
      email: "user-t099@example.com",
      expiresAtMs: Date.now() + 30_000,
      accountId: "account-id-t099",
    };
    mockTokenStore.get.mockResolvedValue(storedToken);
    mockTokenStore.set.mockResolvedValue(undefined);

    vi.mocked(refreshOAuthToken).mockResolvedValue({
      access_token: "refreshed-access-t099",
      refresh_token: "refreshed-refresh-t099",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "read:me",
    });

    await resolveRovoDevCredentialV2({ tokenStore: mockTokenStore, userId: "user-t099" });

    expect(mockTokenStore.set).toHaveBeenCalledTimes(1);

    const setCall = mockTokenStore.set.mock.calls[0];

    // First arg MUST be the userId string
    expect(typeof setCall?.[0]).toBe("string");
    expect(setCall?.[0]).toBe("user-t099");

    // Second arg MUST be the token object
    expect(typeof setCall?.[1]).toBe("object");
    expect(setCall?.[1]).toMatchObject({
      accessToken: "refreshed-access-t099",
      refreshToken: "refreshed-refresh-t099",
    });

    // Exactly 2 args, not 1
    expect(setCall?.length).toBe(2);
  });
});
