import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const handler = vi.hoisted(() => vi.fn(async (_request: NextRequest) => Response.json({ ok: true, data: { imported: true } })));
vi.mock("@/lib/server/pack-importer-bot", () => ({ handleImporterMessage: handler }));
import { POST as messages } from "./route";
import { POST as start } from "../start/route";
const params = { params: Promise.resolve({ link: "importbot" }) };
it("routes importer messages through the built-in handler instead of the managed-bot lookup", async () => {
  const request = new NextRequest("http://localhost/api/bots/importbot/messages", { method: "POST", body: JSON.stringify({ requestId: crypto.randomUUID(), text: "/emoji" }) });
  expect((await messages(request, params)).status).toBe(200);
  expect(handler).toHaveBeenLastCalledWith(request);
});
it("starts the same built-in bot through the normal Start button endpoint", async () => {
  const request = new NextRequest("http://localhost/api/bots/importbot/start", { method: "POST", body: JSON.stringify({ requestId: crypto.randomUUID() }) });
  expect((await start(request, params)).status).toBe(200);
  expect(await handler.mock.lastCall![0].json()).toMatchObject({ text: "/start" });
});
