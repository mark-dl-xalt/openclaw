/**
 * Rovo Dev status injection hook.
 *
 * Registers an agent:bootstrap internal hook that injects a Rovo Dev connection
 * status line into the atlas agent's system prompt context on every turn.
 *
 * The status is determined by checking whether the acli credential file exists
 * at ~/.config/acli/rovodev_config.yaml — a lightweight filesystem check with
 * no subprocess or network overhead.
 *
 * Only injects for the "atlas" agent (not "rovo-worker" or other sub-agents).
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isAgentBootstrapEvent } from "../hooks/internal-hooks.js";
import { registerInternalHook } from "../hooks/internal-hooks.js";
import type { WorkspaceBootstrapFile } from "./workspace.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACLI_ROVODEV_CONFIG_PATH = path.join(os.homedir(), ".config", "acli", "rovodev_config.yaml");

const ROVO_STATUS_FILE_PATH = "(rovo-dev-status)";
const ATLAS_AGENT_ID = "atlas";
const ROVO_WORKER_AGENT_ID = "rovo-worker";

// ---------------------------------------------------------------------------
// Status check
// ---------------------------------------------------------------------------

/**
 * Returns true if acli has a Rovo Dev credential file present.
 * Uses filesystem access only — no subprocess spawned.
 *
 * @param configPath - Path to check (injectable for testing)
 */
export async function checkAcliAuthenticated(
  configPath: string = ACLI_ROVODEV_CONFIG_PATH,
): Promise<boolean> {
  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Status text builders
// ---------------------------------------------------------------------------

export function buildRovoStatusContent(connected: boolean): string {
  if (connected) {
    return [
      "[Rovo Dev Status: Connected]",
      "Rovo Dev is available. Prefer delegate_to_rovo for Atlassian queries.",
    ].join(" ");
  }
  return [
    "[Rovo Dev Status: Not Connected]",
    "Rovo Dev is not available. Use atlassian_api for Jira/Confluence queries.",
    "Bitbucket and Teamwork Graph queries require Rovo Dev — explain this to the user.",
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Hook registration
// ---------------------------------------------------------------------------

/**
 * Registers the agent:bootstrap hook that injects Rovo Dev status into the
 * atlas agent's system prompt context.
 *
 * Call once during gateway startup, after clearInternalHooks().
 */
export function registerRovoDevStatusHook(opts?: {
  /** Override config path for tests */
  acliConfigPath?: string;
  /** Override atlas agent ID for tests */
  atlasAgentId?: string;
}): void {
  const acliConfigPath = opts?.acliConfigPath ?? ACLI_ROVODEV_CONFIG_PATH;
  const atlasAgentId = opts?.atlasAgentId ?? ATLAS_AGENT_ID;

  registerInternalHook("agent:bootstrap", async (event) => {
    if (!isAgentBootstrapEvent(event)) {
      return;
    }

    const context = event.context;

    // Only inject for the atlas agent. Skip rovo-worker and any other
    // sub-agents — they don't use delegate_to_rovo and don't need this context.
    const agentId = context.agentId;
    if (agentId === ROVO_WORKER_AGENT_ID) {
      return;
    }
    // If agentId is set and is not atlas (or undefined/null for default), skip.
    if (agentId && agentId !== atlasAgentId) {
      return;
    }

    const connected = await checkAcliAuthenticated(acliConfigPath);
    const content = buildRovoStatusContent(connected);

    const statusFile = {
      name: "AGENTS.md",
      path: ROVO_STATUS_FILE_PATH,
      content,
      missing: false,
    } as unknown as WorkspaceBootstrapFile;

    context.bootstrapFiles = [...context.bootstrapFiles, statusFile];
  });
}
