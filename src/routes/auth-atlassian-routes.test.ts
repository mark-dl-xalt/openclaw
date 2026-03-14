import express, { type Express } from "express";
import request from "supertest";
/**
 * T041-T043b: Tests for Atlassian OAuth HTTP route handlers.
 *
 * These tests import from files that do not exist yet.
 * They MUST fail until the implementation is written.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Mock helpers from the existing test-helpers file.
import {
  createMockTokenResponse,
  createMockUserIdentity,
  createMockOAuthFlowState,
  createExpiredOAuthFlowState,
  createFailingTokenEndpoint,
} from "../auth/atlassian-oauth-mocks.test-helpers.js";
// TokenStore mock — the real module does not exist yet.
import type { TokenStore } from "../auth/token-store.js";
// Import from the not-yet-created implementation file.
import { createAuthRoutes } from "./auth-atlassian-routes.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTokenStore(): TokenStore & {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build an Express app wired with the auth routes under test.
 * Accepts overrides for the token store and fetch mocks.
 */
function buildTestApp(opts?: {
  tokenStore?: ReturnType<typeof createMockTokenStore>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened for vi.fn() compat
  fetchMock?: (...args: any[]) => Promise<any>;
}) {
  const app: Express = express();
  const tokenStore = opts?.tokenStore ?? createMockTokenStore();

  // Minimal session-like middleware for test purposes.
  // The real app uses express-session; here we simulate it with a plain object.
  app.use((req, _res, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test session mock
    (req as any).session = (req as any).session ?? {};
    next();
  });

  const router = createAuthRoutes({
    tokenStore,
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost:3000/auth/atlassian/callback",
    scopes: "read:jira-work write:jira-work offline_access",
    fetchFn: opts?.fetchMock,
  });

  app.use("/auth/atlassian", router);

  // Dummy protected route for integration tests.
  app.get("/dashboard", (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test session mock
    if (!(req as any).session?.userId) {
      res.redirect("/login");
      return;
    }
    res.status(200).send("<h1>Dashboard</h1>");
  });

  app.get("/login", (_req, res) => {
    res.status(200).send("<html><body>Sign in with Atlassian</body></html>");
  });

  return { app, tokenStore };
}

// ---------------------------------------------------------------------------
// T041: GET /auth/atlassian (login initiation)
// ---------------------------------------------------------------------------
describe("GET /auth/atlassian — login initiation (T041)", () => {
  it("redirects (302) to Atlassian authorize URL", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/auth/atlassian");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBeDefined();
    expect(res.headers.location).toContain("auth.atlassian.com");
  });

  it("redirect URL contains required OAuth PKCE parameters", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/auth/atlassian");
    const location = new URL(res.headers.location);

    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/auth/atlassian/callback",
    );
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toBeTruthy();
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("scope")).toContain("read:jira-work");
  });
});

