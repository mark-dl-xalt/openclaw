/**
 * Atlassian REST API tool — makes authenticated requests to Atlassian APIs
 * using the stored OAuth 2.1 token from the login flow.
 *
 * The tool resolves the OAuth credential (with auto-refresh) and adds the
 * Authorization header automatically. The agent specifies the site, HTTP
 * method, and REST path; the tool returns the JSON response.
 */

import { Type } from "@sinclair/typebox";
import type { TokenStore } from "../../auth/token-store.js";
import { createTokenStore } from "../../auth/token-store.js";
import { resolveRovoDevCredentialV2 } from "../rovo-dev-auth.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam, ToolInputError } from "./common.js";

const AtlassianApiSchema = Type.Object({
  site: Type.String({
    description:
      'Atlassian site hostname, e.g. "mysite.atlassian.net". Do NOT include the protocol.',
  }),
  path: Type.String({
    description:
      'REST API path starting with /. Examples: "/rest/api/3/myself", "/rest/api/3/search?jql=project=FOO", "/wiki/api/v2/spaces".',
  }),
  method: Type.Optional(
    Type.String({
      description: 'HTTP method. Defaults to "GET".',
      default: "GET",
    }),
  ),
  body: Type.Optional(
    Type.String({
      description: "JSON request body (for POST/PUT). Must be a valid JSON string.",
    }),
  ),
});

// Lazy singleton — created on first use, shared across calls.
let tokenStorePromise: Promise<TokenStore> | null = null;
function getTokenStore(): Promise<TokenStore> {
  if (!tokenStorePromise) {
    tokenStorePromise = createTokenStore();
  }
  return tokenStorePromise;
}

export function createAtlassianApiTool(): AnyAgentTool {
  return {
    label: "Atlassian API",
    name: "atlassian_api",
    description: [
      "Make authenticated requests to Atlassian REST APIs (Jira, Confluence, Bitbucket).",
      "Uses the OAuth 2.1 token obtained when the user signed in via /login.",
      "The token is added automatically — do not include Authorization headers.",
      "",
      "Common endpoints:",
      '  GET /rest/api/3/myself — current user info (site: "<site>.atlassian.net")',
      "  GET /rest/api/3/search?jql=... — search Jira issues",
      "  GET /rest/api/3/issue/KEY-123 — get a Jira issue",
      "  GET /wiki/api/v2/spaces — list Confluence spaces",
      "  GET /rest/api/3/project — list Jira projects",
    ].join("\n"),
    parameters: AtlassianApiSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const site = readStringParam(params, "site", { required: true });
      const path = readStringParam(params, "path", { required: true });
      const method = (readStringParam(params, "method") ?? "GET").toUpperCase();
      const body = readStringParam(params, "body");

      if (!path.startsWith("/")) {
        throw new ToolInputError('path must start with "/"');
      }

      // Resolve OAuth credential (auto-refreshes if near expiry).
      const tokenStore = await getTokenStore();
      const result = await resolveRovoDevCredentialV2({
        tokenStore,
        userId: "default",
      });

      if (result.credential === null) {
        return jsonResult({
          error: "not_authenticated",
          detail:
            result.reason === "REFRESH_FAILED"
              ? "OAuth token expired and refresh failed. Please sign in again at /login."
              : "No Atlassian OAuth token found. Please sign in at /login first.",
        });
      }

      const url = `https://${site}${path}`;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${result.credential.accessToken}`,
        Accept: "application/json",
      };
      if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
        headers["Content-Type"] = "application/json";
      }

      const fetchOptions: RequestInit = { method, headers };
      if (body && method !== "GET" && method !== "HEAD") {
        fetchOptions.body = body;
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "(no body)");
        return jsonResult({
          error: "api_error",
          status: response.status,
          statusText: response.statusText,
          body: errorBody.slice(0, 2000),
        });
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        return jsonResult(data);
      }

      // Non-JSON response — return as text.
      const text = await response.text();
      return jsonResult({ contentType, text: text.slice(0, 10000) });
    },
  };
}
