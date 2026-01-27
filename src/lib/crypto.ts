/**
 * Encryption utilities for sensitive data at rest
 *
 * SECURITY: Use these functions to encrypt/decrypt sensitive data before storing in the database
 *
 * Environment variable required: ENCRYPTION_KEY (32 bytes / 64 hex chars)
 * Generate with: openssl rand -hex 32
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Lazy-load encryption key
let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_encryptionKey) return _encryptionKey;

  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "SECURITY: ENCRYPTION_KEY environment variable is required for encrypting sensitive data"
    );
  }

  if (key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32"
    );
  }

  _encryptionKey = Buffer.from(key, "hex");
  return _encryptionKey;
}

/**
 * Encrypt sensitive data before storing in database
 *
 * @param plaintext - The sensitive data to encrypt
 * @returns Base64-encoded encrypted string (IV + AuthTag + Ciphertext)
 */
export function encryptSensitiveData(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt sensitive data retrieved from database
 *
 * @param encryptedBase64 - Base64-encoded encrypted string
 * @returns Decrypted plaintext
 */
export function decryptSensitiveData(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  // Extract IV, AuthTag, and Ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Check if a value appears to be encrypted (base64 with correct structure)
 */
export function isEncrypted(value: string): boolean {
  try {
    const decoded = Buffer.from(value, "base64");
    // Minimum size: IV (16) + AuthTag (16) + at least 1 byte ciphertext
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Encrypt if not already encrypted, otherwise return as-is
 * Useful for migration scenarios
 */
export function ensureEncrypted(value: string | null): string | null {
  if (!value) return null;
  if (isEncrypted(value)) return value;
  return encryptSensitiveData(value);
}

/**
 * Decrypt if encrypted, otherwise return as-is
 * Useful for migration scenarios
 */
export function ensureDecrypted(value: string | null): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  return decryptSensitiveData(value);
}

/**
 * Safely decrypt a value, returning the original if decryption fails
 * This handles the case where data might be plain text but looks like base64
 */
export function safeDecrypt(value: string | null): string | null {
  if (!value) return null;

  // If it doesn't look encrypted, return as-is
  if (!isEncrypted(value)) return value;

  // Try to decrypt, fall back to original if it fails
  try {
    return decryptSensitiveData(value);
  } catch {
    // Decryption failed - the value is likely plain text that happened to
    // look like base64 encoded data. Return the original value.
    console.warn("[Crypto] Decryption failed, assuming plain text value");
    return value;
  }
}
