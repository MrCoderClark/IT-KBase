/**
 * Auth mail. Resend is used when RESEND_API_KEY and EMAIL_FROM are set
 * (frontend/.env, loaded by Next.js). The message body is a one-time link
 * and is not written to the log.
 */
export async function sendAuthEmail(message: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (apiKey && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error(
        `[auth] Resend rejected "${message.subject}" for ${message.to}: ${response.status} ${detail}`,
      );
      return;
    }
    console.info(`[auth] sent "${message.subject}" to ${message.to}`);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(`[auth] email delivery is not configured; "${message.subject}" was not sent`);
    return;
  }
  console.info(`[auth email] to=${message.to}\n${message.text}`);
}
