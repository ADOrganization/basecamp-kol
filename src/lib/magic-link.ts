/**
 * Magic Link Token Management
 *
 * Handles generation and verification of magic link tokens.
 */

import { db } from "./db";
import crypto from "crypto";

const TOKEN_EXPIRY_MINUTES = 15;
const INVITE_EXPIRY_DAYS = 7;

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Create a magic link verification token
 */
export async function createVerificationToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // Delete any existing tokens for this email
  await db.verificationToken.deleteMany({
    where: { identifier: email.toLowerCase() },
  });

  // Create new token
  await db.verificationToken.create({
    data: {
      identifier: email.toLowerCase(),
      token,
      expires,
    },
  });

  return token;
}

/**
 * Verify a magic link token and return the email if valid
 * Token-only lookup - email is stored with the token in the database
 */
export async function verifyMagicLinkToken(
  token: string
): Promise<{ valid: boolean; expired?: boolean; email?: string }> {
  const verificationToken = await db.verificationToken.findFirst({
    where: { token },
  });

  if (!verificationToken) {
    return { valid: false };
  }

  // Check if expired
  if (verificationToken.expires < new Date()) {
    // Clean up expired token
    await db.verificationToken.delete({
      where: { id: verificationToken.id },
    });
    return { valid: false, expired: true };
  }

  const email = verificationToken.identifier;

  // Token is valid - delete it so it can't be reused
  await db.verificationToken.delete({
    where: { id: verificationToken.id },
  });

  return { valid: true, email };
}

/**
 * Create a user invitation token
 */
export async function createInvitationToken(
  email: string,
  organizationId: string,
  invitedBy: string,
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" = "MEMBER"
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Revoke any existing pending invitations for this email in this org
  await db.userInvitation.updateMany({
    where: {
      email: email.toLowerCase(),
      organizationId,
      acceptedAt: null,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  // Create new invitation
  await db.userInvitation.create({
    data: {
      email: email.toLowerCase(),
      organizationId,
      role,
      invitedBy,
      token,
      expiresAt,
    },
  });

  return token;
}

/**
 * Verify an invitation token
 */
export async function verifyInvitationToken(token: string): Promise<{
  valid: boolean;
  expired?: boolean;
  revoked?: boolean;
  invitation?: {
    id: string;
    email: string;
    organizationId: string;
    organizationName: string;
    organizationType: string;
    role: string;
    inviterName: string;
  };
}> {
  const invitation = await db.userInvitation.findUnique({
    where: { token },
    include: {
      organization: {
        select: { id: true, name: true, type: true },
      },
      inviter: {
        select: { name: true },
      },
    },
  });

  if (!invitation) {
    return { valid: false };
  }

  if (invitation.revokedAt) {
    return { valid: false, revoked: true };
  }

  if (invitation.acceptedAt) {
    return { valid: false };
  }

  if (invitation.expiresAt < new Date()) {
    return { valid: false, expired: true };
  }

  return {
    valid: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      organizationId: invitation.organizationId,
      organizationName: invitation.organization.name,
      organizationType: invitation.organization.type,
      role: invitation.role,
      inviterName: invitation.inviter.name || "Unknown",
    },
  };
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(invitationId: string): Promise<void> {
  await db.userInvitation.update({
    where: { id: invitationId },
    data: { acceptedAt: new Date() },
  });
}

/**
 * Clean up expired tokens (should be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();

  await db.verificationToken.deleteMany({
    where: { expires: { lt: now } },
  });
}
