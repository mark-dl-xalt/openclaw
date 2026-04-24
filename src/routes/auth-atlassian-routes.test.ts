import { EventEmitter } from "node:events";
import express, { type Express } from "express";
import request from "supertest";
/**
 * T041-T043b: Tests for Atlassian OAuth HTTP route handlers.
 *
 * T120-T122: Tests for ATAT token onboarding backend (Phase 3b).
 * These Phase 3b tests MUST fail until the implementation is written.
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

  // (a) Valid state + code -> token stored, session created.
  //     T021: all users (new and returning) redirect to /integrations.
  it("valid state + code -> stores token, creates session, redirects to /integrations (new user)", async () => {
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

    // Now simulate callback with the same state.
    // T021: all users redirect to /integrations after OAuth.
    const callbackRes = await request(app)
      .get(`/auth/atlassian/callback?code=test-auth-code&state=${state}`)
      .set("Cookie", cookies ?? []);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe("/integrations");
    expect(tokenStore.set).toHaveBeenCalled();
  });

  // (a2) Valid state + code, returning user (rovoConnected=true) -> redirect to /integrations.
  //      T021: returning users also land on /integrations (page handles both states dynamically).
  it("valid state + code, rovoConnected session -> redirects to /integrations (returning user)", async () => {
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

    // Build app with a session that already has rovoConnected=true
    const app2 = express();
    app2.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test session mock
      (req as any).session = { rovoConnected: true };
      next();
    });
    const router2 = createAuthRoutes({
      tokenStore,
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      redirectUri: "http://localhost:3000/auth/atlassian/callback",
      scopes: "read:jira-work write:jira-work offline_access",
      fetchFn: fetchMock,
    });
    app2.use("/auth/atlassian", router2);
    // Re-initiate to get a valid state in the same in-memory store
    const initRes = await request(app2).get("/auth/atlassian");
    const redirectUrl = new URL(initRes.headers.location);
    const state = redirectUrl.searchParams.get("state")!;
    const cookies = initRes.headers["set-cookie"];

    const callbackRes = await request(app2)
      .get(`/auth/atlassian/callback?code=test-auth-code&state=${state}`)
      .set("Cookie", cookies ?? []);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe("/integrations");
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

// ---------------------------------------------------------------------------
// Phase 3b helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock child_process that simulates spawn() returning a ChildProcess-
 * like EventEmitter with stdin.write/end and configurable exit behaviour.
 */
function createMockSpawnProcess(opts: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  /** If true, the 'spawn' error event fires with ENOENT instead of exiting. */
  enoent?: boolean;
}): EventEmitter & {
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
} {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  // Emit events asynchronously so listeners can be attached first.
  setImmediate(() => {
    if (opts.enoent) {
      const err = Object.assign(new Error("spawn acli ENOENT"), { code: "ENOENT" });
      proc.emit("error", err);
    } else {
      if (opts.stdout) {
        proc.stdout.emit("data", Buffer.from(opts.stdout));
      }
      if (opts.stderr) {
        proc.stderr.emit("data", Buffer.from(opts.stderr));
      }
      proc.emit("close", opts.exitCode ?? 0);
    }
  });

  return proc;
}

/**
 * Build an authenticated Express app for Phase 3b tests.
 * Pre-populates session.userId and session.email to simulate logged-in state.
 */
function buildAuthenticatedTestApp(opts?: {
  tokenStore?: ReturnType<typeof createMockTokenStore>;
  spawnMock?: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened for vi.fn() compat
  fetchMock?: (...args: any[]) => Promise<any>;
  userId?: string;
  email?: string;
}) {
  const app: Express = express();
  app.use(express.json());
  const tokenStore = opts?.tokenStore ?? createMockTokenStore();

  app.use((req, _res, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test session mock
    (req as any).session = {
      userId: opts?.userId ?? "test-user-id",
      email: opts?.email ?? "test@example.com",
    };
    next();
  });

  const router = createAuthRoutes({
    tokenStore,
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost:3000/auth/atlassian/callback",
    scopes: "read:jira-work write:jira-work offline_access",
    fetchFn: opts?.fetchMock,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.fn() is assignable at runtime
    spawnFn: opts?.spawnMock as any,
  });

  app.use("/auth/atlassian", router);

  return { app, tokenStore };
}

