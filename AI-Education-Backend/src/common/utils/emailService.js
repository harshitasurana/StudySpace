// emailService.js
//
// Local-only stub: no real SMTP connection. This used to send through the
// office's real Hostinger account (itdesk@myntiqtech.com) — meaning every
// password reset / signup / notification email in local dev actually went
// out through office infrastructure. Instead, this logs the email content
// so features that depend on it (password reset links, etc.) still work
// for local testing — read the link from the log instead of an inbox.

import { logInfo } from "./logger.js";

export async function sendEmail({ to, subject, html }) {
  const messageId = `local-log-${Date.now()}`;
  logInfo("Email not sent (local stub) - logging content instead", {
    to,
    subject,
    html,
    messageId,
    service: "email",
  });
  return { success: true, messageId };
}
