/**
 * T050: Express router factory for Atlassian OAuth 2.1 PKCE login flow.
 *
 * Routes:
 *   GET  /           — Initiate OAuth (PKCE + redirect to Atlassian)
 *   GET  /callback   — OAuth callback (exchange code, create session)
 *   POST /signout    — Sign out (delete token, destroy session)
 *
 * All configuration (clientId, redirectUri, scopes) is injected via opts
 * so the router is testable without environment variables.
 */

import { randomBytes } from "node:crypto";
import express from "express";
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
}): express.Router {
  const { tokenStore, clientId, clientSecret, redirectUri, scopes } = opts;
  const fetchFn = opts.fetchFn ?? globalThis.fetch;

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
      // Only include client_secret for confidential clients (non-PKCE).
      if (clientSecret) {
        tokenPayload.client_secret = clientSecret;
      }
      const tokenResponse = await fetchFn(`${ATLASSIAN_AUTH_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenPayload),
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

      // Store token.
      await tokenStore.set(userIdentity.account_id, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        site: "", // Resolved elsewhere (accessible-resources endpoint)
        email: userIdentity.email,
        accountId: userIdentity.account_id,
        scope: tokenData.scope,
      });

      // Create session.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
      const session = (req as any).session;
      if (session) {
        session.userId = userIdentity.account_id;
      }

      res.redirect("/dashboard");
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

  return router;
}
