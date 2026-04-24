/**
 * T050: Express router factory for Atlassian OAuth 2.1 PKCE login flow.
 *
 * Routes:
 *   GET  /                   — Initiate OAuth (PKCE + redirect to Atlassian)
 *   GET  /callback           — OAuth callback (exchange code, create session)
 *   POST /signout            — Sign out (delete token, destroy session)
 *   POST /rovo-token         — T123: Store ATAT token via acli rovodev auth login
 *   GET  /rovo-status        — T124: Check acli rovodev auth status
 *   GET  /atlassian-identity — T125: Fetch Atlassian user identity via REST API
 *
 * All configuration (clientId, redirectUri, scopes) is injected via opts
 * so the router is testable without environment variables.
 */

import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import express from "express";
import { resolveRovoDevCredentialV2 } from "../agents/rovo-dev-auth.js";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  storeFlowState,
  getAndDeleteFlowState,
  fetchAtlassianUserIdentity,
} from "../auth/oauth-atlassian.js";
import type { TokenStore } from "../auth/token-store.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ATLASSIAN_AUTH_BASE = "https://auth.atlassian.com";
const ATLASSIAN_API_BASE = "https://api.atlassian.com";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Spawn function type — accepts vi.fn() mocks in tests by using a loose signature. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened for test mock compat
type SpawnFn = (command: string, args: string[], options: any) => any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract email from acli status output.
 * Looks for an email pattern anywhere in the output string.
 */
