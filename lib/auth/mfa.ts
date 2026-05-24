import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "node:crypto";
import { env } from "@/lib/env";

// AES-256-GCM symmetric encryption for MFA secrets at rest.
// MFA_SECRET_ENCRYPTION_KEY must be a base64 string of 32 bytes.
function getKey(): Buffer {
  const raw = env.mfaEncryptionKey();
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    // Fallback: hash provided value to a 32-byte key so dev keys still work.
    return crypto.createHash("sha256").update(raw).digest();
  }
  return buf;
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !encB64) return "";
  const key = getKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export async function generateMfaSetup(email: string): Promise<MfaSetup> {
  const secret = speakeasy.generateSecret({
    name: `${env.mfaIssuer} (${email})`,
    issuer: env.mfaIssuer,
    length: 20,
  });
  const otpauthUrl = secret.otpauth_url ?? "";
  const qrCodeDataUrl = otpauthUrl ? await QRCode.toDataURL(otpauthUrl) : "";
  return {
    secret: secret.base32,
    otpauthUrl,
    qrCodeDataUrl,
  };
}

export function verifyTotp(secretBase32: string, token: string): boolean {
  if (!secretBase32 || !token) return false;
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: "base32",
    token: token.replace(/\s+/g, ""),
    window: 1,
  });
}

export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${code.slice(0, 5)}-${code.slice(5, 10)}`);
  }
  return codes;
}
