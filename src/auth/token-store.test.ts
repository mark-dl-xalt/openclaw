import { randomBytes } from "node:crypto";
/**
 * T039: Tests for TokenStore — AES-256-GCM encrypted file-based token storage.
 *
 * Covers: FileTokenStore set/get/delete, encryption verification, OAuthToken shape.
 */
import { readFile } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileTokenStore } from "./token-store-file.js";
import type { OAuthToken, TokenStore } from "./token-store.js";
import { createTokenStore } from "./token-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 64-char hex string = 32 bytes = valid AES-256 key. */
const TEST_ENCRYPTION_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

function makeTempDir(): string {
  return join(tmpdir(), `openclaw-token-test-${randomBytes(8).toString("hex")}`);
}

function createSampleToken(overrides?: Partial<OAuthToken>): OAuthToken {
  return {
    accessToken: "xoxb-sample-access-token",
    refreshToken: "xoxb-sample-refresh-token",
    expiresAt: Date.now() + 3_600_000,
    site: "mdev2-xalt.atlassian.net",
    email: "test@example.com",
    accountId: "mock-account-id-001",
    scope: "read:jira-work write:jira-work offline_access",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T039(a–d): FileTokenStore
// ---------------------------------------------------------------------------
describe("FileTokenStore (T039)", () => {
  let tempDir: string;

  afterEach(async () => {
    vi.unstubAllEnvs();
    // Clean up temp files
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore if already gone
    }
  });

  it("(a) set then get — decrypted token matches original", async () => {
    vi.stubEnv("OPENCLAW_TOKEN_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
    tempDir = makeTempDir();
    const store: TokenStore = new FileTokenStore(tempDir);
    const original = createSampleToken();

    await store.set("user-1", original);
    const retrieved = await store.get("user-1");

    expect(retrieved).not.toBeNull();
    expect(retrieved).toEqual(original);
  });

  it("(b) raw stored file is NOT plaintext — encryption verified", async () => {
    vi.stubEnv("OPENCLAW_TOKEN_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
    tempDir = makeTempDir();
    const store: TokenStore = new FileTokenStore(tempDir);
    const original = createSampleToken();

    await store.set("user-enc-check", original);

    // Read the raw file directly
    const filePath = join(tempDir, "user-enc-check.enc");
    const rawBytes = await readFile(filePath);
    const rawString = rawBytes.toString("utf8");

    // The raw content must NOT contain the plaintext access token
    expect(rawString).not.toContain(original.accessToken);
    // And it must NOT be valid JSON
    expect(() => JSON.parse(rawString)).toThrow();
  });

  it("(c) delete then get — returns null", async () => {
    vi.stubEnv("OPENCLAW_TOKEN_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
    tempDir = makeTempDir();
    const store: TokenStore = new FileTokenStore(tempDir);
    const token = createSampleToken();

    await store.set("user-del", token);
    // Sanity check: token exists
    const before = await store.get("user-del");
    expect(before).not.toBeNull();

    await store.delete("user-del");
    const after = await store.get("user-del");

    expect(after).toBeNull();
  });

  it("(d) get for non-existent userId — returns null (no throw)", async () => {
    vi.stubEnv("OPENCLAW_TOKEN_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
    tempDir = makeTempDir();
    const store: TokenStore = new FileTokenStore(tempDir);

    const result = await store.get("does-not-exist");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// OAuthToken shape
// ---------------------------------------------------------------------------
describe("OAuthToken interface shape (T039)", () => {
  it("includes all required fields: accessToken, refreshToken, expiresAt, site, email, scope", () => {
    const token: OAuthToken = createSampleToken();

    // Verify each field exists and has the expected type
    expect(typeof token.accessToken).toBe("string");
    expect(typeof token.refreshToken).toBe("string");
    expect(typeof token.expiresAt).toBe("number");
    expect(typeof token.site).toBe("string");
    expect(typeof token.email).toBe("string");
    expect(typeof token.scope).toBe("string");
  });

  it("expiresAt is a millisecond timestamp (not seconds)", () => {
    const token: OAuthToken = createSampleToken({
      expiresAt: Date.now() + 3_600_000,
    });

    // A ms timestamp for a date after 2020 is > 1_577_836_800_000
    expect(token.expiresAt).toBeGreaterThan(1_577_836_800_000);
  });
});

// ---------------------------------------------------------------------------
// createTokenStore factory
// ---------------------------------------------------------------------------
describe("createTokenStore factory (T039)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a TokenStore implementation", async () => {
    vi.stubEnv("OPENCLAW_TOKEN_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);

    const store = await createTokenStore();

    expect(store).toBeDefined();
    expect(typeof store.get).toBe("function");
    expect(typeof store.set).toBe("function");
    expect(typeof store.delete).toBe("function");
  });
});
