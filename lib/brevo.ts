// Brevo (Sendinblue) transactional email client.
// All emails are sent from noreply@quiz4win.com.
// Errors are swallowed and logged — email must never block business operations.

import { env } from "./env";

export interface BrevoRecipient {
  email: string;
  name?: string;
}

interface BrevoPayload {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
}

export async function sendBrevoEmail(payload: BrevoPayload): Promise<void> {
  try {
    const apiKey = env.brevoApiKey();
    if (!apiKey) {
      console.warn("[brevo] BREVO_API_KEY not configured – skipping email");
      return;
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: "noreply@quiz4win.com", name: "Quiz4Win" },
        to: payload.to,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[brevo] Email send failed:", res.status, body);
    }
  } catch (err) {
    console.error("[brevo] Email send error:", err);
  }
}
