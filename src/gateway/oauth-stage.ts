/**
 * T052: Gateway request stage for Atlassian OAuth routes.
 *
 * Wraps the Express-based OAuth router into a gateway pipeline stage.
 * Handles: /, /login, /auth/atlassian, /auth/atlassian/callback, /auth/signout,
 *          /auth/atlassian/rovo-token, /auth/atlassian/rovo-status,
 *          /auth/atlassian/atlassian-identity,
 *          /connect-rovo (T128, retired — redirects to /integrations),
 *          /dashboard (T130), /integrations (T021)
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import cookieParser from "cookie-parser";
import express from "express";
import session from "express-session";
import type { TokenStore } from "../auth/token-store.js";
import { createTokenStore } from "../auth/token-store.js";
import { createAuthRoutes } from "../routes/auth-atlassian-routes.js";
import { renderIntegrationsPage } from "./integrations-page.js";
import { renderLoginPage } from "./login-page.js";

// Paths this stage handles (checked before delegating to Express).
// T021: /integrations added as post-login landing page; /connect-rovo retired (redirects to /integrations).
const OAUTH_PATHS = new Set([
  "/",
  "/login",
  "/auth/signout",
  "/dashboard",
  "/integrations",
  "/connect-rovo",
]);
const OAUTH_PREFIX = "/auth/atlassian";

/**
 * Creates a gateway stage handler for OAuth requests.
 * Returns an async function matching the `GatewayHttpRequestStage.run` shape.
 */
