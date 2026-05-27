// Centralized environment-variable accessors.
// Server-only values must never be imported from a Client Component.

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return "";
  }
  return value;
}

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Marketing Dashboard",
  nodeEnv: process.env.NODE_ENV || "development",

  mongodbUri: () => required("MONGODB_URI", process.env.MONGODB_URI),

  jwtSecret: () => required("JWT_SECRET", process.env.JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "mkt_session",
  sessionCookieDomain: process.env.SESSION_COOKIE_DOMAIN || undefined,

  mfaIssuer: process.env.MFA_ISSUER || "Marketing Dashboard",
  mfaEncryptionKey: () =>
    required("MFA_SECRET_ENCRYPTION_KEY", process.env.MFA_SECRET_ENCRYPTION_KEY),

  recaptchaEnabled: process.env.RECAPTCHA_ENABLED === "true",
  recaptchaSecret: process.env.RECAPTCHA_SECRET_KEY || "",
  recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "",
  recaptchaMinScore: Number(process.env.RECAPTCHA_MIN_SCORE || "0.5"),

  storage: {
    endpoint: process.env.STORAGE_ENDPOINT || "",
    region: process.env.STORAGE_REGION || "us-east-1",
    bucket: process.env.STORAGE_BUCKET || "",
    accessKey: process.env.STORAGE_ACCESS_KEY || "",
    secretKey: process.env.STORAGE_SECRET_KEY || "",
    publicUrl: process.env.STORAGE_PUBLIC_URL || "",
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  },

  bootstrap: {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@bingobingo.tv",
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "ChangeMe123!",
    firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME || "Super",
    lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME || "Admin",
  },

  security: {
    passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH || "8"),
    maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS || "5"),
    loginLockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES || "15"),
  },

  brevoApiKey: () => required("BREVO_API_KEY", process.env.BREVO_API_KEY),
} as const;

export const publicEnv = {
  appName: env.appName,
  appUrl: env.appUrl,
  recaptchaSiteKey: env.recaptchaSiteKey,
  recaptchaEnabled: env.recaptchaEnabled,
};
