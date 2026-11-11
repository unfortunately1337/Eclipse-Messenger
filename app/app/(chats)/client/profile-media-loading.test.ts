import { expect, it, vi } from "vitest";
import { chatSharedMediaListAction, chatSharedVoiceListAction, type ChatSharedMediaListActionContext, type ChatSharedVoiceListActionContext } from "./conversation-selectors";

vi.mock("@/lib/client/media-crypto", () => ({ resolveMessageMedia: (value: { kind: string }) => ({ ...value, src: "" }) }));

const payload = (data: object) => "__eclipse_media__:" + JSON.stringify(data);
function context(texts: string[], tab = "media") {
  return { profileMediaVisible: true, profileActiveTab: tab, selfId: "self", selfProfile: null,
    messages: texts.map((text, index) => ({ id: `message-${index}`, senderId: "self", text, createdAt: "2026-11-11T09:41:00Z" })),
    activeConversation: { chatType: "saved" }, groupMembersById: new Map(), readProfileFromCache: () => null,
    contactsForAdd: [], activeChat: { link: "saved" }, selectedLink: "saved", activeTitle: "Saved", t: (text: string) => text } as unknown as ChatSharedMediaListActionContext;
}

it("keeps photos, videos and album cells in their original order before their downloads finish", () => {
  const source = "/media/pending-photo.png", preview = "data:image/jpeg;base64,/9j/2Q==";
  const state = context([
    payload({ type: "image", src: source, preview }),
    payload({ type: "video", src: "/media/pending-video.mp4", mode: "file" }),
    payload({ type: "album", items: [{ src: "/media/album-photo.png", kind: "image", preview }, { src: "/media/album-video.mp4", kind: "video" }] }),
  ]);
  const items = chatSharedMediaListAction(state);
  expect(items.map(item => item.src)).toEqual([source, "/media/pending-video.mp4", "/media/album-photo.png", "/media/album-video.mp4"]);
  expect(items.map(item => item.id)).toEqual(["message-0-img", "message-1-vid", "message-2-alb-0", "message-2-alb-1"]);
  expect(items[0].preview).toBe(preview);
  expect(items[2].preview).toBe(preview);
});

it("keeps a pending voice row instead of making it appear only after decryption", () => {
  const state = context([payload({ type: "voice", src: "/media/pending-voice.webm", durationMs: 5000 })], "voice");
  const items = chatSharedVoiceListAction(state as unknown as ChatSharedVoiceListActionContext);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: "message-0-voice", durationMs: 5000, src: "" });
});
