// Crypto identity belongs only to the local call-test account, never to real users.
import { webcrypto } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
const subtle = webcrypto.subtle;
export async function loadCallTestIdentity() {
  const file = ".cache/call-test-identity.json";
  let saved;
  if (existsSync(file)) saved = JSON.parse(readFileSync(file, "utf8"));
  else {
    const pair = await subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
    saved = { publicKey: Buffer.from(await subtle.exportKey("spki", pair.publicKey)).toString("base64"), privateKey: Buffer.from(await subtle.exportKey("pkcs8", pair.privateKey)).toString("base64") };
    mkdirSync(".cache", { recursive: true }); writeFileSync(file, JSON.stringify(saved), { mode: 0o600 });
  }
  return { publicKey: saved.publicKey, privateKey: await subtle.importKey("pkcs8", Buffer.from(saved.privateKey, "base64"), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]) };
}
export async function isCallCommand(message, identity) {
  if (!message?.cipherText || !message.iv || !message.encryptedKey || message.isSystemMessage) return false;
  try {
    const raw = await subtle.decrypt({ name: "RSA-OAEP" }, identity.privateKey, Buffer.from(message.encryptedKey, "base64"));
    const key = await subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    const bytes = await subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(message.iv, "base64") }, key, Buffer.from(message.cipherText, "base64"));
    return new TextDecoder().decode(bytes).trim() === "1";
  } catch { return false; }
}
