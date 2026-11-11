import { describe, expect, it } from "vitest";
import { serializeForwardedContent } from "@/lib/client/message-forwarding";
import { MEDIA_PREFIX } from "../chat-message-transport";
import { retainChatPreviewContent, resolveChatListPreviewMetaCached, shouldKeepDecryptedPreview } from "./chat-previews";
import type { ChatSummary } from "../types";

describe("sidebar media thumbnails", () => {
  const src = "/media/picture.bin#eclipse-e2e=not-downloaded-yet";
  it("rehydrates old cached media labels instead of permanently losing their thumbnail", () => {
    const base = { lastMessageAt: "2026-11-07T10:00:00Z", chatType: "direct" };
    const next = { ...base, lastMessage: "Сообщение", lastMessageCipherText: "cipher", lastMessageIv: "iv", lastMessageEncryptedKey: "key" } as ChatSummary;
    expect(shouldKeepDecryptedPreview({ ...base, lastMessage: "Фотография" } as ChatSummary, next)).toBe(false);
    expect(shouldKeepDecryptedPreview({ ...base, lastMessage: "Readable text" } as ChatSummary, next)).toBe(true);
  });

  it.each(["image", "video"])("keeps an unopened %s attachment's source", type => {
    const body = MEDIA_PREFIX + JSON.stringify({ type, src, caption: "", mode: "file" });
    expect(retainChatPreviewContent(body)).toBe(body);
    expect(resolveChatListPreviewMetaCached(body)).toMatchObject({ kind: type, thumbUrl: src, thumbKind: type });
  });

  it("keeps video notes available as circular previews", () => {
    const body = MEDIA_PREFIX + JSON.stringify({ type: "video", src, mode: "note", durationMs: 1000 });
    expect(resolveChatListPreviewMetaCached(retainChatPreviewContent(body))).toMatchObject({ kind: "video_note", thumbUrl: src, thumbKind: "video" });
  });

  it.each(["image", "video"])("uses the first %s in an album", kind => {
    const body = MEDIA_PREFIX + JSON.stringify({ type: "album", items: [{ src, kind }, { src: "/media/second.jpg", kind: "image" }], caption: "" });
    const forwarded = serializeForwardedContent(body, { name: "Author", link: "author" });
    expect(retainChatPreviewContent(forwarded)).toBe(forwarded);
    expect(resolveChatListPreviewMetaCached(forwarded)).toMatchObject({ kind: "album", thumbUrl: src, thumbKind: kind });
  });
});
