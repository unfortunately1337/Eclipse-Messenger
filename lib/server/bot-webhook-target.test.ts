import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { isPublicWebhookAddress, resolveWebhookTarget, postBotWebhook } from "./bot-webhook-target";

describe("bot webhook network boundaries", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "192.0.2.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2002:7f00:1::", "2001:db8::1"])("blocks %s", address => expect(isPublicWebhookAddress(address)).toBe(false));
  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("accepts public %s", address => expect(isPublicWebhookAddress(address)).toBe(true));
  it("blocks the IPv6 documentation range 3fff::/20", () => expect(isPublicWebhookAddress("3fff::1")).toBe(false));
  it("rejects mixed public/private DNS answers and non-HTTPS targets", async () => {
    mocks.lookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }, { address: "127.0.0.1", family: 4 }]);
    await expect(resolveWebhookTarget("https://hooks.example.org/")).rejects.toMatchObject({ status: 400 });
    for (const url of ["http://1.1.1.1/", "https://user:pass@1.1.1.1/", "https://1.1.1.1:8443/", "https://1.1.1.1/#secret"]) await expect(resolveWebhookTarget(url)).rejects.toMatchObject({ status: 400 });
  });
  it("pins the validated address and preserves TLS name, path and verification header", async () => {
    mocks.lookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
    mocks.request.mockImplementation((_options, callback) => {
      const req = new EventEmitter() as EventEmitter & { end: (body: Buffer) => void; destroy: (error: Error) => void };
      req.destroy = error => { req.emit("error", error); req.emit("close"); };
      req.end = () => { const response = Object.assign(new EventEmitter(), { statusCode: 204 }); callback(response); queueMicrotask(() => { response.emit("end"); req.emit("close"); }); };
      return req;
    });
    await postBotWebhook("https://hooks.example.org/events?version=1", "a_secret_of_16_chars", { update_id: 7 });
    expect(mocks.request.mock.lastCall?.[0]).toMatchObject({ hostname: "1.1.1.1", servername: "hooks.example.org", path: "/events?version=1", port: 443, agent: false, headers: { Host: "hooks.example.org", "X-Eclipse-Bot-Secret-Token": "a_secret_of_16_chars" } });
  });
  it("does not follow redirects or acknowledge failures", async () => {
    mocks.request.mockImplementation((_options, callback) => {
      const req = new EventEmitter() as EventEmitter & { end: () => void };
      req.end = () => { const response = Object.assign(new EventEmitter(), { statusCode: 302 }); callback(response); queueMicrotask(() => { response.emit("end"); req.emit("close"); }); }; return req;
    });
    await expect(postBotWebhook("https://hooks.example.org/", "a_secret_of_16_chars", {})).rejects.toThrow("HTTP 302");
  });
});