// ---------------------------------------------------------------------------
// T042: GET /auth/atlassian/callback
// ---------------------------------------------------------------------------
describe("GET /auth/atlassian/callback (T042)", () => {
  let tokenStore: ReturnType<typeof createMockTokenStore>;
  let app: Express;
  let _flowState: ReturnType<typeof createMockOAuthFlowState>;

  beforeEach(() => {
    tokenStore = createMockTokenStore();
    _flowState = createMockOAuthFlowState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // (a) Valid state + code -> token stored, session created, redirect to /dashboard
  it("valid state + code -> stores token, creates session, redirects to /dashboard", async () => {
    const mockTokenResponse = createMockTokenResponse();
    const mockUser = createMockUserIdentity();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTokenResponse,
        text: async () => JSON.stringify(mockTokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUser,
        text: async () => JSON.stringify(mockUser),
      });

    ({ app } = buildTestApp({ tokenStore, fetchMock }));

    // First initiate login to establish flow state
    const initRes = await request(app).get("/auth/atlassian");
    const redirectUrl = new URL(initRes.headers.location);
    const state = redirectUrl.searchParams.get("state")!;

    // Extract cookies from initiation response for state continuity
    const cookies = initRes.headers["set-cookie"];

    // Now simulate callback with the same state
    const callbackRes = await request(app)
      .get(`/auth/atlassian/callback?code=test-auth-code&state=${state}`)
      .set("Cookie", cookies ?? []);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe("/dashboard");
    expect(tokenStore.set).toHaveBeenCalled();
  });

  // (b) Expired state (>600s) -> redirect to /login?reason=error
  it("expired state (>600s) -> redirects to /login?reason=error", async () => {
    const expired = createExpiredOAuthFlowState();
    ({ app } = buildTestApp({ tokenStore }));

    const res = await request(app).get(
      `/auth/atlassian/callback?code=test-code&state=${expired.state}`,
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/login");
    expect(res.headers.location).toContain("reason=error");
  });

  // (c) Wrong/unknown state -> redirect to /login?reason=error
  it("unknown state -> redirects to /login?reason=error", async () => {
    ({ app } = buildTestApp({ tokenStore }));

    const res = await request(app).get(
      "/auth/atlassian/callback?code=test-code&state=unknown-state-value",
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/login");
    expect(res.headers.location).toContain("reason=error");
  });

  // (d) User-denied error param -> redirect to /login?reason=access_denied
  it("error=access_denied -> redirects to /login?reason=access_denied", async () => {
    ({ app } = buildTestApp({ tokenStore }));

    const res = await request(app).get("/auth/atlassian/callback?error=access_denied");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/login");
    expect(res.headers.location).toContain("reason=access_denied");
  });

  // (e) Atlassian token exchange failure -> redirect to /login?reason=error
  it("token exchange failure -> redirects to /login?reason=error", async () => {
    const failingFetch = createFailingTokenEndpoint("Token exchange failed");
    ({ app } = buildTestApp({ tokenStore, fetchMock: failingFetch }));

    // Initiate login first to get valid state
    const initRes = await request(app).get("/auth/atlassian");
    const redirectUrl = new URL(initRes.headers.location);
    const state = redirectUrl.searchParams.get("state")!;
    const cookies = initRes.headers["set-cookie"];

    const callbackRes = await request(app)
      .get(`/auth/atlassian/callback?code=test-code&state=${state}`)
      .set("Cookie", cookies ?? []);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toContain("/login");
    expect(callbackRes.headers.location).toContain("reason=error");
  });
});

// ---------------------------------------------------------------------------
// T043: POST /auth/signout
// ---------------------------------------------------------------------------
describe("POST /auth/signout (T043)", () => {
  it("calls TokenStore.delete, invalidates session, clears cookie, redirects to /login", async () => {
    const tokenStore = createMockTokenStore();
    const { app } = buildTestApp({ tokenStore });

    const res = await request(app).post("/auth/atlassian/signout");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
    expect(tokenStore.delete).toHaveBeenCalled();

    // Set-Cookie should be present (session clearing)
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
  });

  it("after signout, subsequent GET /dashboard redirects to /login", async () => {
    const tokenStore = createMockTokenStore();
    const { app } = buildTestApp({ tokenStore });

    // Sign out first
    await request(app).post("/auth/atlassian/signout");

    // Now try to access dashboard
    const dashRes = await request(app).get("/dashboard");

    expect(dashRes.status).toBe(302);
    expect(dashRes.headers.location).toBe("/login");
  });
});

// ---------------------------------------------------------------------------
// T043b: Integration test — unauthenticated flows
// ---------------------------------------------------------------------------
describe("integration: unauthenticated access (T043b)", () => {
  it("GET /dashboard without session -> 302 to /login", async () => {
    const { app } = buildTestApp();

    const res = await request(app).get("/dashboard");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it('GET /login -> 200 with "Sign in with Atlassian" text', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get("/login");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Sign in with Atlassian");
  });
});
