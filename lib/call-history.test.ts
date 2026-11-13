import { describe, expect, it } from "vitest";
import { callMessageTitle, formatCallDuration, formatGroupCallDuration, readCallMessage, type CallMessageData } from "./call-history";

const call: CallMessageData = { id: "test", callerId: "alice", calleeId: "bob", mode: "audio", status: "ended", outcome: "completed", startedAt: 1000, endedAt: 66_000, durationSeconds: 65 };

describe("call history presentation", () => {
  it("formats group service durations in the viewer's language", () => {
    expect(formatGroupCallDuration(4320, "ru")).toBe("1 час 12 минут");
    expect(formatGroupCallDuration(3600, "ru")).toBe("1 час");
    expect(formatGroupCallDuration(120, "ru")).toBe("2 минуты");
    expect(formatGroupCallDuration(8, "ru")).toBe("8 секунд");
    expect(formatGroupCallDuration(4320, "en")).toBe("1 hour 12 minutes");
    expect(formatGroupCallDuration(NaN, "ru")).toBe("0 секунд");
  });
  it("resolves the same persisted call relative to each participant", () => {
    expect(callMessageTitle(call, "alice")).toBe("Исходящий звонок");
    expect(callMessageTitle(call, "bob")).toBe("Входящий вызов");
    expect(callMessageTitle({ ...call, outcome: "missed" }, "alice")).toBe("Нет ответа");
    expect(callMessageTitle({ ...call, outcome: "missed" }, "bob")).toBe("Пропущенный звонок");
    expect(callMessageTitle({ ...call, outcome: "cancelled" }, "alice")).toBe("Отменённый звонок");
    expect(callMessageTitle({ ...call, outcome: "declined" }, "bob")).toBe("Отклонённый звонок");
  });
  it("keeps zero-second connected calls and formats calls over an hour", () => {
    expect(formatCallDuration(0)).toBe("0:00");
    expect(formatCallDuration(65)).toBe("1:05");
    expect(formatCallDuration(3661)).toBe("1:01:01");
  });
  it("does not render malformed system messages as calls", () => {
    const payload = { eventType: "call", metadata: { call } };
    expect(readCallMessage(payload)).toEqual(call);
    expect(readCallMessage({ ...payload, eventType: "wallpaper_change" })).toBeNull();
    expect(readCallMessage({ eventType: "call", metadata: { call: { ...call, durationSeconds: -1 } } })).toBeNull();
    expect(readCallMessage(null)).toBeNull();
  });
});
