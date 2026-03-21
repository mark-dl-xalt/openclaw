/**
 * Atlassian REST API tool — makes authenticated requests to Atlassian APIs
 * using the stored OAuth 2.1 token from the login flow.
 *
 * OAuth tokens authenticate against the Atlassian cloud gateway
 * (api.atlassian.com/ex/{product}/{cloudId}/...), NOT direct site URLs.
 * This tool resolves the cloud ID automatically from the site hostname.
 */

import { Type } from "@sinclair/typebox";
import type { TokenStore } from "../../auth/token-store.js";
import { createTokenStore } from "../../auth/token-store.js";
import { resolveRovoDevCredentialV2 } from "../rovo-dev-auth.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam, ToolInputError } from "./common.js";

const ATLASSIAN_API_BASE = "https://api.atlassian.com";

const AtlassianApiSchema = Type.Object({
  site: Type.Optional(
    Type.String({
      description:
        'Atlassian site hostname, e.g. "mysite.atlassian.net". Do NOT include the protocol. Omit to discover accessible sites.',
    }),
  ),
  path: Type.Optional(
    Type.String({
      description:
        'REST API path starting with /. Examples: "/rest/api/3/myself", "/rest/api/3/search?jql=project=FOO", "/wiki/api/v2/spaces". Omit together with site to discover accessible sites.',
    }),
  ),
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

// Cache cloud ID lookups: site hostname → cloudId.
const cloudIdCache = new Map<string, string>();

/**
 * Resolve the Atlassian cloud ID for a site hostname by calling
 * the accessible-resources endpoint. Caches results in-memory.
 */
interface AccessibleResource {
  id: string;
  url: string;
  name: string;
  scopes?: string[];
  avatarUrl?: string;
}

/**
 * Fetch accessible resources from Atlassian. Returns the raw array
 * and populates the cloudIdCache as a side effect.
 */
async function fetchAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
  const res = await fetch(`${ATLASSIAN_API_BASE}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    return [];
  }

  const resources = (await res.json()) as AccessibleResource[];
  for (const r of resources) {
    try {
      const hostname = new URL(r.url).hostname;
      cloudIdCache.set(hostname, r.id);
    } catch {
      // Skip malformed URLs.
    }
  }
  return resources;
}

async function resolveCloudId(site: string, accessToken: string): Promise<string | null> {
  const cached = cloudIdCache.get(site);
  if (cached) {
    return cached;
  }

  await fetchAccessibleResources(accessToken);
  return cloudIdCache.get(site) ?? null;
}

/**
 * Determine the Atlassian product gateway prefix from the request path.
 * /wiki/... → confluence, everything else → jira.
 */
function resolveProductPrefix(path: string): string {
  if (path.startsWith("/wiki/") || path.startsWith("/wiki?")) {
    return "confluence";
  }
  return "jira";
}

export function createAtlassianApiTool(): AnyAgentTool {
  return {
    label: "Atlassian API",
    name: "atlassian_api",
    description: [
      "Make authenticated requests to Atlassian REST APIs (Jira, Confluence, Bitbucket).",
      "Uses the OAuth 2.1 token obtained when the user signed in via /login.",
      "The token is added automatically — do not include Authorization headers.",
      "The tool automatically routes through the Atlassian cloud gateway.",
      "",
      "IMPORTANT: Call with no arguments first to discover which sites are accessible.",
      "This returns the list of Atlassian sites the user has granted access to.",
      "Then use a specific site hostname from that list for subsequent API calls.",
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
      const site = readStringParam(params, "site");
      const path = readStringParam(params, "path");
      const method = (readStringParam(params, "method") ?? "GET").toUpperCase();
      const body = readStringParam(params, "body");

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

      const accessToken = result.credential.accessToken;

      // Discovery mode: no site/path → return accessible sites.
      if (!site || !path) {
        const resources = await fetchAccessibleResources(accessToken);
        // Deduplicate by site hostname (API returns one entry per product/scope).
        const seen = new Map<
          string,
          { name: string; url: string; cloudId: string; products: string[] }
        >();
        for (const r of resources) {
          try {
            const hostname = new URL(r.url).hostname;
            const existing = seen.get(hostname);
            if (existing) {
              // Merge scopes into products list.
              if (r.scopes) {
                for (const s of r.scopes) {
                  const product = s.includes("jira")
                    ? "jira"
                    : s.includes("confluence")
                      ? "confluence"
                      : s;
                  if (!existing.products.includes(product)) {
                    existing.products.push(product);
                  }
                }
              }
            } else {
              const products: string[] = [];
              if (r.scopes) {
                for (const s of r.scopes) {
                  const product = s.includes("jira")
                    ? "jira"
                    : s.includes("confluence")
                      ? "confluence"
                      : s;
                  if (!products.includes(product)) {
                    products.push(product);
                  }
                }
              }
              seen.set(hostname, { name: r.name, url: r.url, cloudId: r.id, products });
            }
          } catch {
            // Skip malformed URLs.
          }
        }
        return jsonResult({
          mode: "discovery",
          sites: Array.from(seen.entries()).map(([hostname, info]) => ({
            hostname,
            name: info.name,
            url: info.url,
            cloudId: info.cloudId,
            products: info.products,
          })),
        });
      }

      if (!path.startsWith("/")) {
        throw new ToolInputError('path must start with "/"');
      }

      // Resolve cloud ID for the site — OAuth tokens require routing through
      // api.atlassian.com/ex/{product}/{cloudId}/... instead of direct site URLs.
      const cloudId = await resolveCloudId(site, accessToken);
      if (!cloudId) {
        return jsonResult({
          error: "site_not_found",
          detail: `Could not resolve cloud ID for "${site}". Check the site hostname and ensure your OAuth token has access to it. Call this tool with no arguments to discover accessible sites.`,
        });
      }

      const product = resolveProductPrefix(path);
      const url = `${ATLASSIAN_API_BASE}/ex/${product}/${cloudId}${path}`;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
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
