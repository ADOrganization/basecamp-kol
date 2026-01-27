/**
 * Email Service using Resend
 *
 * Handles sending magic link authentication emails and user invitations.
 */

import { Resend } from "resend";

// Lazy-initialize Resend to avoid build-time errors
let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Return null to use console logging fallback (both dev and prod when not configured)
      console.warn("[Email] RESEND_API_KEY not configured - emails will be logged to console only");
      return null;
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Basecamp <noreply@basecampnetwork.xyz>";
const APP_NAME = "Basecamp";
const APP_URL = process.env.NEXTAUTH_URL || "https://basecampnetwork.xyz";

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send a magic link login email
 */
export async function sendMagicLinkEmail(
  email: string,
  token: string
): Promise<SendEmailResult> {
  // Token-only URL - email is looked up from the token in the database
  // This avoids triggering phishing warnings from Safe Browsing
  const magicLink = `${APP_URL}/api/auth/callback/magic?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d9488 0%, #059669 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 16px; color: #18181b; font-size: 20px; font-weight: 600;">Sign in to your account</h2>
              <p style="margin: 0 0 24px; color: #52525b; font-size: 15px; line-height: 1.6;">
                Click the button below to securely sign in. This link will expire in 15 minutes.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">
                      Sign in to ${APP_NAME}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center;">
                This is an automated email from ${APP_NAME}.<br>
                Please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Sign in to ${APP_NAME}

Click the link below to securely sign in to your account:

${magicLink}

This link will expire in 15 minutes.

If you didn't request this email, you can safely ignore it.

---
This is an automated email from ${APP_NAME}. Please do not reply.
  `.trim();

  try {
    const resend = getResend();

    // Development fallback: log magic link to console
    if (!resend) {
      console.log("\n" + "=".repeat(60));
      console.log("📧 MAGIC LINK (dev mode - no email sent)");
      console.log("=".repeat(60));
      console.log(`To: ${email}`);
      console.log(`Link: ${magicLink}`);
      console.log("=".repeat(60) + "\n");
      return { success: true };
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Sign in to ${APP_NAME}`,
      html,
      text,
    });

    if (error) {
      console.error("Failed to send magic link email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Email service error:", error);
    return { success: false, error: "Failed to send email" };
  }
}

/**
 * Send a user invitation email
 */
export async function sendInvitationEmail(
  email: string,
  token: string,
  inviterName: string,
  organizationName: string,
  role: string
): Promise<SendEmailResult> {
  const inviteLink = `${APP_URL}/accept-invite?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d9488 0%, #059669 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 16px; color: #18181b; font-size: 20px; font-weight: 600;">You've been invited!</h2>
              <p style="margin: 0 0 24px; color: #52525b; font-size: 15px; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on ${APP_NAME} as a <strong>${role}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore it.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center;">
                This is an automated email from ${APP_NAME}.<br>
                Please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
You're invited to ${APP_NAME}!

${inviterName} has invited you to join ${organizationName} on ${APP_NAME} as a ${role}.

Click the link below to accept your invitation:

${inviteLink}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore it.

---
This is an automated email from ${APP_NAME}. Please do not reply.
  `.trim();

  try {
    const resend = getResend();

    // Development fallback: log invite link to console
    if (!resend) {
      console.log("\n" + "=".repeat(60));
      console.log("📧 INVITATION EMAIL (dev mode - no email sent)");
      console.log("=".repeat(60));
      console.log(`To: ${email}`);
      console.log(`From: ${inviterName} at ${organizationName}`);
      console.log(`Role: ${role}`);
      console.log(`Link: ${inviteLink}`);
      console.log("=".repeat(60) + "\n");
      return { success: true };
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `You're invited to join ${organizationName} on ${APP_NAME}`,
      html,
      text,
    });

    if (error) {
      console.error("Failed to send invitation email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Email service error:", error);
    return { success: false, error: "Failed to send email" };
  }
}

/**
 * Send a user disabled notification email
 */
export async function sendAccountDisabledEmail(
  email: string,
  organizationName: string
): Promise<SendEmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Access Disabled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 16px; color: #18181b; font-size: 20px; font-weight: 600;">Account Access Disabled</h2>
              <p style="margin: 0 0 16px; color: #52525b; font-size: 15px; line-height: 1.6;">
                Your access to <strong>${organizationName}</strong> on ${APP_NAME} has been disabled by an administrator.
              </p>
              <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                If you believe this was done in error, please contact your organization administrator.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center;">
                This is an automated email from ${APP_NAME}.<br>
                Please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Account Access Disabled

Your access to ${organizationName} on ${APP_NAME} has been disabled by an administrator.

If you believe this was done in error, please contact your organization administrator.

---
This is an automated email from ${APP_NAME}. Please do not reply.
  `.trim();

  try {
    const resend = getResend();

    // Development fallback: log to console
    if (!resend) {
      console.log("\n" + "=".repeat(60));
      console.log("📧 ACCOUNT DISABLED EMAIL (dev mode - no email sent)");
      console.log("=".repeat(60));
      console.log(`To: ${email}`);
      console.log(`Organization: ${organizationName}`);
      console.log("=".repeat(60) + "\n");
      return { success: true };
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${APP_NAME}: Account Access Disabled`,
      html,
      text,
    });

    if (error) {
      console.error("Failed to send account disabled email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Email service error:", error);
    return { success: false, error: "Failed to send email" };
  }
}

/**
 * Send a client portal access email with magic link
 */
export async function sendClientPortalAccessEmail(
  email: string,
  token: string,
  campaignName: string,
  clientName?: string
): Promise<SendEmailResult> {
  // Token-only URL - email is looked up from the token in the database
  // This avoids triggering phishing warnings from Safe Browsing
  const magicLink = `${APP_URL}/api/auth/callback/magic?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Your Campaign Dashboard on ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d9488 0%, #059669 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 16px; color: #18181b; font-size: 20px; font-weight: 600;">Welcome to Your Campaign Dashboard${clientName ? `, ${clientName}` : ""}!</h2>
              <p style="margin: 0 0 24px; color: #52525b; font-size: 15px; line-height: 1.6;">
                You've been given access to view and track the progress of <strong>${campaignName}</strong>. Click the button below to access your dashboard.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">
                      Access Campaign Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                This link is your personal access link. Please keep it secure and do not share it with others.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center;">
                This is an automated email from ${APP_NAME}.<br>
                Please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Welcome to Your Campaign Dashboard${clientName ? `, ${clientName}` : ""}!

You've been given access to view and track the progress of ${campaignName}.

Click the link below to access your dashboard:

${magicLink}

This link is your personal access link. Please keep it secure and do not share it with others.

---
This is an automated email from ${APP_NAME}. Please do not reply.
  `.trim();

  try {
    const resend = getResend();

    // Development fallback: log magic link to console
    if (!resend) {
      console.log("\n" + "=".repeat(60));
      console.log("📧 CLIENT PORTAL ACCESS (dev mode - no email sent)");
      console.log("=".repeat(60));
      console.log(`To: ${email}`);
      console.log(`Campaign: ${campaignName}`);
      console.log(`Link: ${magicLink}`);
      console.log("=".repeat(60) + "\n");
      return { success: true };
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Access Your Campaign Dashboard - ${campaignName}`,
      html,
      text,
    });

    if (error) {
      console.error("Failed to send client portal access email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Email service error:", error);
    return { success: false, error: "Failed to send email" };
  }
}
