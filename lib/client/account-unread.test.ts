import { expect, it } from "vitest";
import { formatAccountUnreadCount } from "./account-unread";

it("shows full counts, caps at 9999+, and hides empty counts", () => {
  for (const value of [undefined, 0, -1, NaN, Infinity]) expect(formatAccountUnreadCount(value)).toBeNull();
  for (const value of [1, 14, 1000, 9999]) expect(formatAccountUnreadCount(value)).toBe(String(value));
  expect(formatAccountUnreadCount(10000)).toBe("9999+");
});
