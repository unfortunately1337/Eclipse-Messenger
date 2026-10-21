import { createHash, randomInt } from "crypto";

function getOtpSecret() {
  const raw = (
    process.env.EMAIL_CODE_SECRET?.trim() ||
    process.env.E2E_DB_ENCRYPTION_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim()
  );
  if (!raw && process.env.NODE_ENV === "production") throw new Error("An email code secret must be configured in production");
  return raw || "eclipse-fallback-email-otp-secret-2026-safe-default";
}

export function generateOtpCode() {
  const value = randomInt(0, 1_000_000);
  return value.toString().padStart(6, "0");
}

export function hashOtpCode(code: string) {
  const secret = getOtpSecret();
  return createHash("sha256").update(`${code}:${secret}`).digest("hex");
}
