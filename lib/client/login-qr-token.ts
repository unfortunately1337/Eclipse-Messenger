const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractLoginQrToken(raw: string, currentOrigin: string): string | null {
  const value = raw.trim();
  if (UUID.test(value)) return value;
  try {
    const url = new URL(value);
    const trustedLogin = url.protocol === "eclipse:" && url.hostname === "login";
    const webLogin = url.origin === currentOrigin && url.pathname === "/login";
    if (!trustedLogin && !webLogin) return null;
    const token = url.searchParams.get("qrToken") ?? url.searchParams.get("token");
    return token && UUID.test(token) ? token : null;
  } catch { return null; }
}

export function extractLoginQrSecret(raw: string, currentOrigin: string): string | null {
  if (!extractLoginQrToken(raw, currentOrigin)) return null;
  try {
    const secret = new URLSearchParams(new URL(raw.trim()).hash.slice(1)).get("key");
    return secret && /^[A-Za-z0-9_-]{43}$/.test(secret) ? secret : null;
  } catch { return null; }
}
