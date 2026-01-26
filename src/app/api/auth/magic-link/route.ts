/**
 * Magic Link Request API
 *
 * POST /api/auth/magic-link
 * Sends a magic link email for passwordless authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createVerificationToken } from "@/lib/magic-link";
import { sendMagicLinkEmail } from "@/lib/email";
import { logSecurityEvent, getRequestMetadata, checkSuspiciousActivity } from "@/lib/security-audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/api-security";
import DOMPurify from "isomorphic-dompurify";

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.magicLink);
  if (rateLimitResponse) {
    const { ipAddress } = getRequestMetadata(request);
    await logSecurityEvent({
      action: "RATE_LIMIT_EXCEEDED",
      ipAddress: ipAddress || undefined,
      metadata: { endpoint: "/api/auth/magic-link" },
    });
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const rawEmail = body.email?.toString() || "";
    const userType = body.userType === "kol" ? "kol" : "user";

    // Sanitize and validate email
    const email = DOMPurify.sanitize(rawEmail).toLowerCase().trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = getRequestMetadata(request);

    // Check for suspicious activity
    if (ipAddress) {
      const isSuspicious = await checkSuspiciousActivity(ipAddress, "MAGIC_LINK_SENT");
      if (isSuspicious) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    }

    // Check if user/KOL account exists
    let userExists = false;
    let isDisabled = false;

    if (userType === "kol") {
      const kolAccount = await db.kOLAccount.findUnique({
        where: { email },
        select: { id: true, isDisabled: true },
      });
      userExists = !!kolAccount;
      isDisabled = kolAccount?.isDisabled || false;
    } else {
      const user = await db.user.findUnique({
        where: { email },
        select: { id: true, isDisabled: true },
      });
      userExists = !!user;
      isDisabled = user?.isDisabled || false;
    }

    // Always return success to prevent email enumeration attacks
    // But only actually send the email if the user exists and is not disabled
    if (userExists && !isDisabled) {
      const token = await createVerificationToken(email);
      const result = await sendMagicLinkEmail(email, token, userType);

      await logSecurityEvent({
        action: "MAGIC_LINK_SENT",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, userType, success: result.success },
      });

      if (!result.success) {
        console.error("Failed to send magic link email:", result.error);
      }
    } else if (isDisabled) {
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, reason: "Account disabled" },
      });
    } else {
      // Log that email wasn't found but don't reveal this to the client
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        metadata: { email, reason: "Email not found" },
      });
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive a sign-in link shortly.",
    });
  } catch (error) {
    console.error("Magic link request error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
