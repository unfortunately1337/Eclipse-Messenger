export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startSecretChatCleanup } = await import("./lib/server/secret-chat-cleanup");
    startSecretChatCleanup();
    const { startBotWebhookWorker } = await import("./lib/server/bot-updates");
    startBotWebhookWorker();
  }
}
