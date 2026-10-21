"use client";

import { clearLocalE2EIdentity } from "@/lib/client/e2e";
import { invalidateE2EServerStateCache } from "@/lib/client/e2e-server-sync";
import { clearUserCaches } from "@/lib/client/user-cache";

let forcedLogoutInProgress = false;
let csrfInitialization: Promise<string> | null = null;
let sessionValidation: Promise<boolean | null> | null = null;
function activeAccount() {
  try { return window.localStorage?.getItem("eclipse:active-user-id") ?? ""; } catch { return ""; }
}
function cancelledSessionRequest() { return new DOMException("", "AbortError"); }
async function sessionIsStillValid() {
  if (!sessionValidation) {
    sessionValidation = fetch("/api/auth/me", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(10_000) })
      .then(async response => response.status === 401 ? false : response.ok && (await response.json()).ok ? true : null)
      .catch(() => null)
      .finally(() => { sessionValidation = null; });
  }
  return sessionValidation;
}
const pendingInformation = new Map<string, Promise<unknown>>();
if (typeof window !== "undefined") {
  window.addEventListener("eclipse:caches-cleared", () => pendingInformation.clear());
}

function normalizeRequestUrl(inputUrl: string) {
  const trimmed = inputUrl.trim();
  if (!trimmed) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  if (trimmed.startsWith("api/")) {
    return `/${trimmed}`;
  }

  return trimmed;
}

function getPathname(inputUrl: string) {
  try {
    return new URL(inputUrl, window.location.origin).pathname;
  } catch {
    return inputUrl;
  }
}

function isAuthPagePath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  );
}

function shouldForceLogout(pathname: string, error?: string) {
  if (!pathname.startsWith("/api/")) return false;

  // Registration/login screens probe APIs without a session. A 401 there is expected
  // and must not dump the user onto QR login mid-signup.
  if (typeof window !== "undefined" && isAuthPagePath(window.location.pathname)) {
    return false;
  }

  if (pathname === "/api/auth/me") return true;

  // A wrong password or TOTP code does not mean the authenticated session died.
  if (["/api/settings/verify-password", "/api/settings/password", "/api/settings/totp"].includes(pathname) &&
      ["Неверный пароль", "Текущий пароль неверный", "Неверный код подтверждения"].includes(error ?? "")) return false;

  // Do not force-logout on auth entry endpoints where 401 is part of normal UX.
  if (
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/email") ||
    pathname.startsWith("/api/auth/register") ||
    pathname.startsWith("/api/auth/csrf") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/qr") ||
    pathname.startsWith("/api/auth/password-reset")
  ) {
    return false;
  }

  return true;
}

function readCookie(name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfToken() {
  const fromCookie = readCookie("eclipse.csrf");
  if (fromCookie) {
    return fromCookie;
  }

  if (csrfInitialization) return csrfInitialization;
  csrfInitialization = (async () => {
  const res = await fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const payload = await res.json();
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error ?? "Не удалось инициализировать CSRF");
  }

  return payload.data.csrfToken as string;
  })();
  try { return await csrfInitialization; }
  finally { csrfInitialization = null; }
}

export async function forceLogoutAndRedirect() {
  if (forcedLogoutInProgress) return;
  forcedLogoutInProgress = true;

  try {
    const csrfToken = await ensureCsrfToken().catch(() => null);
    const headers = new Headers();
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }

    await fetch("/api/auth/logout", {
      method: "POST",
      headers,
      credentials: "include",
    }).catch(() => null);
  } finally {
    const secretOwner = window.localStorage.getItem("eclipse:active-user-id");
    if (secretOwner) {
      await import("./secret-device-keys").then(module => module.deleteSecretDeviceKeys(secretOwner)).catch(() => {});
    }
    clearLocalE2EIdentity();
    invalidateE2EServerStateCache();
    clearUserCaches();
    const destination = "/login";
    if (window.location.pathname !== destination) {
      window.location.assign(destination);
    }
  }
}

