import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ verify: vi.fn(), enqueue: vi.fn() }));
vi.mock("@/lib/server/telegram-import-receiver", () => ({ verifyTelegramImporterWebhook: fake.verify, enqueueTelegramImportUpdate: fake.enqueue }));
import { HttpError } from "@/lib/server/http";
import { POST } from "./route";
beforeEach(() => vi.resetAllMocks());
it("does not read or persist an unauthenticated update", async () => {
  fake.verify.mockImplementation(() => { throw new HttpError(403, "Forbidden"); });
  const result = await POST(new NextRequest("https://eclpse.ru/api/telegram/importer/webhook", { method: "POST", body: "not json" }));
  expect(result.status).toBe(403); expect(fake.enqueue).not.toHaveBeenCalled();
});
it("acknowledges only after the update is durably queued", async () => {
  const result = await POST(new NextRequest("https://eclpse.ru/api/telegram/importer/webhook", { method: "POST", body: JSON.stringify({ update_id: 1 }) }));
  expect(result.status).toBe(200); expect(fake.enqueue).toHaveBeenCalledWith({ update_id: 1 });
});
it("asks Telegram to retry after storage failures without exposing internals", async () => {
  fake.enqueue.mockRejectedValue(new Error("database credential"));
  const result = await POST(new NextRequest("https://eclpse.ru/api/telegram/importer/webhook", { method: "POST", body: JSON.stringify({ update_id: 1 }) }));
  expect(result.status).toBe(503); expect(await result.text()).not.toContain("credential");
});
