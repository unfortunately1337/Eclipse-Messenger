import { expect, it } from "vitest";
import { messageNotificationPreview as preview } from "./message-notification-preview";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const worker: Record<string, unknown> = {};
const source = readFileSync("public/service-worker.js", "utf8").split("// END notification preview (generated)")[0];
runInNewContext(source, worker);
const workerPreview = worker.messageNotificationPreview as typeof preview;
const sticker = "__eclipse_media__:" + JSON.stringify({ type: "sticker", src: "/media/private", emoji: "😻" });
for (const format of [preview, workerPreview]) {
  it("formats stickers, structured payloads and custom emoji as notification text", () => {
    expect(format(sticker, "ru")).toBe("😻 Стикер");
    expect(format({ type: "sticker", emoji: "👍" }, "en")).toBe("👍 Sticker");
    expect(format("__eclipse_forward__:" + JSON.stringify({ content: sticker }), "ru")).toBe("😻 Стикер");
    expect(format("Hi \uE000tg-" + "a".repeat(24) + "\uE001", "en", () => "😻")).toBe("Hi 😻");
    expect(format({ notText: true }, "ru")).toBe("Новое сообщение");
    expect(format("[object Object]", "en")).toBe("New message");
    expect(format("__eclipse_media__:broken", "ru")).toBe("Новое сообщение");
  });
}
