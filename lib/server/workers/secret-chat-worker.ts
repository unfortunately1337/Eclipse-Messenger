import { cleanupExpiredSecretChats } from "../secret-chat-cleanup";
// Compatibility entry point for older deployments. PostgreSQL polling now owns retries.
export { cleanupExpiredSecretChats };
