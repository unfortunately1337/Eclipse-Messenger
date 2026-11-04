import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { callIceConfiguration, p2pCallsConfigured } from "./call-ice";

afterEach(() => vi.unstubAllEnvs());
it("issues per-call/user expiring coturn credentials, never the shared secret", () => {
  vi.stubEnv("WEBRTC_TURN_SECRET", "a".repeat(48));
  vi.stubEnv("WEBRTC_TURN_URLS", "turn:example.com:3478?transport=udp,turns:example.com:5349?transport=tcp");
  const a = callIceConfiguration("call-a", "user-a", 1_000_000);
  const b = callIceConfiguration("call-b", "user-a", 1_000_000);
  const turn = a.iceServers.at(-1)!;
  expect(turn.username).not.toBe(b.iceServers.at(-1)!.username);
  expect(turn.username).toMatch(/^2800:[a-f0-9]{32}$/);
  expect(turn.credential).toBe(createHmac("sha1", "a".repeat(48)).update(turn.username!).digest("base64"));
  expect(JSON.stringify(a)).not.toContain("a".repeat(48));
  expect(a.turnExpiresAt).toBe(2_800_000);
});
it("fails closed for missing/malformed production relay and supports explicit TURN-only", () => {
  vi.stubEnv("NODE_ENV", "production");vi.stubEnv("WEBRTC_TURN_URLS", "");vi.stubEnv("WEBRTC_TURN_SECRET", "");
  expect(() => callIceConfiguration("a", "b")).toThrow();
  vi.stubEnv("CALLS_DIRECT_TRANSPORT", "p2p");expect(p2pCallsConfigured()).toBe(false);
  vi.stubEnv("WEBRTC_TURN_SECRET", "s".repeat(48));vi.stubEnv("WEBRTC_TURN_URLS", "https://user:secret@example.com");
  expect(() => callIceConfiguration("a", "b")).toThrow();
  vi.stubEnv("WEBRTC_TURN_URLS", "turn:example.com:3478?transport=udp");vi.stubEnv("WEBRTC_ICE_TRANSPORT_POLICY", "relay");
  expect(callIceConfiguration("a", "b").iceTransportPolicy).toBe("relay");
});
it.each(["turn:", "turn:host:70000", "turn:host:0", "turn:host/path", "turn:user@host", "turns:host?transport=udp", "turn:host?transport=https"])("rejects invalid ICE URL %s", url => {
  vi.stubEnv("WEBRTC_TURN_SECRET", "s".repeat(48)); vi.stubEnv("WEBRTC_TURN_URLS", url);
  expect(() => callIceConfiguration("a", "b")).toThrow();
});
