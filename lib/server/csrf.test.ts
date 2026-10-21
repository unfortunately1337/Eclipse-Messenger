import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyCsrf } from "./csrf";
import { CSRF_COOKIE_NAME } from "./constants";

afterEach(() => vi.unstubAllEnvs());
function request(origin?: string, site?: string, header = "token") {
  return new NextRequest("https://eclpse.ru/api/settings/profile", { method: "PATCH", headers: {
    cookie: `${CSRF_COOKIE_NAME}=token`, "x-csrf-token": header,
    ...(origin ? { origin } : {}), ...(site ? { "sec-fetch-site": site } : {}),
  } });
}
it("rejects foreign origins even with a matching injected double-submit cookie", () => {
  expect(() => verifyCsrf(request("https://evil.test"))).toThrow();
  expect(() => verifyCsrf(request("null"))).toThrow();
  expect(() => verifyCsrf(request(undefined, "cross-site"))).toThrow();
});
it("accepts same-origin and explicitly trusted CORS clients while still checking their token", () => {
  expect(() => verifyCsrf(request("https://eclpse.ru"))).not.toThrow();
  vi.stubEnv("ALLOWED_ORIGINS", "https://client.example.org");
  expect(() => verifyCsrf(request("https://client.example.org"))).not.toThrow();
  expect(() => verifyCsrf(request("https://client.example.org", undefined, "wrong"))).toThrow();
  expect(() => verifyCsrf(request())).not.toThrow();
});

function proxiedRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://0.0.0.0:3000/api/auth/register/step-1", {
    method: "POST",
    headers: {
      host: "eclpse.ru", "x-forwarded-proto": "https", origin: "https://eclpse.ru",
      cookie: `${CSRF_COOKIE_NAME}=token`, "x-csrf-token": "token", ...headers,
    },
  });
}

it("accepts HTTPS requests behind a TLS proxy with an internal Next URL", () => {
  expect(() => verifyCsrf(proxiedRequest())).not.toThrow();
  expect(() => verifyCsrf(proxiedRequest({ "x-forwarded-proto": "https, http" }))).not.toThrow();
  expect(() => verifyCsrf(proxiedRequest({ host: "eclpse.ru:443" }))).not.toThrow();
});

it("still rejects missing and mismatched double-submit tokens behind the proxy", () => {
  expect(() => verifyCsrf(proxiedRequest({ cookie: "" }))).toThrow();
  expect(() => verifyCsrf(proxiedRequest({ "x-csrf-token": "" }))).toThrow();
  expect(() => verifyCsrf(proxiedRequest({ "x-csrf-token": "wrong" }))).toThrow();
});

it("rejects foreign, downgraded, internal and wrong-port origins behind the proxy", () => {
  for (const origin of ["https://evil.test", "null", "http://eclpse.ru", "http://0.0.0.0:3000", "https://eclpse.ru:444"]) {
    expect(() => verifyCsrf(proxiedRequest({ origin }))).toThrow();
  }
});

it("does not trust an arbitrary forwarded host supplied by the client", () => {
  expect(() => verifyCsrf(proxiedRequest({ origin: "https://evil.test", "x-forwarded-host": "evil.test" }))).toThrow();
});

it("rejects malformed proxy authorities and protocols", () => {
  for (const host of ["evil.test@eclpse.ru", "eclpse.ru/ignored", "eclpse.ru,evil.test", "eclpse.ru#ignored"]) {
    expect(() => verifyCsrf(proxiedRequest({ host }))).toThrow();
  }
  expect(() => verifyCsrf(proxiedRequest({ "x-forwarded-proto": "ftp" }))).toThrow();
});

it("supports an explicit public origin when a proxy rewrites Host", () => {
  vi.stubEnv("ALLOWED_ORIGINS", "https://eclpse.ru");
  expect(() => verifyCsrf(proxiedRequest({ host: "eclipse-internal:3000" }))).not.toThrow();
  expect(() => verifyCsrf(proxiedRequest({ host: "eclipse-internal:3000", "x-csrf-token": "wrong" }))).toThrow();
});
