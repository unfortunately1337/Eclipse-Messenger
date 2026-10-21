import { expect, it } from "vitest";
import { directChatProfileLink, matchesOrdinaryDirectChat } from "./direct-chat-summary";

const target = { requestedLink: "old-name", canonicalLink: "new-name", peerId: "peer" };
it("matches ordinary dialogs by peer or renamed username", () => {
  expect(matchesOrdinaryDirectChat({ peerId: "peer", link: "older-name" }, target)).toBe(true);
  expect(matchesOrdinaryDirectChat({ chatType: "direct", link: "new-name" }, target)).toBe(true);
  expect(matchesOrdinaryDirectChat({ link: "old-name" }, target)).toBe(true);
  expect(matchesOrdinaryDirectChat({ peerId: "other", link: "other" }, target)).toBe(false);
});
it("never rewrites or removes a secret dialog with the same peer", () => {
  for (const secret of [{ link: "secret-one" }, { conversationId: "secret:two", link: "new-name" }]) {
    expect(matchesOrdinaryDirectChat({ chatType: "direct", peerId: "peer", ...secret }, target)).toBe(false);
  }
  expect(matchesOrdinaryDirectChat({ chatType: "group", peerId: "peer", link: "new-name" }, target)).toBe(false);
});
it("preserves secret routes when a profile refresh or rename is broadcast", () => {
  expect(directChatProfileLink({ link: "secret-one", peerId: "peer" }, "new-name")).toBe("secret-one");
  expect(directChatProfileLink({ link: "secret-two", conversationId: "secret:two" }, "new-name")).toBe("secret-two");
  expect(directChatProfileLink({ link: "old-name" }, "new-name")).toBe("new-name");
});
