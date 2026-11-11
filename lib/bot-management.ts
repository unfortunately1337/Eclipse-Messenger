import type { EclipseSystemMessage } from "./eclipse-system";

export const BOT_DOCUMENTATION_URL = "https://github.com/unfortunately1337/Eclipse-Messenger/blob/main/BOT_PLATFORM.md";
export const BOT_DOCUMENTATION_TEXT = "Документация по созданию и подключению ботов доступна здесь.";

export type BotManagementStep = "root" | "bots" | "name" | "username" | "avatar" | "mine" | "detail" | "api_token" | "settings" | "delete_confirm" | "avatar_edit" | "group_permissions" | "name_edit" | "username_edit";
export type ManagedBotSummary = { id: string; name: string; username: string; avatarUrl: string | null; tokenActive: boolean };
export type BotManagementState = {
  step: BotManagementStep;
  revision: number;
  bots: ManagedBotSummary[];
  selectedBotId: string | null;
};
export type BotManagementResult = { state: BotManagementState; messages: EclipseSystemMessage[] };
export type BotManagementAction = "bots" | "documentation" | "create" | "mine" | "back" | "submit" | "skip" | "avatar" | "select" | "rotate" | "revoke" | "delete" | "confirm_delete" | "api_token" | "settings" | "change_avatar" | "group_permissions" | "change_name" | "change_username";
