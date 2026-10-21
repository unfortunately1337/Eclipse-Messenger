const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const target = path.join(root, ".env");
let example = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const secrets = ["SESSION_SECRET", "CSRF_SECRET", "EMAIL_CODE_SECRET", "TOTP_ENCRYPTION_KEY", "E2E_DB_ENCRYPTION_KEY", "E2E_BACKUP_ENCRYPTION_KEY", "MEDIA_ENCRYPTION_KEY"];
for (const key of secrets) example = example.replace(new RegExp(`^${key}=.*$`, "m"), `${key}="${randomBytes(32).toString("hex")}"`);
try {
  fs.writeFileSync(target, example, { flag: "wx", mode: 0o600 });
  console.log("Created local .env with independent random secrets. Configure SMTP, Pusher and your MinIO bucket before using the app.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.error(".env already exists; nothing was overwritten.");
  process.exitCode = 1;
}
