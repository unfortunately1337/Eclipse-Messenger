import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
const script = readFileSync("public/service-worker.js", "utf8");
function setup(cache = new Map<string, Response>()) {
  const events = new Map<string, (event: { data: { json: () => unknown }; waitUntil: (work: Promise<unknown>) => void }) => void>();
  const shown: Array<{ tag: string; renotify: boolean }> = [], notifications: Array<{ close: () => void }> = [];
  let state = "ringing";
  const storage = { match: async (key: Request | string) => cache.get(typeof key === "string" ? key : key.url)?.clone(), put: async (key: Request, value: Response) => { cache.set(key.url, value.clone()); }, keys: async () => [...cache.keys()].map(key => new Request(key)), delete: async (key: Request) => cache.delete(key.url) };
  runInNewContext(script, {
    self: { location: { origin: "https://example.com" }, clients: { matchAll: async () => [], claim: async () => {} }, skipWaiting() {},
      addEventListener: (name: string, fn: Parameters<typeof events.set>[1]) => events.set(name, fn),
      registration: { getNotifications: async () => notifications, showNotification: async (_title: string, options: { tag: string; renotify: boolean }) => { shown.push(options); notifications.push({ close() { notifications.length = 0; } }); } },
    },
    fetch: async () => Response.json({ ok: true, data: { recipientId: "bob", state, senderName: "Alice", deepLink: "/app?chat=alice&chatType=direct" } }),
    caches: { open: async () => storage }, Response, Request, URL, Map, Set, Date, Promise, Uint8Array, TextDecoder, console,
  });
  return { shown, notifications, cache, state: (value: string) => { state = value; }, push: async () => {
    let done: Promise<unknown> | undefined;
    events.get("push")!({ data: { json: () => ({ web: { data: { type: "call", recipientId: "bob", callId: "00000000-0000-4000-8000-000000000001" } } }) }, waitUntil(value: Promise<unknown>) { done = value; } });
    await done;
  } };
}
it("deduplicates call push across worker restarts and uses one notification tag for missed calls", async () => {
  const first = setup(); await first.push(); await first.push();
  expect(first.shown).toHaveLength(1);
  const restarted = setup(first.cache); await restarted.push(); expect(restarted.shown).toHaveLength(0);
  restarted.state("missed"); await restarted.push(); await restarted.push();
  expect(restarted.shown).toHaveLength(1);
  expect(restarted.shown[0].tag).toBe(first.shown[0].tag);
  expect(restarted.shown[0].renotify).toBe(false);
});
it("dismisses accepted/ended calls and ignores later ringing delivery", async () => {
  const worker = setup(); await worker.push();
  worker.state("closed"); await worker.push(); expect(worker.notifications).toHaveLength(0);
  worker.state("ringing"); await worker.push(); expect(worker.shown).toHaveLength(1);
});
