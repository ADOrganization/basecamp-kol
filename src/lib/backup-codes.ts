/**
 * SECURITY: Backup code utilities
 *
 * Backup codes are hashed before storage to protect against database breaches.
 * Uses bcrypt with a moderate cost factor for secure hashing.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10; // Balance security vs performance for backup codes

/**
 * Generate cryptographically secure backup codes
 * Returns both plain text (to show user once) and hashed versions (to store)
 */
export async function generateBackupCodes(count: number = 10): Promise<{
  plainTextCodes: string[];
  hashedCodes: string[];
}> {
  const plainTextCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 6 random bytes and convert to hex for a secure backup code
    const bytes = crypto.randomBytes(6);
    const code = bytes.toString("hex").toUpperCase().slice(0, 10);
    // Format as XXXXX-XXXXX for readability
    const formattedCode = `${code.slice(0, 5)}-${code.slice(5)}`;
    plainTextCodes.push(formattedCode);

    // SECURITY: Hash the code for storage
    const hashedCode = await bcrypt.hash(formattedCode, BCRYPT_ROUNDS);
    hashedCodes.push(hashedCode);
  }

  return { plainTextCodes, hashedCodes };
}

/**
 * Verify a backup code against hashed stored codes
 * Returns the index of the matching code, or -1 if no match
 *
 * SECURITY: Uses bcrypt.compare which is timing-safe
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<number> {
  // Normalize the code (uppercase, remove dashes)
  const normalizedCode = code.toUpperCase();
  // Try both formats: with and without dash
  const codeWithDash = normalizedCode.includes("-")
    ? normalizedCode
    : `${normalizedCode.slice(0, 5)}-${normalizedCode.slice(5)}`;

  // SECURITY: Must check all codes to prevent timing attacks revealing code count
  // Track first match but continue checking all
  let matchIndex = -1;
  const checkPromises = hashedCodes.map(async (hashedCode, index) => {
    try {
      const isMatch = await bcrypt.compare(codeWithDash, hashedCode);
      return { index, isMatch };
    } catch {
      return { index, isMatch: false };
    }
  });

  const results = await Promise.all(checkPromises);
  for (const result of results) {
    if (result.isMatch && matchIndex === -1) {
      matchIndex = result.index;
    }
  }

  return matchIndex;
}

/**
 * Check if stored backup codes are hashed (bcrypt hashes start with $2)
 * Used for migration from plain text to hashed codes
 */
export function areCodesHashed(codes: string[]): boolean {
  if (codes.length === 0) return false;
  // bcrypt hashes start with $2a$, $2b$, or $2y$
  return codes[0].startsWith("$2");
}

/**
 * Legacy plain text backup code check (timing-safe)
 * Used only for codes that haven't been migrated yet
 */
export function timingSafeBackupCodeCheck(
  code: string,
  backupCodes: string[]
): number {
  const normalizedCode = code.toUpperCase().replace(/-/g, "");
  let foundIndex = -1;

  // Always iterate all codes to prevent timing attacks
  for (let i = 0; i < backupCodes.length; i++) {
    const normalizedBackup = backupCodes[i].toUpperCase().replace(/-/g, "");
    // Use timing-safe comparison for each code
    if (normalizedCode.length === normalizedBackup.length) {
      try {
        const isMatch = crypto.timingSafeEqual(
          Buffer.from(normalizedCode),
          Buffer.from(normalizedBackup)
        );
        if (isMatch && foundIndex === -1) {
          foundIndex = i;
        }
      } catch {
        // Length mismatch, continue
      }
    }
  }
  return foundIndex;
}