/**
 * Build an unauthenticated Express app for Phase 3b tests.
 */
function buildUnauthenticatedTestApp(opts?: {
  tokenStore?: ReturnType<typeof createMockTokenStore>;
  spawnMock?: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened for vi.fn() compat
  fetchMock?: (...args: any[]) => Promise<any>;
}) {
  const app: Express = express();
  app.use(express.json());
  const tokenStore = opts?.tokenStore ?? createMockTokenStore();

  app.use((req, _res, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test session mock (no userId)
    (req as any).session = {};
    next();
  });

  const router = createAuthRoutes({
    tokenStore,
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost:3000/auth/atlassian/callback",
    scopes: "read:jira-work write:jira-work offline_access",
    fetchFn: opts?.fetchMock,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.fn() is assignable at runtime
    spawnFn: opts?.spawnMock as any,
  });

  app.use("/auth/atlassian", router);

  return { app, tokenStore };
}

// ---------------------------------------------------------------------------
// T120: POST /auth/rovo-token
// ---------------------------------------------------------------------------
describe("POST /auth/atlassian/rovo-token (T120)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // (a) unauthenticated request (no session) -> 401 { error: "not_authenticated" }
  it("(a) unauthenticated -> 401 not_authenticated", async () => {
    const { app } = buildUnauthenticatedTestApp();

    const res = await request(app)
      .post("/auth/atlassian/rovo-token")
      .send({ atatToken: "some-token" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "not_authenticated" });
  });

  // (b) authenticated, valid ATAT token -> acli exits 0 -> 200 { connected: true }
  it("(b) authenticated, valid ATAT token, acli exits 0 -> 200 connected", async () => {
    // Use mockImplementation so the process (and its setImmediate) is created
    // when spawnFn() is actually called by the route handler, not at mock setup time.
    const spawnMock = vi
      .fn()
      .mockImplementation(() =>
        createMockSpawnProcess({ exitCode: 0, stdout: "Logged in successfully" }),
      );

    const { app } = buildAuthenticatedTestApp({ spawnMock });

    const res = await request(app)
      .post("/auth/atlassian/rovo-token")
      .send({ atatToken: "valid-atat-token" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ connected: true });
    // Verify acli was called
    expect(spawnMock).toHaveBeenCalledWith(
      "acli",
      expect.arrayContaining([
        "rovodev",
        "auth",
        "login",
        "--email",
        "test@example.com",
        "--token",
      ]),
      expect.any(Object),
    );
  });

  // (c) authenticated, acli exits non-zero -> 400 { error: "login_failed", detail: "<stderr>" }
  it("(c) authenticated, acli exits non-zero -> 400 login_failed with stderr detail", async () => {
    const spawnMock = vi
      .fn()
      .mockImplementation(() =>
        createMockSpawnProcess({ exitCode: 1, stderr: "Invalid token provided" }),
      );

    const { app } = buildAuthenticatedTestApp({ spawnMock });

    const res = await request(app)
      .post("/auth/atlassian/rovo-token")
      .send({ atatToken: "bad-token" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "login_failed" });
    expect(res.body.detail).toBeDefined();
    // MUST NOT log or return the ATAT token value
    expect(JSON.stringify(res.body)).not.toContain("bad-token");
  });

  // (d) authenticated, missing atatToken body field -> 400 { error: "missing_token" }
  it("(d) authenticated, missing atatToken -> 400 missing_token", async () => {
    const { app } = buildAuthenticatedTestApp();

    const res = await request(app).post("/auth/atlassian/rovo-token").send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "missing_token" });
  });

  // (e) authenticated, acli not on PATH (ENOENT) -> 503 { error: "acli_not_found" }
  it("(e) authenticated, acli ENOENT -> 503 acli_not_found", async () => {
    const spawnMock = vi.fn().mockImplementation(() => createMockSpawnProcess({ enoent: true }));

    const { app } = buildAuthenticatedTestApp({ spawnMock });

    const res = await request(app)
      .post("/auth/atlassian/rovo-token")
      .send({ atatToken: "some-token" });

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: "acli_not_found" });
  });
});