export async function createOAuthStageHandler(): Promise<{
  handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
  tokenStore: TokenStore | null;
}> {
  const clientId = process.env.ATLASSIAN_OAUTH_CLIENT_ID;
  if (!clientId) {
    // OAuth not configured — stage is a no-op.
    return { handleRequest: async () => false, tokenStore: null };
  }

  const tokenStore = await createTokenStore();
  const sessionSecret = process.env.SESSION_SECRET ?? "openclaw-dev-secret";
  const redirectUri =
    process.env.ATLASSIAN_OAUTH_REDIRECT_URI ?? "http://localhost:3000/auth/atlassian/callback";

  // Build a minimal Express app for OAuth-related routes only.
  const app = express();
  app.disable("x-powered-by");

  app.use(cookieParser());
  // JSON body parser — required for POST /auth/atlassian/rovo-token
  app.use(express.json());
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // NOTE: Do NOT use process.env.NODE_ENV here — Vite replaces it at build
        // time with "production", making cookies HTTPS-only even in dev/staging.
        // Use a dedicated runtime env var instead.
        secure: process.env.OPENCLAW_COOKIE_SECURE === "true",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // Root redirect — authenticated users go to dashboard, others to login.
  app.get("/", (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
    const dest = (req.session as any)?.userId ? "/dashboard" : "/login";
    res.redirect(dest);
  });

  // Login page.
  app.get("/login", (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
    if ((req.session as any)?.userId) {
      res.redirect("/dashboard");
      return;
    }
    const reason = req.query.reason as string | undefined;
    let message = "";
    if (reason === "session_expired") {
      message = "Your session has expired. Please sign in again.";
    } else if (reason === "access_denied") {
      message = "Sign-in was not completed. Please try again.";
    } else if (reason === "error") {
      message = "An error occurred. Please try again.";
    }
    res.status(200).send(renderLoginPage(message));
  });

  // OAuth routes.
  const authRouter = createAuthRoutes({
    tokenStore,
    clientId,
    clientSecret: process.env.ATLASSIAN_OAUTH_CLIENT_SECRET ?? "",
    redirectUri,
    scopes:
      "read:me read:jira-work write:jira-work read:confluence-content.all read:bitbucket-repo offline_access",
  });
  app.use("/auth/atlassian", authRouter);

  // -------------------------------------------------------------------------
  // GET /integrations — T021/T022: Post-login integrations page.
  // -------------------------------------------------------------------------
  app.get("/integrations", (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
    const session = req.session as any;
    if (!session?.userId) {
      res.redirect("/login");
      return;
    }
    res.status(200).send(renderIntegrationsPage());
  });

  // -------------------------------------------------------------------------
  // GET /connect-rovo — T128: RETIRED. Redirects to /integrations (T021).
  // -------------------------------------------------------------------------
  app.get("/connect-rovo", (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
    const session = req.session as any;
    if (!session?.userId) {
      res.redirect("/login");
      return;
    }
    // /connect-rovo is no longer the post-login destination. Redirect to /integrations.
    res.redirect("/integrations");
  });

  // -------------------------------------------------------------------------
  // GET /dashboard — T130: Two-tier connection status dashboard
  // -------------------------------------------------------------------------
  app.get("/dashboard", async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
    const session = req.session as any;
    if (!session?.userId) {
      res.redirect("/login");
      return;
    }

    const displayName: string = session.displayName ?? session.email ?? "Atlassian User";
    const rovoConnected: boolean = session.rovoConnected === true;
    const rovoEmail: string | undefined = session.email;

    // Tier 1 site count is fetched client-side via JS to avoid blocking the
    // page render with a synchronous upstream call.

    const rovoStatusHtml = rovoConnected
      ? `<span class="status-badge status-connected" aria-label="Rovo Dev connected">Connected</span>
         <span class="status-detail">${rovoEmail ?? ""}</span>`
      : `<span class="status-badge status-disconnected" aria-label="Rovo Dev not connected">Not connected</span>
         <a href="/connect-rovo" class="status-action">Connect Rovo Dev</a>`;

    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Atlas-Lobster</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #f4f5f7; color: #172b4d; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    .subtitle { color: #42526e; margin: 0 0 24px; font-size: 0.95rem; }
    .connection-panel { background: #fff; border: 1px solid #dfe1e6; border-radius: 8px; padding: 24px; max-width: 640px; margin-bottom: 24px; }
    .connection-panel h2 { font-size: 1.1rem; margin: 0 0 16px; }
    .tier-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f4f5f7; }
    .tier-row:last-child { border-bottom: none; }
    .tier-label { font-weight: 600; min-width: 120px; font-size: 0.95rem; }
    .status-badge { display: inline-block; border-radius: 4px; padding: 3px 10px; font-size: 0.8rem; font-weight: 700; }
    .status-connected { background: #e3fcef; color: #006644; border: 1px solid #57d9a3; }
    .status-disconnected { background: #fffae6; color: #974f0c; border: 1px solid #ffe380; }
    .status-detail { color: #42526e; font-size: 0.9rem; }
    .status-action { color: #0052cc; text-decoration: none; font-size: 0.9rem; }
    .status-action:hover { text-decoration: underline; }
    .tier-detail { color: #42526e; font-size: 0.85rem; }
    #t1-site-count { color: #42526e; font-size: 0.85rem; }
    .note-panel { background: #e8f0fe; border: 1px solid #b3cef6; border-radius: 8px; padding: 16px; max-width: 640px; font-size: 0.9rem; color: #172b4d; line-height: 1.5; }
    .note-panel strong { display: block; margin-bottom: 4px; }
    .actions { margin-top: 24px; display: flex; gap: 12px; align-items: center; }
    .btn-secondary { padding: 8px 16px; background: #fff; color: #0052cc; border: 2px solid #0052cc; border-radius: 4px; text-decoration: none; font-size: 0.9rem; }
    .btn-secondary:hover { background: #e8f0fe; }
    .btn-danger { padding: 8px 16px; background: #fff; color: #de350b; border: 2px solid #de350b; border-radius: 4px; text-decoration: none; font-size: 0.9rem; cursor: pointer; }
    .btn-danger:hover { background: #ffebe6; }
  </style>
</head>
<body>
  <h1>Atlas-Lobster Dashboard</h1>
  <p class="subtitle">Welcome, <strong>${displayName}</strong></p>

  <div class="connection-panel">
    <h2>Connection Status</h2>
    <div class="tier-row">
      <span class="tier-label">Tier 1 — Atlassian</span>
      <span class="status-badge status-connected" aria-label="Atlassian connected">Connected</span>
      <span class="tier-detail" id="t1-site-count">Loading site info...</span>
    </div>
    <div class="tier-row">
      <span class="tier-label">Tier 2 — Rovo Dev</span>
      ${rovoStatusHtml}
    </div>
  </div>

  <div class="note-panel">
    <strong>How it works</strong>
    The main agent is OpenClaw (Claude). Rovo Dev is an opt-in specialist for Atlassian-heavy tasks
    — it uses your Jira and Confluence context to give more relevant answers.
    Tier 1 gives you basic Atlassian authentication. Tier 2 (Rovo Dev) unlocks full Jira/Confluence
    awareness in chat.
  </div>

  <div class="actions">
    ${
      rovoConnected
        ? `<a href="/connect-rovo" class="btn-secondary">Manage Rovo Dev connection</a>`
        : `<a href="/connect-rovo" class="btn-secondary">Connect Rovo Dev</a>`
    }
    <form method="POST" action="/auth/atlassian/signout" style="margin:0">
      <button type="submit" class="btn-danger">Sign out</button>
    </form>
  </div>

  <script>
    // Fetch Atlassian identity to show site count for Tier 1.
    async function loadSiteCount() {
      const el = document.getElementById('t1-site-count');
      try {
        const res = await fetch('/auth/atlassian/atlassian-identity');
        if (!res.ok) { el.textContent = ''; return; }
        const data = await res.json();
        const count = Array.isArray(data.accessibleResources) ? data.accessibleResources.length : 0;
        el.textContent = data.displayName
          ? data.displayName + (count > 0 ? ' \u2014 ' + count + ' site' + (count === 1 ? '' : 's') : '')
          : (count > 0 ? count + ' site' + (count === 1 ? '' : 's') + ' accessible' : '');
      } catch (_err) {
        el.textContent = '';
      }
    }
    loadSiteCount();
  </script>
</body>
</html>`);
  });

  // Sign out (top-level path for convenience).
  app.post("/auth/signout", (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
    const userId = (req.session as any)?.userId;
    if (userId) {
      void tokenStore.delete(userId);
    }
    req.session?.destroy?.(() => {});
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });

  // Stage handler: returns true if the request was handled by OAuth routes.
  const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;

    if (OAUTH_PATHS.has(path) || path.startsWith(OAUTH_PREFIX)) {
      return new Promise((resolve) => {
        // Let Express handle the request. When Express finishes (sends response),
        // we resolve true. If Express doesn't match, the 404 handler resolves true
        // anyway since we already know the path is ours.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bridging Node http to Express
        app(req as any, res as any, () => {
          // If Express calls next() without handling, it's not our route.
          resolve(false);
        });
        // Express will send a response; resolve true once it's done.
        res.on("finish", () => resolve(true));
      });
    }

    return false;
  };

  return { handleRequest, tokenStore };
}
