/**
 * T024: Rovo Dev authentication helpers.
 *
 * Tier 1: service-account credentials via environment variables.
 * Tier 2: OAuth 2.1 3LO (returns null for now — not yet implemented).
 */

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
