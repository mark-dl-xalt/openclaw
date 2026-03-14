/**
 * T052: Gateway request stage for Atlassian OAuth routes.
 *
 * Wraps the Express-based OAuth router into a gateway pipeline stage.
 * Handles: /login, /auth/atlassian, /auth/atlassian/callback, /auth/signout
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import cookieParser from "cookie-parser";
import express from "express";
import session from "express-session";
import type { TokenStore } from "../auth/token-store.js";
import { createTokenStore } from "../auth/token-store.js";
import { createAuthRoutes } from "../routes/auth-atlassian-routes.js";

// Paths this stage handles (checked before delegating to Express).
const OAUTH_PATHS = new Set(["/login", "/auth/signout"]);
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
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

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
      message = "<p>Your session has expired. Please sign in again.</p>";
    } else if (reason === "access_denied") {
      message = "<p>Sign-in was not completed. Please try again.</p>";
    } else if (reason === "error") {
      message = "<p>An error occurred. Please try again.</p>";
    }
    res.status(200).send(`<!DOCTYPE html>
<html><head><title>Sign In — Atlas-Lobster</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="text-align:center;max-width:400px">
    <h1>Atlas-Lobster</h1>
    ${message}
    <a href="/auth/atlassian" style="display:inline-block;padding:12px 24px;background:#0052CC;color:#fff;border-radius:4px;text-decoration:none;font-size:16px">
      Sign in with Atlassian
    </a>
  </div>
</body></html>`);
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
