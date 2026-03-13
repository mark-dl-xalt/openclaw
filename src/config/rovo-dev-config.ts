/**
 * T014: Rovo Dev service-account configuration and validation.
 *
 * Defines the required env var names and the validateRovoDevServiceAccount()
 * helper used by both the auth module and the availability check.
 */

// ---------------------------------------------------------------------------
// Required env var names
// ---------------------------------------------------------------------------

/** Atlassian API token (personal access token or service-account token). */
export const ROVODEV_TOKEN_ENV = "OPENCLAW_LIVE_ROVODEV_TOKEN";

/** Atlassian site base URL, e.g. https://myorg.atlassian.net */
export const ROVODEV_SITE_URL_ENV = "OPENCLAW_LIVE_ROVODEV_SITE";

/** User email associated with the token. */
export const ROVODEV_USER_EMAIL_ENV = "OPENCLAW_LIVE_ROVODEV_EMAIL";

const REQUIRED_ROVODEV_ENV_VARS = [
  ROVODEV_TOKEN_ENV,
  ROVODEV_SITE_URL_ENV,
  ROVODEV_USER_EMAIL_ENV,
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceAccountValidation =
  | { valid: true; missingKeys?: [] }
  | { valid: false; missingKeys: string[] };

// ---------------------------------------------------------------------------
// validateRovoDevServiceAccount
// ---------------------------------------------------------------------------

/**
 * Validates that all required Rovo Dev service-account env vars are present
 * and non-empty.  Returns `{ valid: true }` when all vars are set, or
 * `{ valid: false, missingKeys }` listing the absent variable names.
 */
export function validateRovoDevServiceAccount(): ServiceAccountValidation {
  const missingKeys: string[] = [];

  for (const key of REQUIRED_ROVODEV_ENV_VARS) {
    const value = process.env[key]?.trim();
    if (!value) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length === 0) {
    return { valid: true };
  }

  return { valid: false, missingKeys };
}
