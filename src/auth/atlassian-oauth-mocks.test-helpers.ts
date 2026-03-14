/**
 * T038: Mock helpers for Atlassian OAuth 2.1 PKCE flow tests.
 *
 * These helpers create mock responses and flow state for testing the OAuth
 * login flow without hitting Atlassian servers.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Types (self-contained — no imports from unwritten files)
// ---------------------------------------------------------------------------

export interface AtlassianTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface AtlassianUserIdentity {
  account_id: string;
  email: string;
  name: string;
  picture: string;
}

export interface OAuthFlowState {
  state: string;
  codeVerifier: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Build a mock Atlassian token exchange response. */
export function createMockTokenResponse(
  overrides?: Partial<AtlassianTokenResponse>,
): AtlassianTokenResponse {
  return {
    access_token: `mock-access-token-${randomUUID()}`,
    refresh_token: `mock-refresh-token-${randomUUID()}`,
    token_type: "Bearer",
    expires_in: 3600,
    scope:
      "read:jira-work write:jira-work read:confluence-content.all read:bitbucket-repo offline_access",
    ...overrides,
  };
}

/** Build a mock Atlassian user identity payload. */
export function createMockUserIdentity(
  overrides?: Partial<AtlassianUserIdentity>,
): AtlassianUserIdentity {
  return {
    account_id: `mock-account-${randomUUID().slice(0, 8)}`,
    email: "test@example.com",
    name: "Test User",
    picture: "https://avatar.example.com/test.png",
    ...overrides,
  };
}

/** Build a valid in-flight OAuth flow state (not yet expired). */
export function createMockOAuthFlowState(): OAuthFlowState {
  return {
    state: randomBytes(16).toString("hex"),
    codeVerifier: randomBytes(64).toString("base64url"),
    createdAt: Date.now(),
  };
}

/** Build an expired OAuth flow state (>600 s old). */
export function createExpiredOAuthFlowState(): OAuthFlowState {
  return {
    ...createMockOAuthFlowState(),
    createdAt: Date.now() - 601_000, // 601 seconds — past the 600 s window
  };
}

// ---------------------------------------------------------------------------
// HTTP endpoint mocks (vi.fn()-based, no msw dependency)
// ---------------------------------------------------------------------------

/**
 * Returns a `vi.fn()` that mimics `fetch()` for the Atlassian token endpoint
 * (`POST https://auth.atlassian.com/oauth/token`).
 *
 * The mock resolves with a `Response`-like object whose `.json()` returns
 * the configured {@link AtlassianTokenResponse}.
 */
export function createMockAtlassianTokenEndpoint(
  response?: AtlassianTokenResponse | null,
  statusCode = 200,
) {
  const body = response ?? createMockTokenResponse();
  return vi.fn().mockResolvedValue({
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

/**
 * Returns a `vi.fn()` that mimics `fetch()` for the Atlassian user identity
 * endpoint (`GET https://api.atlassian.com/me`).
 */
export function createMockAtlassianUserEndpoint(
  response?: AtlassianUserIdentity | null,
  statusCode = 200,
) {
  const body = response ?? createMockUserIdentity();
  return vi.fn().mockResolvedValue({
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

/**
 * Returns a `vi.fn()` that rejects, simulating a network error when calling
 * the Atlassian token endpoint.
 */
export function createFailingTokenEndpoint(errorMessage = "Network error") {
  return vi.fn().mockRejectedValue(new Error(errorMessage));
}
