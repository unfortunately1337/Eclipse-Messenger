/* Run after deploying the receiver: node scripts/configure-telegram-importer.cjs https://eclpse.ru */
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local"), override: true, quiet: true });

async function main() {
  const token = process.env.TELEGRAM_IMPORT_BOT_TOKEN?.trim();
  const secret = process.env.TELEGRAM_IMPORT_WEBHOOK_SECRET?.trim();
  if (!token || !/^[A-Za-z0-9_-]{32,256}$/.test(secret ?? "")) throw new Error("Configure TELEGRAM_IMPORT_BOT_TOKEN and TELEGRAM_IMPORT_WEBHOOK_SECRET in the server environment first.");
  const origin = new URL(process.argv[2]);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Pass the HTTPS origin of the deployed Eclipse instance.");
  const url = new URL("/api/telegram/importer/webhook", origin).href;
  const check = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
  const receiver = await check.json();
  if (!check.ok || receiver.service !== "eclipse-telegram-importer" || !receiver.configured) throw new Error("The deployed receiver is not ready. Apply the migration, configure the environment and restart Eclipse first.");
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"], max_connections: 4, drop_pending_updates: false }), signal: AbortSignal.timeout(20000), redirect: "error" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("Telegram did not accept the webhook configuration. Check the bot credential and deployed HTTPS endpoint.");
  console.log("Telegram importer connected to " + url);
}
main().catch(error => { console.error(error instanceof Error && !/https?:\/\//.test(error.message) ? error.message : "Could not configure the Telegram importer. Check network access and the server configuration."); process.exitCode = 1; });
