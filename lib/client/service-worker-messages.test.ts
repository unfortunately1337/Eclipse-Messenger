import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

const script = readFileSync("public/service-worker.js", "utf8");
type Client = { id: string; url: string; visibilityState: string };
function setup() {
  const events = new Map<string, (event: unknown) => void>();
  const shown: unknown[] = [];
  let clients: Client[] = [];
  let fetchPayload: () => Promise<Response> = async () => Response.json({ ok: true, data: { alreadyRead: false } });
  runInNewContext(script, {
    self: {
      location: { origin: "https://eclpse.ru" },
      clients: { matchAll: async () => clients, claim() {} }, skipWaiting() {},
      addEventListener: (name: string, fn: (event: unknown) => void) => events.set(name, fn),
      registration: { showNotification: async (...args: unknown[]) => { shown.push(args); } },
    },
    caches: { open: async () => ({ match: async () => null }) },
    fetch: () => fetchPayload(), URL, Response, Map, Set, Date, Promise, Uint8Array, TextDecoder, console,
  });
  return {
    shown,
    clients: (next: Client[]) => { clients = next; },
    fetch: (next: typeof fetchPayload) => { fetchPayload = next; },
    state: (id: string, activeChatId: string | null, visibility = "visible") => events.get("message")!({
      source: { id }, data: { type: "APP_STATE", payload: { activeChatId, visibility, ts: Date.now() } },
    }),
    push: async () => {
      let done: Promise<unknown> | undefined;
      events.get("push")!({
        data: { json: () => ({ web: { data: { messageId: "message", chatId: "alice", senderName: "Alice", text: "hello" } } }) },
        waitUntil: (work: Promise<unknown>) => { done = work; },
      });
      await done;
    },
  };
}
const client = (visibilityState = "visible", chat = "alice"): Client => ({ id: "tab", visibilityState, url: `https://eclpse.ru/app?chat=${chat}&chatType=direct` });
it("does not push for the open chat using current query URLs, even after a worker restart", async () => {
  const sw = setup(); sw.clients([client()]); await sw.push(); expect(sw.shown).toHaveLength(0);
});
it("still pushes for other chats and hidden windows", async () => {
  for (const window of [client("visible", "bob"), client("hidden")]) {
    const sw = setup(); sw.clients([window]); await sw.push(); expect(sw.shown).toHaveLength(1);
  }
});
it("does not mistake stale visible state for a tab that is now hidden", async () => {
  const sw = setup(); sw.clients([client("hidden")]); sw.state("tab", "alice");
  await sw.push(); expect(sw.shown).toHaveLength(1);
});
it("uses the latest app state instead of the old URL after switching chats", async () => {
  const sw = setup(); sw.clients([client()]); sw.state("tab", "bob");
  await sw.push(); expect(sw.shown).toHaveLength(1);
});
it("recognizes the API response envelope when a message was read on another device", async () => {
  const sw = setup(); sw.fetch(async () => Response.json({ ok: true, data: { alreadyRead: true } }));
  await sw.push(); expect(sw.shown).toHaveLength(0);
});
it("rechecks visibility after fetching the payload to avoid a late notification", async () => {
  const sw = setup();
  sw.fetch(async () => { sw.clients([client()]); return Response.json({ ok: true, data: { alreadyRead: false } }); });
  await sw.push(); expect(sw.shown).toHaveLength(0);
});
it("does not duplicate a message notification", async () => {
  const sw = setup(); await sw.push(); await sw.push(); expect(sw.shown).toHaveLength(1);
});
