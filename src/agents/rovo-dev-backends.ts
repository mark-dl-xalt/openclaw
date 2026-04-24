/**
 * T022: Rovo Dev CLI backend configuration.
 *
 * Defines the static ROVODEV_BACKEND config object and the
 * checkRovoDevAvailability() helper.
 */

import type { CliBackendConfig } from "../config/types.js";

// ---------------------------------------------------------------------------
// Static backend config
// ---------------------------------------------------------------------------

/** Backend id registered in cli-backends.ts */
export const ROVODEV_BACKEND_ID = "rovo-dev";

/**
 * Static CliBackendConfig for the Rovo Dev CLI backend.
 *
 * The `id` field is a non-standard extension so callers can look up the
 * canonical backend id without importing ROVODEV_BACKEND_ID separately.
 */
export const ROVODEV_BACKEND: CliBackendConfig & { id: string } = {
  id: ROVODEV_BACKEND_ID,
  command: "acli",
  args: ["rovodev", "run", "--yolo"],
  output: "text",
  input: "arg",
};

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export type RovoDevAvailability = { available: true } | { available: false; reason: string };

export type CheckRovoDevAvailabilityOptions = {
  /**
   * Injectable for testing: resolves to true when `acli` is on PATH.
   * Defaults to checking `which acli` / shelling out.
   */
  checkPath?: () => Promise<boolean>;
};

/**
 * The env vars that must be present for Rovo Dev service-account mode.
 */
const REQUIRED_ROVODEV_ENV_VARS = [
  "OPENCLAW_LIVE_ROVODEV_TOKEN",
  "OPENCLAW_LIVE_ROVODEV_SITE",
  "OPENCLAW_LIVE_ROVODEV_EMAIL",
] as const;

/**
 * Checks whether the Rovo Dev backend is available:
 * 1. `acli` is on PATH.
 * 2. All required service-account env vars are present.
 *
 * Returns `{ available: true }` on success, or
 * `{ available: false, reason }` explaining what is missing.
 */
export async function checkRovoDevAvailability(
  opts: CheckRovoDevAvailabilityOptions = {},
): Promise<RovoDevAvailability> {
  // 1. Check that acli is on PATH
  const checkPath = opts.checkPath ?? defaultCheckPath;
  const onPath = await checkPath();
  if (!onPath) {
    return {
      available: false,
      reason: "acli is not installed or not on PATH. Install with: npm install -g @atlassian/acli",
    };
  }

  // 2. Check required env vars
  const missingVars: string[] = [];
  for (const key of REQUIRED_ROVODEV_ENV_VARS) {
    if (!process.env[key]?.trim()) {
      missingVars.push(key);
    }
  }

  if (missingVars.length > 0) {
    return {
      available: false,
      reason: `Missing required environment variable(s): ${missingVars.join(", ")}`,
    };
  }

  return { available: true };
}

// ---------------------------------------------------------------------------
// Default PATH check
// ---------------------------------------------------------------------------

async function defaultCheckPath(): Promise<boolean> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  try {
    await execFileAsync("which", ["acli"]);
    return true;
  } catch {
    return false;
  }
}
