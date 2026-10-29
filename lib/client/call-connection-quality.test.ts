import { describe, expect, it } from "vitest";
import { callConnectionSignal } from "./call-connection-quality";

describe("real call signal", () => {
  it("uses the worse media link without inventing bars for unknown quality", () => {
    expect(callConnectionSignal("connected", ["unknown", "unknown"])).toEqual({ bars: 0, state: "unknown" });
    expect(callConnectionSignal("connected", ["excellent", "good"])).toEqual({ bars: 3, state: "good" });
    expect(callConnectionSignal("connected", ["excellent", "poor"])).toEqual({ bars: 1, state: "poor" });
    expect(callConnectionSignal("connected", ["lost", "excellent"])).toEqual({ bars: 0, state: "lost" });
  });
  it("does not retain a previous excellent signal during reconnect or after hangup", () => {
    for (const state of ["reconnecting", "signalReconnecting"]) {
      expect(callConnectionSignal(state, ["excellent"])).toEqual({ bars: 0, state: "reconnecting" });
    }
    expect(callConnectionSignal("connected", ["excellent"], true)).toEqual({ bars: 0, state: "unknown" });
    expect(callConnectionSignal("connecting", ["excellent"])).toEqual({ bars: 0, state: "unknown" });
  });
});
