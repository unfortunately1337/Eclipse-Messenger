import { describe, expect, it } from "vitest";
import { serializeForwardedContent } from "@/lib/client/message-forwarding";
import { MEDIA_PREFIX } from "../chat-message-transport";
import { buildEditedMessagePayload, canEditMessage, getEmojisInfo, parseMessageContentCached } from "./message-content";
import type { DecryptedMessage } from "../types";

describe("message rendering across extracted chat surfaces", () => {
  it("allows editing a recent own text but never a call history record", () => {
    const message: DecryptedMessage = { id: "call:call", senderId: "self", text: "Call", createdAt: new Date().toISOString() };
    const parsed = parseMessageContentCached(message.text);
    expect(canEditMessage(message, parsed, true)).toBe(true);
    message.systemPayload = { eventType: "call", title: "Call", body: "", metadata: { call: { id: "call", callerId: "self", calleeId: "peer", mode: "audio", status: "ended", outcome: "completed", durationSeconds: 35, startedAt: 1, endedAt: 2 } } };
    expect(canEditMessage(message, parsed, true)).toBe(false);
  });
  it("keeps a forwarded video's caption, encrypted URL and playback mode", () => {
    const src = "/media/example.bin#eclipse-e2e=opaque-envelope";
    const content = MEDIA_PREFIX + JSON.stringify({
      type: "video", src, caption: "Привет 😻", durationMs: 12000, mode: "file",
    });
    const forwarded = serializeForwardedContent(content, {
      name: "Eclipse", link: "eclipse", kind: "channel",
    });
    expect(parseMessageContentCached(forwarded, false)).toMatchObject({
      kind: "video", src, caption: "Привет 😻", durationMs: 12000, mode: "file",
    });
  });

  it("preserves music metadata when editing only the caption", () => {
    const content = buildEditedMessagePayload({
      id: "music", kind: "music", url: "/media/song.mp3", title: "Song",
      author: "Artist", coverUrl: "/media/cover.jpg", durationMs: 90000,
    }, "  Новая подпись 🎵  ");
    expect(parseMessageContentCached(content)).toMatchObject({
      kind: "music", url: "/media/song.mp3", title: "Song", author: "Artist",
      coverUrl: "/media/cover.jpg", caption: "Новая подпись 🎵", durationMs: 90000,
    });
  });

  it("doesn't reuse an old parsed caption after the same message is edited", () => {
    const make = (caption: string) => MEDIA_PREFIX + JSON.stringify({ type: "image", src: "/media/image.jpg", caption });
    expect(parseMessageContentCached(make("До"))).toMatchObject({ caption: "До" });
    expect(parseMessageContentCached(make("После 😻"))).toMatchObject({ caption: "После 😻" });
  });

  it("treats family emoji and skin-tone sequences as whole graphemes", () => {
    expect(getEmojisInfo("👨‍👩‍👧‍👦 👍🏽")).toEqual({ isOnly: true, count: 2 });
    expect(getEmojisInfo("Привет 👍🏽")).toEqual({ isOnly: false, count: 0 });
  });
});
