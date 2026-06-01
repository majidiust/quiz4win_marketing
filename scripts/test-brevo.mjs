// One-off Brevo diagnostic. Run: node scripts/test-brevo.mjs <recipient-email>
// Loads BREVO_API_KEY from .env.local, then:
//   1. /v3/account       — validates the API key + shows the account
//   2. /v3/senders       — lists verified senders (the From: address must be here)
//   3. /v3/senders/domains — lists verified domains (covers any address on them)
//   4. /v3/smtp/email    — actually sends a test message to the given recipient

import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const apiKey = env.BREVO_API_KEY;
const recipient = process.argv[2] || "admin@quiz4win.com";

if (!apiKey) {
  console.error("BREVO_API_KEY missing from .env.local");
  process.exit(1);
}

console.log("API key prefix:", apiKey.slice(0, 14) + "...");
console.log("Recipient     :", recipient);
console.log("");

async function call(label, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { "api-key": apiKey, Accept: "application/json", ...(init.headers || {}) },
  });
  console.log(`=== ${label} ===`);
  console.log("status:", res.status);
  const body = await res.text();
  try {
    console.log("body  :", JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log("body  :", body);
  }
  console.log("");
  return { status: res.status, body };
}

await call("GET /v3/account", "https://api.brevo.com/v3/account");
await call("GET /v3/senders", "https://api.brevo.com/v3/senders");
await call("GET /v3/senders/domains", "https://api.brevo.com/v3/senders/domains");

await call("POST /v3/smtp/email", "https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sender: { email: "noreply@quiz4win.com", name: "Quiz4Win" },
    to: [{ email: recipient }],
    subject: "Brevo diagnostic — test from Marketing Dashboard",
    htmlContent:
      "<p>If you can read this, Brevo + sender domain are working.</p><p>Sent at " +
      new Date().toISOString() +
      "</p>",
  }),
});
