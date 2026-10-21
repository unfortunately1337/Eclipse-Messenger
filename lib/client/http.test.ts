import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/client/e2e", () => ({ clearLocalE2EIdentity: vi.fn() }));
vi.mock("@/lib/client/e2e-server-sync", () => ({ invalidateE2EServerStateCache: vi.fn() }));
vi.mock("@/lib/client/user-cache", () => ({ clearUserCaches: vi.fn() }));
import { apiRequest } from "./http";
beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "http://localhost", pathname: "/app", assign: vi.fn() } });
  vi.stubGlobal("document", { cookie: "eclipse.csrf=test-token" });
});
afterEach(() => vi.unstubAllGlobals());
const ok = () => Response.json({ ok: true, data: { saved: true } });

it("silently cancels background session probes on the login screen", async () => {
  window.location.pathname = "/login";
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: false, error: "Требуется авторизация" }, { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  await expect(apiRequest("/api/auth/me")).rejects.toMatchObject({ name: "AbortError", message: "" });
  expect(fetch).toHaveBeenCalledOnce();
  expect(window.location.assign).not.toHaveBeenCalled();
});

it("does not log out a valid session when a resource rejects a request", async () => {
  const fetch = vi.fn().mockImplementation(async (url: string) => url === "/api/auth/me"
    ? Response.json({ ok: true, data: { id: "alice" } })
    : Response.json({ ok: false, error: "Proof rejected" }, { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  await expect(apiRequest("/api/private/resource")).rejects.toThrow("Proof rejected");
  expect(window.location.assign).not.toHaveBeenCalled();
  expect(fetch.mock.calls.some(call => call[0] === "/api/auth/logout")).toBe(false);
});

it("discards an old account response instead of updating or logging out the new account", async () => {
  let owner = "alice";
  Object.assign(window, { localStorage: { getItem: () => owner } });
  let finish!: (value: Response) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const request = apiRequest("/api/chats"); owner = "bob";
  finish(Response.json({ ok: false, error: "Требуется авторизация" }, { status: 401 }));
  await expect(request).rejects.toMatchObject({ name: "AbortError", message: "" });
  expect(fetch).toHaveBeenCalledOnce();
  expect(window.location.assign).not.toHaveBeenCalled();
});

it("applies a request deadline even when the caller supplies an abort signal", async () => {
  const caller = new AbortController();
  vi.stubGlobal("fetch", (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal!.addEventListener("abort", () => reject(options.signal!.reason), { once: true });
  }));
  await expect(apiRequest("/api/settings/profile", { signal: caller.signal, timeoutMs: 10 })).rejects.toThrow("Нестабильное соединение");
  expect(caller.signal.aborted).toBe(false);
});

it("preserves caller cancellation", async () => {
  const caller = new AbortController();
  vi.stubGlobal("fetch", (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal!.addEventListener("abort", () => reject(options.signal!.reason), { once: true });
  }));
  const pending = apiRequest("/api/chats", { signal: caller.signal }); caller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

it("shares the first CSRF initialization across simultaneous saves", async () => {
  vi.stubGlobal("document", { cookie: "" });
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url === "/api/auth/csrf") { await new Promise(resolve => setTimeout(resolve, 10)); return Response.json({ ok: true, data: { csrfToken: "shared-token" } }); }
    return ok();
  }); vi.stubGlobal("fetch", fetch);
  await Promise.all(Array.from({ length: 8 }, () => apiRequest("/api/settings/profile", { method: "PATCH", body: "{}" })));
  expect(fetch.mock.calls.filter(call => call[0] === "/api/auth/csrf")).toHaveLength(1);
  expect(fetch.mock.calls.filter(call => call[0] === "/api/settings/profile").every(call => call[1].headers.get("x-csrf-token") === "shared-token")).toBe(true);
});

it.each([
  ["/api/settings/verify-password", "Неверный пароль"],
  ["/api/settings/password", "Текущий пароль неверный"],
  ["/api/settings/totp", "Неверный код подтверждения"],
])("keeps a valid session after a rejected security proof at %s", async (url, error) => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: false, error }, { status: 401 })); vi.stubGlobal("fetch", fetch);
  await expect(apiRequest(url, { method: "POST", body: "{}" })).rejects.toThrow(error);
  expect(fetch).toHaveBeenCalledOnce(); expect(window.location.assign).not.toHaveBeenCalled();
});

it("shares simultaneous profile reads without caching completed responses", async () => {
  const fetch = vi.fn().mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 10)); return ok(); });
  vi.stubGlobal("fetch", fetch);
  await Promise.all(Array.from({ length: 12 }, () => apiRequest("/api/profile/shared")));
  expect(fetch).toHaveBeenCalledOnce();
  await apiRequest("/api/profile/shared");
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("bypasses browser responses from the previous account while preserving simultaneous read sharing", async () => {
  let account = "first";
  const fetch = vi.fn().mockImplementation(async (_url, init: RequestInit) => {
    const current = init.cache === "no-store" ? account : "first";
    await new Promise(resolve => setTimeout(resolve, 5));
    return Response.json({ ok: true, data: { account: current } });
  });
  vi.stubGlobal("fetch", fetch);
  await expect(apiRequest("/api/app/bootstrap?stage=critical")).resolves.toEqual({ account: "first" });
  account = "second";
  await expect(apiRequest("/api/app/bootstrap?stage=critical")).resolves.toEqual({ account: "second" });
  const profiles = await Promise.all([apiRequest("/api/profile/same"), apiRequest("/api/profile/same")]);
  expect(profiles).toEqual([{ account: "second" }, { account: "second" }]);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls.every(call => call[1].cache === "no-store")).toBe(true);
});

it("does not reuse an older read across a save or combine different headers", async () => {
  let resolveRead!: (response: Response) => void;
  const fetch = vi.fn().mockImplementation((_url, options) => options.method === "PATCH"
    ? Promise.resolve(ok()) : new Promise<Response>(resolve => { resolveRead = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const first = apiRequest("/api/settings/profile");
  const resolveFirst = resolveRead;
  await apiRequest("/api/settings/profile", { method: "PATCH", body: "{}" });
  const second = apiRequest("/api/settings/profile");
  const resolveSecond = resolveRead;
  const third = apiRequest("/api/settings/profile", { headers: { "x-view": "different" } });
  resolveFirst(ok()); resolveSecond(ok()); resolveRead(ok());
  await Promise.all([first, second, third]);
  expect(fetch).toHaveBeenCalledTimes(4);
});

it("retries a failed informational read instead of retaining a rejected promise", async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(ok());
  vi.stubGlobal("fetch", fetch);
  await expect(apiRequest("/api/profile/retry")).rejects.toThrow("offline");
  await expect(apiRequest("/api/profile/retry")).resolves.toEqual({ saved: true });
  expect(fetch).toHaveBeenCalledTimes(2);
});
