import { afterEach, expect, it, vi } from "vitest";
import { triggerRealtimeEvent, triggerRealtimeChannels } from "./realtime";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("bounds an unavailable notification endpoint so a committed message can return", async () => {
  vi.stubEnv("PUSHER_APP_ID", "isolated-test");
  vi.stubEnv("PUSHER_KEY", "isolated-test");
  vi.stubEnv("PUSHER_SECRET", "isolated-test");
  vi.stubEnv("PUSHER_CLUSTER", "eu");
  vi.stubGlobal("fetch", (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    const signal = options.signal;
    if (!signal) { reject(new Error("Request has no timeout")); return; }
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  await expect(triggerRealtimeEvent({ channel: "private-isolated-test", name: "message:new", data: { id: "test" } }))
    .rejects.toMatchObject({ name: "TimeoutError" });
}, 10_000);

it("batches identical authorized events into at most 100 channels and deduplicates recipients", async () => {
  vi.stubEnv("PUSHER_APP_ID", "isolated-test"); vi.stubEnv("PUSHER_KEY", "key");
  vi.stubEnv("PUSHER_SECRET", "secret"); vi.stubEnv("PUSHER_CLUSTER", "eu");
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await triggerRealtimeChannels({ channels: [...Array.from({ length: 251 }, (_, i) => `private-user-${i}`), "private-user-0"], name: "channel:updated", data: { id: "community" } });
  expect(fetch).toHaveBeenCalledTimes(3);
  const bodies = fetch.mock.calls.map(call => JSON.parse(call[1].body));
  expect(bodies.map(body => body.channels.length)).toEqual([100, 100, 51]);
  expect(new Set(bodies.flatMap(body => body.channels)).size).toBe(251);
  expect(bodies.every(body => JSON.parse(body.data).id === "community")).toBe(true);
});

it("still attempts later recipient batches if a notification batch fails", async () => {
  vi.stubEnv("PUSHER_APP_ID", "isolated-test"); vi.stubEnv("PUSHER_KEY", "key");
  vi.stubEnv("PUSHER_SECRET", "secret"); vi.stubEnv("PUSHER_CLUSTER", "eu");
  const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await expect(triggerRealtimeChannels({ channels: Array.from({ length: 501 }, (_, i) => `private-user-${i}`), name: "channel:updated", data: {} })).rejects.toThrow("Realtime delivery failed");
  expect(fetch).toHaveBeenCalledTimes(6);
});

it("sends an authenticated-hydration event when the UTF-8 message exceeds the transport limit", async () => {
  vi.stubEnv("PUSHER_APP_ID", "isolated-test"); vi.stubEnv("PUSHER_KEY", "key");
  vi.stubEnv("PUSHER_SECRET", "secret"); vi.stubEnv("PUSHER_CLUSTER", "eu");
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })); vi.stubGlobal("fetch", fetch);
  await triggerRealtimeEvent({ channel: "private-user-recipient", name: "message:new", data: { id: "large-message", chatType: "group", groupLink: "group", senderId: "sender", text: "Я".repeat(7_000), createdAt: "now", cipherText: "A".repeat(10_000), iv: "iv" } });
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(Buffer.byteLength(body.data, "utf8")).toBeLessThan(10_240);
  expect(JSON.parse(body.data)).toEqual({ id: "large-message", chatType: "group", groupLink: "group", senderId: "sender", createdAt: "now" });
});
