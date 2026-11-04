import { expect, it } from "vitest";
import { p2pEncoding, p2pQuality } from "./call-p2p-quality";
it("reserves fluent 720p/30 camera and detailed screen up to 45 fps on healthy links", () => {
  expect(p2pQuality({ rtt: .05, loss: .001, availableBitrate: 8e6 })).toBe("high");
  expect(p2pEncoding("high", false)).toEqual({ maxBitrate: 2_500_000, maxFramerate: 30, scaleResolutionDownBy: 1 });
  expect(p2pEncoding("high", true).maxFramerate).toBe(45);
  expect(p2pEncoding("high", false, true).maxBitrate).toBeLessThan(p2pEncoding("high", false).maxBitrate);
});
it("adapts both loss and latency while keeping screen text sharp before lowering resolution", () => {
  expect(p2pQuality({ rtt: .8, loss: 0 })).toBe("low");
  expect(p2pQuality({ rtt: .05, loss: .1 })).toBe("low");
  expect(p2pQuality({ rtt: .05, loss: .04 })).toBe("medium");
  expect(p2pEncoding("medium", true).scaleResolutionDownBy).toBe(1);
});
