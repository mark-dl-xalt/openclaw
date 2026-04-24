/**
 * T045: Token store interface and types for OAuth token persistence.
 *
 * POC NOTE: Single shared OAuth token — admin logs in on web, token used
 * for all Rovo Dev calls. The userId key is kept for API consistency but
 * in practice there will be one "default" user.
 */

/** Stored OAuth token (encrypted at rest). */
export interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms since epoch
  site: string; // e.g., "mdev2-xalt.atlassian.net"
  email: string; // Atlassian user email
  accountId: string; // Atlassian account ID
  scope: string; // granted scopes
}

/** Abstract token store — implementations handle encryption/storage. */
export interface TokenStore {
  get(userId: string): Promise<OAuthToken | null>;
  set(userId: string, token: OAuthToken): Promise<void>;
  delete(userId: string): Promise<void>;
}

/** Factory: returns FileTokenStore (AES-256-GCM). Keytar deferred to post-POC. */
export async function createTokenStore(): Promise<TokenStore> {
  const { FileTokenStore } = await import("./token-store-file.js");
  return new FileTokenStore();
}
