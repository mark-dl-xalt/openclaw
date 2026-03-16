/**
 * T049: OAuth 2.1 PKCE flow helpers for Atlassian integration.
 *
 * Handles PKCE code generation, authorization URL construction, token
 * exchange, token refresh, user identity fetching, and in-memory flow
 * state management. Uses native `fetch()` (Node 18+) and `node:crypto`.
 *
 * Uses PKCE with `client_secret` (required by Atlassian for token exchange/refresh).
 */

import { createHash, randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Atlassian token endpoint response shape. */
export interface AtlassianTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/** Atlassian user identity from `GET /me`. */
export interface AtlassianUserIdentity {
  account_id: string;
  email: string;
  name: string;
  picture: string;
}

/** In-flight OAuth flow state (stored server-side, one-time use). */
export interface OAuthFlowState {
  state: string;
  codeVerifier: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Fetch function type (for dependency injection in tests)
// ---------------------------------------------------------------------------

type FetchFn = typeof globalThis.fetch;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ATLASSIAN_AUTH_BASE = "https://auth.atlassian.com";
const ATLASSIAN_API_BASE = "https://api.atlassian.com";

const OAUTH_SCOPES =
  "read:jira-work write:jira-work read:confluence-content.all read:bitbucket-repo offline_access";

const DEFAULT_REDIRECT_URI = "http://localhost:3000/auth/atlassian/callback";

/** Flow state expiry in milliseconds (600 seconds). */
const FLOW_STATE_EXPIRY_MS = 600_000;

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/**
 * Generates a 128-character base64url code verifier from 96 random bytes.
 */
export function generateCodeVerifier(): string {
  return randomBytes(96).toString("base64url");
}

/**
 * Generates a S256 code challenge: SHA-256 hash of the verifier, base64url
 * encoded.
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// ---------------------------------------------------------------------------
// Authorization URL builder
// ---------------------------------------------------------------------------

/**
 * Builds the Atlassian OAuth 2.1 authorization URL with PKCE parameters.
 *
 * Reads `ATLASSIAN_OAUTH_CLIENT_ID` from `process.env`. The redirect URI
 * defaults to `http://localhost:3000/auth/atlassian/callback` but can be
 * overridden via `ATLASSIAN_OAUTH_REDIRECT_URI`.
 */
export function buildAuthorizationUrl(state: string, codeChallenge: string): string {
  const clientId = process.env.ATLASSIAN_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("ATLASSIAN_OAUTH_CLIENT_ID environment variable is not set");
  }

  const redirectUri = process.env.ATLASSIAN_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${ATLASSIAN_AUTH_BASE}/authorize?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchanges an authorization code + PKCE verifier for an access/refresh
 * token pair.
 *
 * @param code          - The authorization code from the callback.
 * @param codeVerifier  - The original PKCE code verifier.
 * @param fetchFn       - Optional fetch implementation (for testing).
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<AtlassianTokenResponse> {
  const clientId = process.env.ATLASSIAN_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("ATLASSIAN_OAUTH_CLIENT_ID environment variable is not set");
  }

  const redirectUri = process.env.ATLASSIAN_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  // Atlassian requires form-urlencoded (not JSON) and client_secret.
  const payload: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  };
  const clientSecret = process.env.ATLASSIAN_OAUTH_CLIENT_SECRET;
  if (clientSecret) {
    payload.client_secret = clientSecret;
  }

  const response = await fetchFn(`${ATLASSIAN_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as AtlassianTokenResponse;
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Refreshes an OAuth token using a refresh token.
 *
 * On failure the caller is responsible for handling the error (e.g.
 * returning `REFRESH_FAILED` and redirecting the user to login).
 *
 * @param refreshToken - The stored refresh token.
 * @param fetchFn      - Optional fetch implementation (for testing).
 */
export async function refreshOAuthToken(
  refreshToken: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<AtlassianTokenResponse> {
  const clientId = process.env.ATLASSIAN_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("ATLASSIAN_OAUTH_CLIENT_ID environment variable is not set");
  }

  // Atlassian requires form-urlencoded (not JSON) and client_secret for refresh.
  const payload: Record<string, string> = {
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  };
  const clientSecret = process.env.ATLASSIAN_OAUTH_CLIENT_SECRET;
  if (clientSecret) {
    payload.client_secret = clientSecret;
  }

  const response = await fetchFn(`${ATLASSIAN_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as AtlassianTokenResponse;
}

// ---------------------------------------------------------------------------
// User identity
// ---------------------------------------------------------------------------

/**
 * Fetches the authenticated user's Atlassian identity.
 *
 * @param accessToken - A valid Atlassian access token.
 * @param fetchFn     - Optional fetch implementation (for testing).
 */
export async function fetchAtlassianUserIdentity(
  accessToken: string,
  fetchFn: FetchFn = globalThis.fetch,
): Promise<AtlassianUserIdentity> {
  const response = await fetchFn(`${ATLASSIAN_API_BASE}/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Atlassian user identity (${response.status}): ${errorText}`);
  }

  return (await response.json()) as AtlassianUserIdentity;
}

// ---------------------------------------------------------------------------
// Flow state management (in-memory, one-time use, 600 s expiry)
// ---------------------------------------------------------------------------

/** In-memory store for pending OAuth flows, keyed by state nonce. */
const flowStates = new Map<string, OAuthFlowState>();

/**
 * Stores an OAuth flow state for later retrieval during the callback.
 */
export function storeFlowState(flowState: OAuthFlowState): void {
  flowStates.set(flowState.state, flowState);
}

/**
 * Retrieves and deletes a flow state by its `state` nonce.
 *
 * Returns `null` if the state is not found or has expired (older than 600
 * seconds). The entry is always deleted on retrieval (one-time use).
 */
export function getAndDeleteFlowState(state: string): OAuthFlowState | null {
  const flowState = flowStates.get(state);
  if (!flowState) {
    return null;
  }

  // Always delete — one-time use regardless of expiry check result.
  flowStates.delete(state);

  const ageMs = Date.now() - flowState.createdAt;
  if (ageMs > FLOW_STATE_EXPIRY_MS) {
    return null;
  }

  return flowState;
}
