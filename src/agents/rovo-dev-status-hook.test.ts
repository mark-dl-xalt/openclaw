import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearInternalHooks } from "../hooks/internal-hooks.js";
import { applyBootstrapHookOverrides } from "./bootstrap-hooks.js";
import {
  buildRovoStatusContent,
  checkAcliAuthenticated,
  registerRovoDevStatusHook,
} from "./rovo-dev-status-hook.js";
import { DEFAULT_SOUL_FILENAME, type WorkspaceBootstrapFile } from "./workspace.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(
  name: WorkspaceBootstrapFile["name"] = DEFAULT_SOUL_FILENAME,
): WorkspaceBootstrapFile {
  return { name, path: `/tmp/${name}`, content: "base", missing: false };
}

// ---------------------------------------------------------------------------
// checkAcliAuthenticated
// ---------------------------------------------------------------------------

describe("checkAcliAuthenticated", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rovo-status-test-"));
    configPath = path.join(tmpDir, "rovodev_config.yaml");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns true when the config file exists", async () => {
    await fs.writeFile(configPath, "version: 1\n");
    expect(await checkAcliAuthenticated(configPath)).toBe(true);
  });

  it("returns false when the config file does not exist", async () => {
    expect(await checkAcliAuthenticated(configPath)).toBe(false);
  });

  it("returns false for a non-existent path", async () => {
    expect(await checkAcliAuthenticated("/nonexistent/path/rovodev_config.yaml")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildRovoStatusContent
// ---------------------------------------------------------------------------

describe("buildRovoStatusContent", () => {
  it("returns connected message when connected=true", () => {
    const content = buildRovoStatusContent(true);
    expect(content).toContain("[Rovo Dev Status: Connected]");
    expect(content).toContain("delegate_to_rovo");
    expect(content).not.toContain("Not Connected");
  });

  it("returns not-connected message when connected=false", () => {
    const content = buildRovoStatusContent(false);
    expect(content).toContain("[Rovo Dev Status: Not Connected]");
    expect(content).toContain("atlassian_api");
    expect(content).toContain("Bitbucket");
    expect(content).not.toContain("delegate_to_rovo");
  });
});

// ---------------------------------------------------------------------------
// registerRovoDevStatusHook
// ---------------------------------------------------------------------------

describe("registerRovoDevStatusHook", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    clearInternalHooks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rovo-status-hook-test-"));
    configPath = path.join(tmpDir, "rovodev_config.yaml");
  });

  afterEach(async () => {
    clearInternalHooks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("injects a status file for the atlas agent when connected", async () => {
    await fs.writeFile(configPath, "version: 1\n");
    registerRovoDevStatusHook({ acliConfigPath: configPath, atlasAgentId: "atlas" });

    const updated = await applyBootstrapHookOverrides({
      files: [makeFile()],
      workspaceDir: "/tmp",
      agentId: "atlas",
    });

    expect(updated).toHaveLength(2);
    const statusFile = updated.find((f) => f.path === "(rovo-dev-status)");
    expect(statusFile).toBeDefined();
    expect(statusFile?.content).toContain("[Rovo Dev Status: Connected]");
    expect(statusFile?.missing).toBe(false);
  });

  it("injects a not-connected status file when acli config is absent", async () => {
    registerRovoDevStatusHook({ acliConfigPath: configPath, atlasAgentId: "atlas" });

    const updated = await applyBootstrapHookOverrides({
      files: [makeFile()],
      workspaceDir: "/tmp",
      agentId: "atlas",
    });

    expect(updated).toHaveLength(2);
    const statusFile = updated.find((f) => f.path === "(rovo-dev-status)");
    expect(statusFile).toBeDefined();
    expect(statusFile?.content).toContain("[Rovo Dev Status: Not Connected]");
  });

  it("does not inject for rovo-worker agent", async () => {
    await fs.writeFile(configPath, "version: 1\n");
    registerRovoDevStatusHook({ acliConfigPath: configPath, atlasAgentId: "atlas" });

    const updated = await applyBootstrapHookOverrides({
      files: [makeFile()],
      workspaceDir: "/tmp",
      agentId: "rovo-worker",
    });

    expect(updated).toHaveLength(1);
    expect(updated.find((f) => f.path === "(rovo-dev-status)")).toBeUndefined();
  });

  it("does not inject for other unknown agent IDs", async () => {
    await fs.writeFile(configPath, "version: 1\n");
    registerRovoDevStatusHook({ acliConfigPath: configPath, atlasAgentId: "atlas" });

    const updated = await applyBootstrapHookOverrides({
      files: [makeFile()],
      workspaceDir: "/tmp",
      agentId: "some-other-agent",
    });

    expect(updated).toHaveLength(1);
    expect(updated.find((f) => f.path === "(rovo-dev-status)")).toBeUndefined();
  });

  it("injects when agentId is undefined (default session)", async () => {
    await fs.writeFile(configPath, "version: 1\n");
    registerRovoDevStatusHook({ acliConfigPath: configPath, atlasAgentId: "atlas" });

    const updated = await applyBootstrapHookOverrides({
      files: [makeFile()],
      workspaceDir: "/tmp",
      // agentId intentionally omitted
    });

    expect(updated).toHaveLength(2);
    expect(updated.find((f) => f.path === "(rovo-dev-status)")).toBeDefined();
  });

  it("preserves existing bootstrap files when injecting", async () => {
    await fs.writeFile(configPath, "version: 1\n");
    registerRovoDevStatusHook({ acliConfigPath: configPath, atlasAgentId: "atlas" });

    const original = [makeFile("SOUL.md"), makeFile("AGENTS.md")];
    const updated = await applyBootstrapHookOverrides({
      files: original,
      workspaceDir: "/tmp",
      agentId: "atlas",
    });

    expect(updated).toHaveLength(3);
    expect(updated[0]?.name).toBe("SOUL.md");
    expect(updated[1]?.name).toBe("AGENTS.md");
    expect(updated[2]?.path).toBe("(rovo-dev-status)");
  });
});