function extractEmailFromStatusOutput(output: string): string | null {
  // Match standard email format
  const match = output.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/u);
  return match ? match[0] : null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAuthRoutes(opts: {
  tokenStore: TokenStore;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened for test mock compat
  fetchFn?: (...args: any[]) => Promise<any>;
  /** Injected for testing — defaults to node:child_process.spawn */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened for test mock compat (vi.fn())
  spawnFn?: (...args: any[]) => any;
}): express.Router {
  const { tokenStore, clientId, clientSecret, redirectUri, scopes } = opts;
  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SpawnFn loosened for test mock compat
  const spawnFn: SpawnFn = (opts.spawnFn as any) ?? spawn;

  const router = express.Router();

  // -------------------------------------------------------------------------
  // GET / — Initiate OAuth flow
  // -------------------------------------------------------------------------
  router.get("/", (_req, res) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = randomBytes(16).toString("hex");

    storeFlowState({ state, codeVerifier, createdAt: Date.now() });

    const params = new URLSearchParams({
      audience: "api.atlassian.com",
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    res.redirect(`${ATLASSIAN_AUTH_BASE}/authorize?${params.toString()}`);
  });

  // -------------------------------------------------------------------------
  // GET /callback — OAuth callback
  // -------------------------------------------------------------------------
  router.get("/callback", async (req, res) => {
    try {
      // Handle Atlassian error responses.
      const error = req.query.error as string | undefined;
      if (error === "access_denied") {
        res.redirect("/login?reason=access_denied");
        return;
      }
      if (error) {
        res.redirect("/login?reason=error");
        return;
      }

      // Validate state and retrieve flow data.
      const stateParam = req.query.state as string | undefined;
      if (!stateParam) {
        res.redirect("/login?reason=error");
        return;
      }

      const flowState = getAndDeleteFlowState(stateParam);
      if (!flowState) {
        res.redirect("/login?reason=error");
        return;
      }

      // Exchange code for token.
      const code = req.query.code as string;
      const tokenPayload: Record<string, string> = {
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: flowState.codeVerifier,
      };
      if (clientSecret) {
        tokenPayload.client_secret = clientSecret;
      }
      const tokenResponse = await fetchFn(`${ATLASSIAN_AUTH_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(tokenPayload).toString(),
      });

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text().catch(() => "(no body)");
        console.error("[oauth-callback] token exchange failed:", tokenResponse.status, errBody);
        res.redirect("/login?reason=error");
        return;
      }

      const tokenData = await tokenResponse.json();

      // Fetch user identity.
      const userIdentity = await fetchAtlassianUserIdentity(tokenData.access_token, fetchFn);

      // Store token under account ID and "default" (POC: CLI runner uses "default"
      // because WebSocket requests don't carry HTTP session context).
      const oauthToken = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        site: "", // Resolved elsewhere (accessible-resources endpoint)
        email: userIdentity.email,
        accountId: userIdentity.account_id,
        scope: tokenData.scope,
      };
      await tokenStore.set(userIdentity.account_id, oauthToken);
      await tokenStore.set("default", oauthToken);

      // Create session — must save explicitly before redirect so the session
      // cookie is set before the browser follows the 302.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
      const session = (req as any).session;
      if (session) {
        session.userId = userIdentity.account_id;
        session.email = userIdentity.email;
        session.displayName = userIdentity.name;
      }

      // T021: All users (new and returning) land on /integrations after OAuth.
      // The integrations page handles both states dynamically via GET /auth/atlassian/rovo-status.
      const redirectTarget = "/integrations";

      if (session?.save) {
        session.save((err: Error | null) => {
          if (err) {
            console.error("[oauth-callback] session save error:", err);
          }
          res.redirect(redirectTarget);
        });
      } else {
        res.redirect(redirectTarget);
      }
    } catch (err) {
      console.error("[oauth-callback] error:", err);
      res.redirect("/login?reason=error");
    }
  });

  // -------------------------------------------------------------------------
  // POST /signout — Sign out
  // -------------------------------------------------------------------------
  router.post("/signout", async (req, res) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
      const session = (req as any).session;
      const userId: string | undefined = session?.userId;

      // Always attempt token deletion (best-effort).
      await tokenStore.delete(userId ?? "");

      // Destroy session data.
      if (session) {
        // express-session .destroy() callback pattern
        if (typeof session.destroy === "function") {
          session.destroy(() => {
            res.clearCookie("connect.sid");
            res.redirect("/login");
          });
          return;
        }
        // Fallback: plain object session (test environment)
        delete session.userId;
      }

      res.clearCookie("connect.sid");
      res.redirect("/login");
    } catch {
      // Best-effort: still redirect even if token deletion fails.
      res.clearCookie("connect.sid");
      res.redirect("/login");
    }
  });

  // -------------------------------------------------------------------------
  // POST /rovo-token — T123: Store ATAT token via acli rovodev auth login
  // -------------------------------------------------------------------------
  router.post("/rovo-token", async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
    const session = (req as any).session;
    const userId: string | undefined = session?.userId;
    const email: string | undefined = session?.email;

    if (!userId) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const atatToken: string | undefined = req.body?.atatToken;
    if (!atatToken) {
      res.status(400).json({ error: "missing_token" });
      return;
    }

    await new Promise<void>((resolve) => {
      let stderr = "";
      let proc: ChildProcess;

      try {
        proc = spawnFn("acli", ["rovodev", "auth", "login", "--email", email ?? "", "--token"], {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === "ENOENT") {
          res.status(503).json({ error: "acli_not_found" });
          resolve();
          return;
        }
        res.status(500).json({ error: "spawn_failed" });
        resolve();
        return;
      }

      // Write token to stdin (MUST NOT log the token value).
      proc.stdin?.write(`${atatToken}\n`);
      proc.stdin?.end();

      // Collect stderr for error details (MUST NOT include the token).
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      // Timeout: 15 seconds.
      const timeout = setTimeout(() => {
        proc.kill("SIGTERM");
        res.status(504).json({ error: "timeout" });
        resolve();
      }, 15_000);

      proc.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timeout);
        if (err.code === "ENOENT") {
          res.status(503).json({ error: "acli_not_found" });
        } else {
          res.status(500).json({ error: "spawn_failed" });
        }
        resolve();
      });

      proc.on("close", (code: number | null) => {
        clearTimeout(timeout);
        if (code === 0) {
          // T127: set rovoConnected in session for fast-path status checks.
          if (session) {
            session.rovoConnected = true;
          }
          res.status(200).json({ connected: true });
        } else {
          // Return stderr as detail — MUST NOT include the ATAT token value.
          res.status(400).json({ error: "login_failed", detail: stderr });
        }
        resolve();
      });
    });
  });

  // -------------------------------------------------------------------------
  // GET /rovo-status — T124: Check acli rovodev auth status
  // -------------------------------------------------------------------------
  router.get("/rovo-status", async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
    const session = (req as any).session;
    const userId: string | undefined = session?.userId;

    if (!userId) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    // T127: fast-path — if session says connected, skip subprocess.
    if (session?.rovoConnected === true) {
      // Still report as connected; include email from session if available.
      const sessionEmail: string | undefined = session.email;
      res.status(200).json({ connected: true, ...(sessionEmail ? { email: sessionEmail } : {}) });
      return;
    }

    await new Promise<void>((resolve) => {
      let stdout = "";
      let proc: ChildProcess;

      try {
        proc = spawnFn("acli", ["rovodev", "auth", "status"], {
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === "ENOENT") {
          res.status(200).json({ connected: false, error: "acli_not_found" });
          resolve();
          return;
        }
        res.status(200).json({ connected: false });
        resolve();
        return;
      }

      proc.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      // Timeout: 10 seconds.
      const timeout = setTimeout(() => {
        proc.kill("SIGTERM");
        res.status(200).json({ connected: false });
        resolve();
      }, 10_000);

      proc.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timeout);
        if (err.code === "ENOENT") {
          res.status(200).json({ connected: false, error: "acli_not_found" });
        } else {
          res.status(200).json({ connected: false });
        }
        resolve();
      });

      proc.on("close", (code: number | null) => {
        clearTimeout(timeout);
        const outputLower = stdout.toLowerCase();

        // "not logged in" / "not authenticated" → not connected.
        if (outputLower.includes("not logged in") || outputLower.includes("not authenticated")) {
          res.status(200).json({ connected: false });
          resolve();
          return;
        }

        if (code === 0) {
          const email = extractEmailFromStatusOutput(stdout);
          if (email) {
            // T127: persist email in session for future fast-path calls.
            if (session) {
              session.email = email;
              session.rovoConnected = true;
            }
            res.status(200).json({ connected: true, email });
          } else {
            res.status(200).json({ connected: true });
          }
        } else {
          res.status(200).json({ connected: false });
        }
        resolve();
      });
    });
  });

  // -------------------------------------------------------------------------
  // GET /atlassian-identity — T125: Fetch Atlassian user identity via REST API
  // -------------------------------------------------------------------------
  router.get("/atlassian-identity", async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
    const session = (req as any).session;
    const userId: string | undefined = session?.userId;

    if (!userId) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    try {
      // Resolve credential (handles near-expiry refresh via resolveRovoDevCredentialV2).
      // Pass fetchFn so token refresh uses the same injected fetch (enables testing).
      const result = await resolveRovoDevCredentialV2({ tokenStore, userId, fetchFn });

      if (result.credential === null) {
        res.status(401).json({ error: "not_authenticated" });
        return;
      }

      const accessToken = result.credential.accessToken;

      // Fetch user identity from /me.
      const meResponse = await fetchFn(`${ATLASSIAN_API_BASE}/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!meResponse.ok) {
        console.error("[atlassian-identity] /me failed:", meResponse.status);
        res.status(502).json({ error: "upstream_error" });
        return;
      }

      const meData = await meResponse.json();

      // Fetch accessible resources (sites).
      const resourcesResponse = await fetchFn(
        `${ATLASSIAN_API_BASE}/oauth/token/accessible-resources`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!resourcesResponse.ok) {
        console.error(
          "[atlassian-identity] accessible-resources failed:",
          resourcesResponse.status,
        );
        res.status(502).json({ error: "upstream_error" });
        return;
      }

      const resourcesData = await resourcesResponse.json();

      // Normalise: Atlassian uses snake_case in some versions, camelCase in others.
      const displayName: string = meData.display_name ?? meData.displayName ?? meData.name ?? "";
      const email: string = meData.email ?? "";
      const accountId: string = meData.account_id ?? meData.accountId ?? "";

      // Map accessible resources to a consistent shape.
      const accessibleResources = (Array.isArray(resourcesData) ? resourcesData : []).map(
        (r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
          url: r.url as string,
        }),
      );

      res.status(200).json({ displayName, email, accountId, accessibleResources });
    } catch (err) {
      console.error("[atlassian-identity] error:", err);
      res.status(502).json({ error: "upstream_error" });
    }
  });

  return router;
}
