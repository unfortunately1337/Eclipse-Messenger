import { expect, it } from "vitest";
import { mapConcurrentSettled } from "./concurrent-requests";
it("bounds concurrent work, keeps result order and preserves individual failures", async () => {
  let active = 0, peak = 0;
  const results = await mapConcurrentSettled(Array.from({ length: 20 }, (_, i) => i), 4, async item => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, item % 3));
    active--;
    if (item === 7) throw new Error("denied");
    return item;
  });
  expect(peak).toBe(4);
  expect(results[7]).toMatchObject({ status: "rejected", reason: { message: "denied" } });
  expect(results[19]).toEqual({ status: "fulfilled", value: 19 });
  expect(results).toHaveLength(20);
});
