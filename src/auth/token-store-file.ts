/**
 * T047: File-based token store with AES-256-GCM encryption.
 * Tokens stored at ~/.openclaw/tokens/{userId}.enc
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OAuthToken, TokenStore } from "./token-store.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class FileTokenStore implements TokenStore {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(homedir(), ".openclaw", "tokens");
  }

  async get(userId: string): Promise<OAuthToken | null> {
    const filePath = this.filePath(userId);
    let raw: Buffer;
    try {
      raw = await readFile(filePath);
    } catch {
      return null; // File doesn't exist
    }
    try {
      const decrypted = this.decrypt(raw);
      return JSON.parse(decrypted) as OAuthToken;
    } catch {
      return null; // Corrupt or wrong key
    }
  }

  async set(userId: string, token: OAuthToken): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    const json = JSON.stringify(token);
    const encrypted = this.encrypt(json);
    await writeFile(this.filePath(userId), encrypted, { mode: 0o600 });
  }

  async delete(userId: string): Promise<void> {
    try {
      await rm(this.filePath(userId));
    } catch {
      // Already gone
    }
  }

  private filePath(userId: string): string {
    // Sanitize userId to prevent path traversal
    const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.baseDir, `${safe}.enc`);
  }

  private getEncryptionKey(): Buffer {
    const envKey = process.env.OPENCLAW_TOKEN_ENCRYPTION_KEY;
    if (!envKey) {
      throw new Error("OPENCLAW_TOKEN_ENCRYPTION_KEY env var is required for token storage");
    }
    // If the key is already 32 bytes hex (64 chars), use directly
    if (/^[0-9a-f]{64}$/i.test(envKey)) {
      return Buffer.from(envKey, "hex");
    }
    // Otherwise derive via scrypt
    return scryptSync(envKey, "openclaw-token-store", KEY_LENGTH);
  }

  private encrypt(plaintext: string): Buffer {
    const key = this.getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: [iv (16)] [authTag (16)] [ciphertext]
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private decrypt(data: Buffer): string {
    const key = this.getEncryptionKey();
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  }
}
