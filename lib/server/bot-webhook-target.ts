import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";
import { HttpError } from "./http";

const denied = new BlockList();
for (const [ip, prefix] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const) denied.addSubnet(ip, prefix, "ipv4");
denied.addSubnet("2001::", 23, "ipv6");
denied.addSubnet("2002::", 16, "ipv6");
denied.addSubnet("2001:db8::", 32, "ipv6");
denied.addSubnet("3fff::", 20, "ipv6");
const globalV6 = new BlockList(); globalV6.addSubnet("2000::", 3, "ipv6");
export function isPublicWebhookAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !denied.check(address, "ipv4") : family === 6 && globalV6.check(address, "ipv6") && !denied.check(address, "ipv6");
}
export async function resolveWebhookTarget(rawUrl: string) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new HttpError(400, "Invalid webhook URL."); }
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password || url.hash) throw new HttpError(400, "Webhook requires HTTPS on port 443 without URL credentials.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([
    lookup(host, { all: true }),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DNS timeout")), 5000); }),
  ]).catch(() => { throw new HttpError(400, "Webhook hostname cannot be resolved."); }).finally(() => { if (timer) clearTimeout(timer); });
  if (!addresses.length || addresses.some(result => !isPublicWebhookAddress(result.address))) throw new HttpError(400, "Webhook must resolve only to public IP addresses.");
  return { url, address: addresses[0] };
}
export async function postBotWebhook(rawUrl: string, secret: string, payload: unknown) {
  const { url, address } = await resolveWebhookTarget(rawUrl);
  const body = Buffer.from(JSON.stringify(payload));
  await new Promise<void>((resolve, reject) => {
    // Pin the checked address. No second DNS lookup, redirects or proxy inheritance.
    const req = request({ hostname: address.address, port: 443, servername: url.hostname.replace(/^\[|\]$/g, ""), path: url.pathname + url.search, method: "POST", agent: false,
      headers: { Host: url.host, "Content-Type": "application/json", "Content-Length": body.length, "X-Eclipse-Bot-Secret-Token": secret },
    }, res => {
      let bytes = 0;
      res.on("data", chunk => { bytes += chunk.length; if (bytes > 65536) req.destroy(new Error("Webhook response too large")); });
      res.on("error", reject);
      res.on("end", () => res.statusCode && res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error(`Webhook HTTP ${res.statusCode ?? 0}`)));
    });
    const timer = setTimeout(() => req.destroy(new Error("Webhook timeout")), 8000);
    req.on("close", () => clearTimeout(timer)); req.on("error", reject); req.end(body);
  });
}
