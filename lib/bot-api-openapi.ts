import { BOT_API_METHODS } from "./bot-api";
import { BOT_METHOD_REFERENCE } from "./bot-api-reference";
type Schema = Record<string, unknown>;
const str = (maxLength = 128): Schema => ({ type: "string", minLength: 1, maxLength });
const uuid: Schema = { type: "string", format: "uuid" };
const object = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: "object", additionalProperties: false, properties, required });
const integer = (minimum: number, maximum: number, fallback: number): Schema => ({ type: "integer", minimum, maximum, default: fallback });
const button = object({ text: str(64), callback_data: { ...str(64), description: "UTF-8 <=64 bytes; mutually exclusive with url" }, url: { type: "string", format: "uri", pattern: "^https://" } }, ["text"]);
button.oneOf = [{ required: ["callback_data"], not: { required: ["url"] } }, { required: ["url"], not: { required: ["callback_data"] } }];
const markup = object({ inline_keyboard: { type: "array", maxItems: 8, items: { type: "array", minItems: 1, maxItems: 4, items: button } } }, ["inline_keyboard"]);
const menuButton = object({ text: str(64), message: str(4096), callback_data: { ...str(64), description: "UTF-8 <=64 bytes" }, url: { type: "string", format: "uri", pattern: "^https://" } }, ["text"]);
menuButton.description = "At most one action: message, callback_data or url. With no action, sends text. Reserved media prefix is rejected.";
menuButton.oneOf = [
  { not: { anyOf: ["message", "callback_data", "url"].map(key => ({ required: [key] })) } },
  ...["message", "callback_data", "url"].map(key => ({ required: [key], not: { anyOf: ["message", "callback_data", "url"].filter(other => other !== key).map(other => ({ required: [other] })) } })),
];
const menu: Schema = { oneOf: [object({ type: { const: "none" } }, ["type"]), object({ type: { const: "commands" } }, ["type"]), object({ type: { const: "keyboard" }, button_text: str(32), open_by_default: { type: "boolean", default: true }, keyboard: { type: "array", minItems: 1, maxItems: 8, items: { type: "array", minItems: 1, maxItems: 4, items: menuButton } } }, ["type", "keyboard"])] };
const chatSettings = object({ empty_text: { type: "string", maxLength: 2048, description: "Plain text in an empty chat; empty string hides the panel" }, input_placeholder: { type: "string", maxLength: 128, description: "Single line; empty string hides the placeholder" }, menu });
const mediaProperties = { chat_id: str(), file_id: str(1024), file_name: { ...str(255), description: "Display/download name for sendDocument and sendAudio" }, caption: { type: "string", maxLength: 4096 }, reply_to_message_id: str(), reply_markup: markup, request_id: uuid };
const schemas: Record<string, Schema> = {
  getUpdates: object({ offset: integer(0, 2147483647, 0), limit: integer(1, 100, 100), timeout: integer(0, 25, 0) }),
  sendMessage: object({ chat_id: str(), text: { ...str(16384), description: "Plain text; reserved media prefix rejected" }, reply_to_message_id: str(), reply_markup: markup, request_id: uuid }, ["chat_id", "text"]),
  editMessageText: object({ chat_id: str(), message_id: str(), text: str(16384), reply_markup: markup }, ["chat_id", "message_id", "text"]),
  deleteMessage: object({ chat_id: str(), message_id: str() }, ["chat_id", "message_id"]), getChat: object({ chat_id: str() }, ["chat_id"]), getFile: object({ file_id: str(1024) }, ["file_id"]),
  sendMediaGroup: object({ chat_id: str(), media: { type: "array", minItems: 2, maxItems: 6, items: object({ type: { type: "string", enum: ["photo", "video"] }, file_id: str(1024) }, ["type", "file_id"]) }, caption: { type: "string", maxLength: 4096 }, request_id: uuid }, ["chat_id", "media"]),
  uploadFile: object({ chat_id: str(), file: { type: "string", format: "binary", description: "1 byte to 20 MiB" }, kind: { type: "string", enum: ["image", "video", "video_note", "voice", "audio", "file"], default: "file" }, duration_ms: integer(0, 86400000, 0) }, ["chat_id", "file"]),
  setMyCommands: object({ commands: { type: "array", maxItems: 100, items: object({ command: { ...str(32), pattern: "^[a-z][a-z0-9_]{0,31}$" }, description: str(100) }, ["command", "description"]) } }, ["commands"]),
  setMyChatSettings: chatSettings,
  getMyChatSettings: object({}),
  setChatSettings: object({ chat_id: str(), settings: { anyOf: [chatSettings, { type: "null" }] } }, ["chat_id", "settings"]),
  getChatSettings: object({ chat_id: str() }, ["chat_id"]),
  setWebhook: object({ url: { type: "string", format: "uri", maxLength: 2048, description: "Public HTTPS, port 443, no credentials/fragment" }, secret_token: { type: "string", pattern: "^[A-Za-z0-9_-]{16,128}$" }, drop_pending_updates: { type: "boolean", default: false } }, ["url", "secret_token"]),
  deleteWebhook: object({ drop_pending_updates: { type: "boolean", default: false } }),
  answerCallbackQuery: object({ callback_query_id: uuid }, ["callback_query_id"]),
  sendChatAction: object({ chat_id: str(), action: { type: "string", enum: ["typing", "upload_photo", "upload_video", "record_voice", "upload_document"] } }, ["chat_id", "action"]),
};
for (const name of ["sendPhoto", "sendVideo", "sendVideoNote", "sendVoice", "sendAudio", "sendDocument", "sendSticker"]) schemas[name] = object(mediaProperties, ["chat_id", "file_id"]);
const success = { description: "Successful method result", content: { "application/json": { schema: object({ ok: { const: true }, data: {} }, ["ok", "data"]) } } };
const error = { description: "Request failure", headers: { "Retry-After": { description: "Seconds to wait on HTTP 429", schema: { type: "integer" } } }, content: { "application/json": { schema: { type: "object", properties: { ok: { const: false }, error: { type: "string" }, details: {} }, required: ["ok", "error"] } } } };
export const BOT_API_OPENAPI = {
  openapi: "3.1.0", info: { title: "Eclipse Bot API", version: "1.0.0", description: "Private bot chats; developer guide /bot-api. At-least-once delivery; updates expire after 7 days." },
  servers: [{ url: "/api/bot/v1" }], security: [{ botToken: [] }], components: { securitySchemes: { botToken: { type: "http", scheme: "bearer", bearerFormat: "ecb_UUID.secret" } } },
  paths: Object.fromEntries([
    ...BOT_API_METHODS.map(method => [`/${method}`, { post: { operationId: method, summary: BOT_METHOD_REFERENCE[method][0], requestBody: { required: true, content: { [method === "uploadFile" ? "multipart/form-data" : "application/json"]: { schema: schemas[method] ?? object({}) } } }, responses: { "200": success, "400": error, "401": error, "403": error, "404": error, "409": error, "413": error, "429": error, "500": error, "503": error } } }]),
    ["/files/{id}", { get: { operationId: "downloadFile", parameters: [{ name: "id", in: "path", required: true, schema: str() }], responses: { "200": { description: "File bytes", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } }, "401": error, "403": error, "404": error } } }],
  ]),
};
