import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { P2PCallConnection } from "@/lib/calls";
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./http", () => ({ apiRequest: mock.api }));
import { createP2PSignaling } from "./call-p2p-signaling";
import { CALL_SIGNAL_HINT_EVENT } from "@/lib/call-signaling";

const connection: P2PCallConnection = { transport: "p2p", callId: "call-a", clientId: "client-a", selfId: "alice", peerId: "bob", identity: "alice", peerIdentity: "bob", polite: false,
  iceServers: [], iceTransportPolicy: "all", turnExpiresAt: Date.now() + 1800_000, relayConfigured: false };
beforeEach(() => { vi.useFakeTimers(); mock.api.mockReset(); vi.stubGlobal("window", new EventTarget()); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("serializes SDP/ICE and retries a timed-out POST with the same idempotency ID", async () => {
  const signaling = createP2PSignaling(connection);
  mock.api.mockRejectedValueOnce(new Error("temporary timeout")).mockResolvedValue(undefined);
  const first = signaling.send({ type: "ready" }), second = signaling.send({ type: "media", state: { microphone: true, camera: false, screen: false, screenAudio: false } });
  await vi.advanceTimersByTimeAsync(1);
  expect(mock.api).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(250); await Promise.all([first, second]);
  const inputs = mock.api.mock.calls.map(([, init]) => JSON.parse(init.body));
  expect(inputs.map(input => input.payload.type)).toEqual(["ready", "ready", "media"]);
  expect(inputs[0].id).toBe(inputs[1].id); expect(inputs[2].id).not.toBe(inputs[0].id);
  expect(new Set(inputs.map(input => input.epoch)).size).toBe(1);
  signaling.close();
});

it("filters other-call hints, advances cursors only for the authorized inbox and removes listeners on close", async () => {
  const signaling = createP2PSignaling(connection), receive = vi.fn(async () => {});
  mock.api.mockResolvedValue({ cursor: 4, reset: false, messages: [{ sequence: 4 }] });
  signaling.start(receive, vi.fn(), vi.fn(), () => true);
  await vi.advanceTimersByTimeAsync(1); expect(receive).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new CustomEvent(CALL_SIGNAL_HINT_EVENT, { detail: { id: "another-call" } }));
  await vi.advanceTimersByTimeAsync(1); expect(mock.api).toHaveBeenCalledTimes(1);
  mock.api.mockResolvedValue({ cursor: 4, reset: false, messages: [] });
  window.dispatchEvent(new CustomEvent(CALL_SIGNAL_HINT_EVENT, { detail: { id: connection.callId } }));
  await vi.advanceTimersByTimeAsync(1);
  expect(mock.api.mock.calls[1][0]).toContain("after=4");
  const signal = mock.api.mock.calls[1][1].signal as AbortSignal;
  signaling.close(); expect(signal.aborted).toBe(true);
  window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(30_000);
  expect(mock.api).toHaveBeenCalledTimes(2);
});

it("requests renegotiation after a missing interval without replaying retained stale SDP", async () => {
  const signaling = createP2PSignaling(connection), receive = vi.fn(async () => {}), reset = vi.fn();
  mock.api.mockResolvedValue({ cursor: 80, reset: true, messages: [{ sequence: 79 }, { sequence: 80 }] });
  signaling.start(receive, reset, vi.fn(), () => false);
  await vi.advanceTimersByTimeAsync(1);
  expect(reset).toHaveBeenCalledTimes(1); expect(receive).not.toHaveBeenCalled();
  mock.api.mockResolvedValue({ cursor: 80, reset: false, messages: [] });
  await vi.advanceTimersByTimeAsync(650);
  expect(mock.api.mock.calls[1][0]).toContain("after=80"); signaling.close();
});
