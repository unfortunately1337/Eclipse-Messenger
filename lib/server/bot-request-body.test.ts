import { expect, it } from "vitest";
import { readBotRequestBody } from "./bot-request-body";

it("caps streamed bot requests even without Content-Length", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(8)); controller.enqueue(new Uint8Array(8)); }, cancel() { cancelled = true; } });
  const request = new Request("http://localhost/", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await expect(readBotRequestBody(request, 10)).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true);
});
it("reads bodies within the limit and rejects oversized advertised lengths", async () => {
  const request = new Request("http://localhost/", { method: "POST", body: "hello" });
  expect(new TextDecoder().decode(await readBotRequestBody(request, 5))).toBe("hello");
  await expect(readBotRequestBody(new Request("http://localhost/", { method: "POST", body: "hello", headers: { "content-length": "1000" } }), 5)).rejects.toMatchObject({ status: 413 });
});
