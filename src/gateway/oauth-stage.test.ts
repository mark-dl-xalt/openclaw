/**
 * T104: Tests for createOAuthStageHandler return shape.
 *
 * After T109, createOAuthStageHandler returns { handleRequest, tokenStore }
 * instead of a bare function.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/token-store.js", () => ({
  createTokenStore: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../routes/auth-atlassian-routes.js", () => ({
  createAuthRoutes: vi.fn().mockReturnValue({
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  }),
}));

vi.mock("express", async () => {
  const app = {
    disable: vi.fn(),
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  };
  const express = vi.fn().mockReturnValue(app);
  // express.json() is called as a static method on the express function.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
  (express as any).json = vi
    .fn()
    .mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next());
  return { default: express };
});

vi.mock("cookie-parser", () => ({
  default: vi.fn().mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock("express-session", () => ({
  default: vi.fn().mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next()),
}));

import { createOAuthStageHandler } from "./oauth-stage.js";

describe("createOAuthStageHandler return shape (T104)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns { handleRequest, tokenStore } when OAuth is configured", async () => {
    vi.stubEnv("ATLASSIAN_OAUTH_CLIENT_ID", "test-client-id");

    const result = await createOAuthStageHandler();

    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();

    expect(typeof result.handleRequest).toBe("function");

    expect(result.tokenStore).toBeDefined();
    expect(typeof result.tokenStore?.get).toBe("function");
    expect(typeof result.tokenStore?.set).toBe("function");
    expect(typeof result.tokenStore?.delete).toBe("function");
  });

  it("returns { handleRequest, tokenStore: null } when OAuth is not configured", async () => {
    // No ATLASSIAN_OAUTH_CLIENT_ID set
    const result = await createOAuthStageHandler();

    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();

    expect(typeof result.handleRequest).toBe("function");
    expect(result.tokenStore).toBeNull();

    // handleRequest should be a no-op returning false
    const handled = await result.handleRequest(
      {} as import("node:http").IncomingMessage,
      {} as import("node:http").ServerResponse,
    );
    expect(handled).toBe(false);
  });
});
