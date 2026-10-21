export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 30);
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "eclipse.sid";
export const SESSION_SECONDARY_COOKIE_NAME = process.env.SESSION_SECONDARY_COOKIE_NAME ?? "eclipse.sid_2";
export const ADD_ACCOUNT_COOKIE_NAME = "eclipse.add_account";
export const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME ?? "eclipse.csrf";
export const REGISTER_COOKIE_NAME = "eclipse.reg";
export const REGISTER_TTL_SECONDS = 60 * 15;
export const MFA_COOKIE_NAME = "eclipse.mfa";
export const MFA_TTL_SECONDS = 60 * 5;
export const TOTP_SETUP_TTL_SECONDS = 60 * 10;
export const EMAIL_MIGRATION_COOKIE_NAME = "eclipse.email_migration";
export const EMAIL_MIGRATION_TTL_SECONDS = 60 * 15;
export const EMAIL_CODE_TTL_SECONDS = 60 * 5;
export const EMAIL_CODE_RESEND_COOLDOWN_SECONDS = 60;
export const PASSWORD_RESET_COOKIE_NAME = "eclipse.password_reset";
export const PASSWORD_RESET_TTL_SECONDS = 60 * 15;

export const COOKIE_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;

export const LINK_REGEX = /^[a-z][a-z0-9_]{2,30}[a-z0-9]$/;
