import { expect, it } from "vitest";
import { groupVoiceChannel, groupVoiceLevels } from "./group-call-voice";
it("keeps our wave blue and assigns peers stable colors from the other three channels", () => {
  expect(groupVoiceChannel("call", "self", true)).toBe(0);
  const colors = Array.from({ length: 40 }, (_, index) => groupVoiceChannel("call", String(index), false));
  expect(new Set(colors)).toEqual(new Set([1, 2, 3]));
  expect(groupVoiceChannel("call", "peer", false)).toBe(groupVoiceChannel("call", "peer", false));
});
it("bounds rendering to four wave layers even with many speakers and rejects invalid levels", () => {
  const samples = Array.from({ length: 100 }, (_, index) => ({ id: String(index), local: index === 0, level: index === 0 ? .7 : .4 }));
  expect(groupVoiceLevels("call", samples)).toEqual([.7, .4, .4, .4]);
  expect(groupVoiceLevels("call", [{ id: "self", local: true, level: NaN }, { id: "bad", local: false, level: -1 }])).toEqual([0, 0, 0, 0]);
});
