import { expect, it } from "vitest";
import { getPresenceStatusText } from "./presence-status";
it("shows recently for everyone offline regardless of visit time or privacy choice", () => {
  for (const visible of [true, false]) for (const timestamp of [-1, 0, 1, Date.now(), Date.now() - 60_000, Date.now() - 90 * 86_400_000]) {
    expect(getPresenceStatusText("peer", new Set(), { peer: timestamp }, Date.now(), visible, visible)).toBe("был(а) недавно");
  }
});
it("shows online for server-authorized interaction even when old profile flags hide activity", () => {
  for (const visible of [true, false]) expect(getPresenceStatusText("peer", new Set(["peer"]), { peer: -1 }, Date.now(), visible, visible)).toBe("в сети");
  expect(getPresenceStatusText(undefined, new Set(), {}, Date.now())).toBe("не в сети");
});
