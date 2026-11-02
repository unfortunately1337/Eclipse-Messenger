export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startSecretChatCleanup } = await import("./lib/server/secret-chat-cleanup");
    startSecretChatCleanup();
    const { startBotWebhookWorker } = await import("./lib/server/bot-updates");
    startBotWebhookWorker();
    const { startCallWorker } = await import("./lib/server/call-worker");
    startCallWorker();
    const { startPackImportWorker } = await import("./lib/server/pack-import-worker");
    startPackImportWorker();
    const { startTelegramImportWorker } = await import("./lib/server/telegram-import-worker");
    startTelegramImportWorker();
    const { startTelegramImportPolling } = await import("./lib/server/telegram-import-polling");
    startTelegramImportPolling();
    if (process.env.NODE_ENV === "development" && process.env.CALL_TEST_HELPER_ENABLED === "1") {
      const { startLocalCallTestHelper } = await import("./lib/server/local-call-test-helper");
      startLocalCallTestHelper();
    }
  }
}
