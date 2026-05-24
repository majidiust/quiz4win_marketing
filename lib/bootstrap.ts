import { connectDB } from "./db";
import { User } from "@/models/User";
import { hashPassword } from "./auth/password";
import { env } from "./env";

let bootstrapped = false;

// Idempotently creates the initial super-admin user if no users exist yet.
export async function bootstrapAdminIfNeeded(): Promise<void> {
  if (bootstrapped) return;
  await connectDB();
  const count = await User.estimatedDocumentCount();
  if (count === 0) {
    const passwordHash = await hashPassword(env.bootstrap.password);
    await User.create({
      firstName: env.bootstrap.firstName,
      lastName: env.bootstrap.lastName,
      email: env.bootstrap.email.toLowerCase(),
      passwordHash,
      role: "super_admin",
      status: "active",
    });
    console.log(`[bootstrap] Created initial super-admin: ${env.bootstrap.email}`);
  }
  bootstrapped = true;
}