export function apiRequest<T>(
  url: string,
  init?: RequestInit & { skipCsrf?: boolean; timeoutMs?: number },
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") pendingInformation.clear();
  const normalizedUrl = normalizeRequestUrl(url);
  // Share only simultaneous informational reads, never completed responses.
  // Explicit cancellation/reload belongs to that caller and is kept independent.
  const share = method === "GET" && !init?.signal && !init?.body &&
    init?.cache !== "reload" && /^(\/api\/profile\/|\/api\/groups\/|\/api\/channels\/|\/api\/contacts(?:\/|$)|\/api\/settings\/profile(?:\?|$))/.test(normalizedUrl);
  if (!share) return performApiRequest<T>(url, init);
  const key = JSON.stringify([activeAccount(), normalizedUrl, [...new Headers(init?.headers).entries()].sort(), init?.cache, init?.mode, init?.redirect, init?.timeoutMs]);
  const existing = pendingInformation.get(key);
  if (existing) return existing as Promise<T>;
  const pending = performApiRequest<T>(url, init).finally(() => {
    if (pendingInformation.get(key) === pending) pendingInformation.delete(key);
  });
  pendingInformation.set(key, pending);
  return pending;
}

async function performApiRequest<T>(
  url: string,
  init?: RequestInit & { skipCsrf?: boolean; timeoutMs?: number },
) {
  const requestAccount = activeAccount();
  const startedOnAuthPage = typeof window !== "undefined" && isAuthPagePath(window.location.pathname);
  const normalizedUrl = normalizeRequestUrl(url);
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  const timeoutMs =
    init?.timeoutMs ?? (method === "GET" || method === "HEAD" ? 30_000 : 60_000);
  const controller = new AbortController();
  const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  const timeoutId =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
  if (method !== "GET" && method !== "HEAD" && !init?.skipCsrf) {
    const csrfToken = await ensureCsrfToken();
    headers.set("X-CSRF-Token", csrfToken);
  }

  if (init?.body && !headers.has("Content-Type")) {
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (!isFormData) {
      headers.set("Content-Type", "application/json");
    }
  }

  let res: Response;
  try {
    res = await fetch(normalizedUrl, {
      ...init,
      headers,
      credentials: "include",
      cache: method === "GET" || method === "HEAD" ? (init?.cache ?? "no-store") : init?.cache,
      signal,
    });
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      if (init?.signal?.aborted) {
        throw error;
      }
      throw new Error("Нестабильное соединение с интернетом, проверьте подключение.");
    }
    throw error;
  }

  const contentType = res.headers.get("content-type") ?? "";
  let payload: unknown = null;
  let rawText = "";

  if (contentType.includes("application/json")) {
    payload = await res.json().catch(() => null);
  } else {
    rawText = await res.text().catch(() => "");
    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = null;
      }
    }
  }

  const isLikelyHtml404 =
    res.status === 404 &&
    contentType.includes("text/html") &&
    normalizedUrl.startsWith("/api/");
  if (isLikelyHtml404 && normalizedUrl !== url) {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
      cache: method === "GET" || method === "HEAD" ? (init?.cache ?? "no-store") : init?.cache,
      signal,
    });
    const retryContentType = res.headers.get("content-type") ?? "";
    payload = null;
    rawText = "";
    if (retryContentType.includes("application/json")) {
      payload = await res.json().catch(() => null);
    } else {
      rawText = await res.text().catch(() => "");
      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = null;
        }
      }
    }
  }

  const parsed = payload as
    | { ok?: boolean; error?: string; details?: unknown; data?: T }
    | null;

  const pathname = getPathname(normalizedUrl);
  // Requests from the previous account must never update the newly selected account or log it out.
  if (requestAccount && requestAccount !== activeAccount()) throw cancelledSessionRequest();
  if (res.status === 401 && (forcedLogoutInProgress || (startedOnAuthPage && !pathname.startsWith("/api/auth/login") && !pathname.startsWith("/api/auth/email") && !pathname.startsWith("/api/auth/register") && !pathname.startsWith("/api/auth/password-reset")))) {
    throw cancelledSessionRequest();
  }
  if (res.status === 401 && shouldForceLogout(pathname, parsed?.error)) {
    const valid = await sessionIsStillValid();
    if (requestAccount && requestAccount !== activeAccount()) throw cancelledSessionRequest();
    if (valid === false) {
      await forceLogoutAndRedirect();
      throw cancelledSessionRequest();
    }
    if (valid === true && parsed?.error === "Требуется авторизация") throw cancelledSessionRequest();
  }

  if (!res.ok || !parsed?.ok) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (Array.isArray(parsed?.details) && parsed.details.length > 0) {
      throw new Error(String(parsed.details[0]));
    }

    if (parsed?.error) {
      throw new Error(parsed.error);
    }

    if (rawText) {
      throw new Error(`HTTP ${res.status}: ${rawText.slice(0, 180)}`);
    }

    throw new Error(`HTTP ${res.status}: Ошибка запроса`);
  }

  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  return parsed.data as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (method !== "GET" && method !== "HEAD") pendingInformation.clear();
  }
}
