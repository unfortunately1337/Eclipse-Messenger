import { expect, it } from "vitest";
import { readJsonBody } from "./request-body";

it("limits authentication JSON before parsing and returns a client error for malformed JSON", async () => {
  const request = (body: string) => new Request("http://localhost/", { method: "POST", body });
  expect(await readJsonBody(request('{"ok":true}'))).toEqual({ ok: true });
  await expect(readJsonBody(request('{'))).rejects.toMatchObject({ status: 400 });
  await expect(readJsonBody(request(' '.repeat(100)), 10)).rejects.toMatchObject({ status: 413 });
});
