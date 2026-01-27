/**
 * Migration Script: Encrypt Sensitive Data at Rest
 *
 * This script encrypts existing plaintext sensitive data in the database.
 * Run once after setting up ENCRYPTION_KEY environment variable.
 *
 * Usage:
 *   1. Generate encryption key: openssl rand -hex 32
 *   2. Set ENCRYPTION_KEY environment variable
 *   3. Run: npx tsx scripts/encrypt-sensitive-data.ts
 *
 * IMPORTANT: Back up your database before running this script!
 */

import { PrismaClient } from "@prisma/client";
import { encryptSensitiveData, isEncrypted } from "../src/lib/crypto";

const db = new PrismaClient();

async function main() {
  console.log("Starting sensitive data encryption migration...\n");

  // Check encryption key is available
  if (!process.env.ENCRYPTION_KEY) {
    console.error("ERROR: ENCRYPTION_KEY environment variable is required");
    console.error("Generate one with: openssl rand -hex 32");
    process.exit(1);
  }

  // Encrypt Organization sensitive fields
  console.log("Encrypting Organization API keys...");
  const organizations = await db.organization.findMany({
    select: {
      id: true,
      twitterApiKey: true,
      twitterCookies: true,
      twitterCsrfToken: true,
      apifyApiKey: true,
      socialDataApiKey: true,
      telegramBotToken: true,
      telegramWebhookSecret: true,
    },
  });

  let orgUpdated = 0;
  for (const org of organizations) {
    const updates: Record<string, string | null> = {};

    if (org.twitterApiKey && !isEncrypted(org.twitterApiKey)) {
      updates.twitterApiKey = encryptSensitiveData(org.twitterApiKey);
    }
    if (org.twitterCookies && !isEncrypted(org.twitterCookies)) {
      updates.twitterCookies = encryptSensitiveData(org.twitterCookies);
    }
    if (org.twitterCsrfToken && !isEncrypted(org.twitterCsrfToken)) {
      updates.twitterCsrfToken = encryptSensitiveData(org.twitterCsrfToken);
    }
    if (org.apifyApiKey && !isEncrypted(org.apifyApiKey)) {
      updates.apifyApiKey = encryptSensitiveData(org.apifyApiKey);
    }
    if (org.socialDataApiKey && !isEncrypted(org.socialDataApiKey)) {
      updates.socialDataApiKey = encryptSensitiveData(org.socialDataApiKey);
    }
    if (org.telegramBotToken && !isEncrypted(org.telegramBotToken)) {
      updates.telegramBotToken = encryptSensitiveData(org.telegramBotToken);
    }
    if (org.telegramWebhookSecret && !isEncrypted(org.telegramWebhookSecret)) {
      updates.telegramWebhookSecret = encryptSensitiveData(org.telegramWebhookSecret);
    }

    if (Object.keys(updates).length > 0) {
      await db.organization.update({
        where: { id: org.id },
        data: updates,
      });
      orgUpdated++;
    }
  }
  console.log(`  Encrypted ${orgUpdated}/${organizations.length} organizations\n`);

  // Encrypt User 2FA secrets
  console.log("Encrypting User 2FA secrets...");
  const users = await db.user.findMany({
    where: { twoFactorSecret: { not: null } },
    select: { id: true, twoFactorSecret: true },
  });

  let userUpdated = 0;
  for (const user of users) {
    if (user.twoFactorSecret && !isEncrypted(user.twoFactorSecret)) {
      await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: encryptSensitiveData(user.twoFactorSecret),
        },
      });
      userUpdated++;
    }
  }
  console.log(`  Encrypted ${userUpdated}/${users.length} user 2FA secrets\n`);

  // Encrypt AdminUser 2FA secrets
  console.log("Encrypting AdminUser 2FA secrets...");
  const admins = await db.adminUser.findMany({
    where: { twoFactorSecret: { not: null } },
    select: { id: true, twoFactorSecret: true },
  });

  let adminUpdated = 0;
  for (const admin of admins) {
    if (admin.twoFactorSecret && !isEncrypted(admin.twoFactorSecret)) {
      await db.adminUser.update({
        where: { id: admin.id },
        data: {
          twoFactorSecret: encryptSensitiveData(admin.twoFactorSecret),
        },
      });
      adminUpdated++;
    }
  }
  console.log(`  Encrypted ${adminUpdated}/${admins.length} admin 2FA secrets\n`);

  console.log("Migration complete!");
  console.log("\nIMPORTANT: Update your application code to use encrypt/decrypt functions");
  console.log("when reading/writing sensitive fields.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