// ---------------------------------------------------------------------------
// T121: GET /auth/rovo-status
// ---------------------------------------------------------------------------
describe("GET /auth/atlassian/rovo-status (T121)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // (a) unauthenticated -> 401
  it("(a) unauthenticated -> 401", async () => {
    const { app } = buildUnauthenticatedTestApp();

    const res = await request(app).get("/auth/atlassian/rovo-status");

    expect(res.status).toBe(401);
  });

  // (b) authenticated, acli exits 0 with email in output -> 200 { connected: true, email }
  it("(b) authenticated, acli exits 0 with email -> 200 connected with email", async () => {
    const spawnMock = vi.fn().mockImplementation(() =>
      createMockSpawnProcess({
        exitCode: 0,
        stdout: "Logged in as user@example.com",
      }),
    );

    const { app } = buildAuthenticatedTestApp({ spawnMock });

    const res = await request(app).get("/auth/atlassian/rovo-status");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ connected: true, email: "user@example.com" });
  });

  // (c) authenticated, acli exits non-zero or "not logged in" -> 200 { connected: false }
  it("(c) authenticated, acli exits non-zero -> 200 not connected", async () => {
    const spawnMock = vi
      .fn()
      .mockImplementation(() => createMockSpawnProcess({ exitCode: 1, stderr: "not logged in" }));

    const { app } = buildAuthenticatedTestApp({ spawnMock });

    const res = await request(app).get("/auth/atlassian/rovo-status");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ connected: false });
  });

  it("(c) authenticated, acli output contains 'not logged in' -> 200 not connected", async () => {
    const spawnMock = vi
      .fn()
      .mockImplementation(() => createMockSpawnProcess({ exitCode: 0, stdout: "not logged in" }));

    const { app } = buildAuthenticatedTestApp({ spawnMock });

    const res = await request(app).get("/auth/atlassian/rovo-status");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ connected: false });
  });

  // (d) acli not on PATH -> 200 { connected: false, error: "acli_not_found" }
  it("(d) authenticated, acli ENOENT -> 200 not connected with acli_not_found error", async () => {
    const spawnMock = vi.fn().mockImplementation(() => createMockSpawnProcess({ enoent: true }));

    const { app } = buildAuthenticatedTestApp({ spawnMock });

    const res = await request(app).get("/auth/atlassian/rovo-status");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ connected: false, error: "acli_not_found" });
  });
});

