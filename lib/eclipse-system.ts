export const ECLIPSE_DIALOG_LINK = "eclipse";
export const ECLIPSE_DIALOG_TITLE = "Eclipse";
export const ECLIPSE_LIST_STATUS = "бот";

export type EclipseEventType =
  | "new_login"
  | "password_changed"
  | "two_factor_enabled"
  | "two_factor_disabled"
  | "suspicious_activity"
  | "session_terminated"
  | "security_recommendation"
  | "bot_management"
  | "call";

export type EclipseMessageActionType =
  | "not_me"
  | "terminate_sessions"
  | "terminate_other_sessions"
  | "enable_2fa"
  | "change_password";

export type EclipseMessageAction = {
  id: string;
  label: string;
  action: EclipseMessageActionType;
  variant: "outline";
};

export type EclipseSystemPayload = {
  title: string;
  body: string;
  eventType: EclipseEventType;
  protectedBody?: string;
  botRole?: "user" | "assistant";
  botToken?: string;
  actions?: EclipseMessageAction[];
  metadata?: {
    call?: import("./call-history").CallMessageData;
    sessionId?: string;
    ip?: string | null;
    userAgent?: string | null;
    deviceName?: string;
    occurredAt?: string;
  };
};

export type EclipseSystemMessage = {
  id: string;
  senderId: string;
  senderType: "system";
  systemPayload: EclipseSystemPayload;
  createdAt: string;
  reactions?: [];
};

export function isEclipseSystemLink(link: string | null | undefined) {
  return (link ?? "").trim().toLowerCase() === ECLIPSE_DIALOG_LINK;
}
