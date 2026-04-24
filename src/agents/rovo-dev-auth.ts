/**
 * T024: Rovo Dev authentication helpers.
 *
 * Tier 1: service-account credentials via environment variables.
 * Tier 2: OAuth 2.1 3LO per-user credential via TokenStore.
 */

import { refreshOAuthToken } from "../auth/oauth-atlassian.js";
import {
  ROVODEV_SITE_URL_ENV,
  ROVODEV_TOKEN_ENV,
  ROVODEV_USER_EMAIL_ENV,
} from "../config/rovo-dev-config.js";

// Re-export from config so callers can import from a single place.
export { validateRovoDevServiceAccount } from "../config/rovo-dev-config.js";
export type { ServiceAccountValidation } from "../config/rovo-dev-config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Credential resolved from service-account env vars. */
export type RovoDevServiceAccountCredential = {
  type: "service-account";
  /** Atlassian API token (personal access token). */
  accessToken: string;
  /** Atlassian site base URL, e.g. https://myorg.atlassian.net */
  site: string;
  /** User email associated with the token. */
  email: string;
};

/** Future: OAuth 2.1 3LO credential (not yet implemented). */
export type RovoDevOAuthCredential = {
  type: "oauth";
  accessToken: string;
  refreshToken: string;
  site: string;
  email: string;
  expiresAtMs: number;
};

/** Union of all supported Rovo Dev credential types. */
export type RovoDevCredential = RovoDevServiceAccountCredential | RovoDevOAuthCredential;

// ---------------------------------------------------------------------------
// resolveRovoDevCredential
// ---------------------------------------------------------------------------

/**
 * Resolves a Rovo Dev credential for the given user (or globally for
 * service-account mode).
 *
 * Resolution order:
 * 1. Service-account env vars (Tier 1).
 * 2. OAuth 2.1 3LO per-user credential (Tier 2 — returns null, not yet implemented).
 *
 * Returns `null` when no valid credential is found.
 */
export function resolveRovoDevCredential(_userId?: string): RovoDevCredential | null {
  // Tier 1: service-account env vars
  const token = process.env[ROVODEV_TOKEN_ENV]?.trim();
  const site = process.env[ROVODEV_SITE_URL_ENV]?.trim();
  const email = process.env[ROVODEV_USER_EMAIL_ENV]?.trim();

  if (token && site && email) {
    return {
      type: "service-account",
      accessToken: token,
      site,
      email,
    };
  }

  // Tier 2: OAuth (not yet implemented)
  return null;
}

// ---------------------------------------------------------------------------
// resolveServiceAccountCredential
// ---------------------------------------------------------------------------

/**
 * Resolve service-account credential from env vars.
 * Separate from OAuth flow — used for health checks only.
 */
export function resolveServiceAccountCredential(): RovoDevServiceAccountCredential | null {
  const token = process.env[ROVODEV_TOKEN_ENV]?.trim();
  const site = process.env[ROVODEV_SITE_URL_ENV]?.trim();
  const email = process.env[ROVODEV_USER_EMAIL_ENV]?.trim();

  if (token && site && email) {
    return {
      type: "service-account",
      accessToken: token,
      site,
      email,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// resolveRovoDevCredentialV2 — OAuth-first, NO Tier 1 fallthrough
// ---------------------------------------------------------------------------

/** Result of OAuth credential resolution. */
export type CredentialResult =
  | { credential: RovoDevCredential; reason?: undefined }
  | { credential: null; reason: "AUTH_REQUIRED" | "REFRESH_FAILED" };

/** Expiry buffer — refresh if token expires within this window. */
const EXPIRY_BUFFER_MS = 60_000;

/**
 * OAuth-first credential resolution. NO Tier 1 fallthrough.
 *
 * 1. TokenStore.get(userId) — if null -> AUTH_REQUIRED
 * 2. If near expiry (within 60s) -> refresh
 * 3. If refresh fails -> REFRESH_FAILED (delete token, no service account fallback)
 * 4. Return oauth credential
 */
export async function resolveRovoDevCredentialV2(opts: {
  tokenStore: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic token store interface
    get: (userId: string) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic token store interface
    set: (userId: string, token: any) => Promise<void>;
    delete: (userId: string) => Promise<void>;
  };
  userId?: string;
  /** Optional fetch implementation for token refresh (for testing). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened for test mock compat
  fetchFn?: (...args: any[]) => Promise<any>;
}): Promise<CredentialResult> {
  const userId = opts.userId ?? "default";
  const stored = await opts.tokenStore.get(userId);

  if (!stored) {
    return { credential: null, reason: "AUTH_REQUIRED" };
  }

  // Support both expiresAtMs and expiresAt field names.
  const expiresAtMs: number | undefined = stored.expiresAtMs ?? stored.expiresAt;
  const isNearExpiry = expiresAtMs !== undefined && expiresAtMs - Date.now() < EXPIRY_BUFFER_MS;

  if (isNearExpiry) {
    try {
      const refreshed = opts.fetchFn
        ? await refreshOAuthToken(stored.refreshToken, opts.fetchFn as typeof globalThis.fetch)
        : await refreshOAuthToken(stored.refreshToken);

      // Map snake_case Atlassian response to camelCase internal model.
      const newAccessToken = refreshed.access_token;
      const newRefreshToken = refreshed.refresh_token;
      const newExpiresAtMs = Date.now() + refreshed.expires_in * 1000;

      // Persist the refreshed token.
      await opts.tokenStore.set(userId, {
        ...stored,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAtMs: newExpiresAtMs,
      });

      return {
        credential: {
          type: "oauth",
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          site: stored.site,
          email: stored.email ?? "",
          expiresAtMs: newExpiresAtMs,
        },
      };
    } catch {
      // Refresh failed — remove stale token, do NOT fall back to service-account.
      await opts.tokenStore.delete(userId);
      return { credential: null, reason: "REFRESH_FAILED" };
    }
  }

  // Token is still valid — return it directly.
  return {
    credential: {
      type: "oauth",
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      site: stored.site,
      email: stored.email ?? "",
      expiresAtMs: expiresAtMs ?? 0,
    },
  };
}