// ---------------------------------------------------------------------------
// T122: GET /auth/atlassian-identity
// ---------------------------------------------------------------------------
describe("GET /auth/atlassian/atlassian-identity (T122)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const mockAccessibleResources = [
    { id: "site-id-1", name: "My Org", url: "https://myorg.atlassian.net" },
  ];

  function buildIdentityFetch(opts: {
    meResponse?: object;
    meStatus?: number;
    resourcesResponse?: object[];
    resourcesStatus?: number;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened for mock compat
    return vi.fn().mockImplementation(async (url: string): Promise<any> => {
      if (url.includes("/me")) {
        const meStatus = opts.meStatus ?? 200;
        return {
          ok: meStatus >= 200 && meStatus < 300,
          status: meStatus,
          json: async () =>
            opts.meResponse ?? {
              display_name: "Test User",
              email: "test@example.com",
              account_id: "test-account-id",
            },
          text: async () => JSON.stringify(opts.meResponse ?? {}),
        };
      }
      if (url.includes("accessible-resources")) {
        const resourcesStatus = opts.resourcesStatus ?? 200;
        return {
          ok: resourcesStatus >= 200 && resourcesStatus < 300,
          status: resourcesStatus,
          json: async () => opts.resourcesResponse ?? mockAccessibleResources,
          text: async () => JSON.stringify(opts.resourcesResponse ?? mockAccessibleResources),
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
  }

  // (a) unauthenticated -> 401
  it("(a) unauthenticated -> 401", async () => {
    const { app } = buildUnauthenticatedTestApp();

    const res = await request(app).get("/auth/atlassian/atlassian-identity");

    expect(res.status).toBe(401);
  });

  // (b) authenticated, valid JWT in tokenStore -> 200 { displayName, email, accountId, accessibleResources }
  it("(b) authenticated, valid JWT -> 200 with identity data", async () => {
    const validToken = {
      accessToken: "valid-access-token",
      refreshToken: "valid-refresh-token",
      expiresAt: Date.now() + 3600_000,
      site: "myorg.atlassian.net",
      email: "test@example.com",
      accountId: "test-account-id",
      scope: "read:me",
    };
    const tokenStore = createMockTokenStore();
    tokenStore.get.mockResolvedValue(validToken);

    const fetchMock = buildIdentityFetch({
      meResponse: {
        display_name: "Test User",
        email: "test@example.com",
        account_id: "test-account-id",
      },
      resourcesResponse: mockAccessibleResources,
    });

    const { app } = buildAuthenticatedTestApp({ tokenStore, fetchMock });

    const res = await request(app).get("/auth/atlassian/atlassian-identity");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      displayName: expect.any(String),
      email: expect.any(String),
      accountId: expect.any(String),
      accessibleResources: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String) }),
      ]),
    });
  });

  // (c) authenticated, tokenStore has near-expiry token -> refreshes, then makes REST calls
  it("(c) near-expiry token -> refreshes and returns identity data", async () => {
    // refreshOAuthToken requires ATLASSIAN_OAUTH_CLIENT_ID to be set.
    vi.stubEnv("ATLASSIAN_OAUTH_CLIENT_ID", "test-client-id");

    const nearExpiryToken = {
      accessToken: "near-expiry-token",
      refreshToken: "refresh-token-value",
      expiresAt: Date.now() + 30_000, // expires in 30s — within 60s buffer
      site: "myorg.atlassian.net",
      email: "test@example.com",
      accountId: "test-account-id",
      scope: "read:me",
    };
    const tokenStore = createMockTokenStore();
    tokenStore.get.mockResolvedValue(nearExpiryToken);

    // fetchMock must handle: token refresh + /me + accessible-resources
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened for mock compat
    const fetchMock = vi.fn().mockImplementation(async (url: string, _init?: any): Promise<any> => {
      // Token refresh call goes to auth.atlassian.com/oauth/token
      if (url.includes("auth.atlassian.com/oauth/token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "refreshed-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "read:me",
          }),
          text: async () => "{}",
        };
      }
      if (url.includes("/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            display_name: "Test User",
            email: "test@example.com",
            account_id: "test-account-id",
          }),
          text: async () => "{}",
        };
      }
      if (url.includes("accessible-resources")) {
        return {
          ok: true,
          status: 200,
          json: async () => mockAccessibleResources,
          text: async () => JSON.stringify(mockAccessibleResources),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { app } = buildAuthenticatedTestApp({ tokenStore, fetchMock });

    const res = await request(app).get("/auth/atlassian/atlassian-identity");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      displayName: expect.any(String),
      email: expect.any(String),
      accountId: expect.any(String),
    });
    // Token should have been refreshed
    expect(tokenStore.set).toHaveBeenCalled();
  });

  // (d) authenticated, token missing from tokenStore -> 401 { error: "not_authenticated" }
  it("(d) authenticated, token missing from tokenStore -> 401 not_authenticated", async () => {
    const tokenStore = createMockTokenStore();
    tokenStore.get.mockResolvedValue(null);

    const { app } = buildAuthenticatedTestApp({ tokenStore });

    const res = await request(app).get("/auth/atlassian/atlassian-identity");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "not_authenticated" });
  });

  // (e) authenticated, Atlassian REST API returns non-200 -> 502 { error: "upstream_error" }
  it("(e) authenticated, Atlassian API returns non-200 -> 502 upstream_error", async () => {
    const validToken = {
      accessToken: "valid-access-token",
      refreshToken: "valid-refresh-token",
      expiresAt: Date.now() + 3600_000,
      site: "myorg.atlassian.net",
      email: "test@example.com",
      accountId: "test-account-id",
      scope: "read:me",
    };
    const tokenStore = createMockTokenStore();
    tokenStore.get.mockResolvedValue(validToken);

    const fetchMock = buildIdentityFetch({ meStatus: 503 });

    const { app } = buildAuthenticatedTestApp({ tokenStore, fetchMock });

    const res = await request(app).get("/auth/atlassian/atlassian-identity");

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: "upstream_error" });
  });
});
