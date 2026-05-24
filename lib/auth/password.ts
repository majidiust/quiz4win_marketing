import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(pwd: string): { ok: boolean; message?: string } {
  if (pwd.length < env.security.passwordMinLength) {
    return { ok: false, message: `Password must be at least ${env.security.passwordMinLength} characters.` };
  }
  if (!/[A-Z]/.test(pwd)) return { ok: false, message: "Password must contain an uppercase letter." };
  if (!/[a-z]/.test(pwd)) return { ok: false, message: "Password must contain a lowercase letter." };
  if (!/[0-9]/.test(pwd)) return { ok: false, message: "Password must contain a number." };
  return { ok: true };
}
