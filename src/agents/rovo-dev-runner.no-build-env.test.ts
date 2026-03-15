/**
 * T116: Verify that buildRovoDevEnv is NOT exported from rovo-dev-runner.ts.
 *
 * acli authenticates exclusively via macOS keychain (ATAT tokens), not via
 * USER_EMAIL / USER_API_TOKEN environment variables. The buildRovoDevEnv
 * function injected those env vars and is now dead code.
 *
 * This test FAILS against the current code (buildRovoDevEnv IS exported) and
 * PASSES after T118 removes the function and its export.
 */

import { describe, expect, it } from "vitest";
import * as rovoDevRunner from "./rovo-dev-runner.js";

describe("rovo-dev-runner module exports (T116)", () => {
  it("does not export buildRovoDevEnv — acli uses keychain, not env var credentials", () => {
    expect(
      "buildRovoDevEnv" in rovoDevRunner,
      "buildRovoDevEnv should have been removed: acli authenticates via macOS keychain (ATAT tokens) only, not USER_EMAIL/USER_API_TOKEN env vars",
    ).toBe(false);
  });

  it("still exports runRovoDev as the primary entry point", () => {
    expect(typeof rovoDevRunner.runRovoDev).toBe("function");
  });

  it("still exports RovoDevError constructor", () => {
    expect(typeof rovoDevRunner.RovoDevError).toBe("function");
  });
});
