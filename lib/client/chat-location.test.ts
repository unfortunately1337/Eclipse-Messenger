import { expect, it } from "vitest";
import { chatIdFromLocation, withoutChatLocation } from "./chat-location";

it("recognizes current and legacy chat links, including query-only navigation", () => {
  expect(chatIdFromLocation("/app", "?chat=Alice&chatType=direct")).toBe("alice");
  expect(chatIdFromLocation("/app", "?chat=bob&chatType=group")).toBe("bob");
  expect(chatIdFromLocation("/chat/Alice")).toBe("alice");
  expect(chatIdFromLocation("/app", "?chat=%20Alice%20")).toBe("alice");
  expect(chatIdFromLocation("/settings", "?chat=alice")).toBeNull();
  expect(chatIdFromLocation("/chat/%invalid")).toBeNull();
  expect(chatIdFromLocation("/app", "?chat= ")).toBeNull();
});

it("clears an unavailable chat before selection resets without losing other URL state", () => {
  const next = withoutChatLocation("/app", "?chat=missing&chatType=direct&folder=work");
  expect(next).toBe("/app?folder=work");
  expect(chatIdFromLocation("/app", next.split("?")[1])).toBeNull();
  expect(withoutChatLocation("/app", "?chat=missing&chatType=channel")).toBe("/app");
});
