import { constants, createPrivateKey, createPublicKey, privateDecrypt, publicEncrypt } from "crypto";

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;
const LEGACY_BACKUP_WRAPPER_PREFIX = "zkv1:";
const PASSWORD_BACKUP_WRAPPER_PREFIX = "pwv1:";

export function isValidBase64Canonical(value: string) {
  if (!value || !BASE64_REGEX.test(value) || value.length % 4 !== 0) return false;
  try {
    return Buffer.from(value, "base64").toString("base64") === value;
  } catch {
    return false;
  }
}

export function isValidPublicKeyBase64(publicKeyBase64: string) {
  if (!isValidBase64Canonical(publicKeyBase64)) return false;
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      format: "der",
      type: "spki",
    });
    if (publicKey.asymmetricKeyType !== "rsa" || (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) return false;
    const probe = Buffer.from("e2e-key-probe");
    publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      probe,
    );
    return true;
  } catch {
    return false;
  }
}

export function isValidKeyPairBase64(params: { publicKeyBase64: string; privateKeyBase64: string }) {
  if (!isValidPublicKeyBase64(params.publicKeyBase64)) return false;
  if (!isValidBase64Canonical(params.privateKeyBase64)) return false;
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(params.publicKeyBase64, "base64"),
      format: "der",
      type: "spki",
    });
    const privateKey = createPrivateKey({
      key: Buffer.from(params.privateKeyBase64, "base64"),
      format: "der",
      type: "pkcs8",
    });
    const probe = Buffer.from(`e2e-key-pair-probe:${Date.now()}:${Math.random()}`);
    const encrypted = publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      probe,
    );
    const decrypted = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encrypted,
    );
    return probe.equals(decrypted);
  } catch {
    return false;
  }
}

export function isWrappedPrivateKeyBackupPayloadBase64(payloadBase64: string) {
  if (!isValidBase64Canonical(payloadBase64)) return false;
  try {
    const decoded = Buffer.from(payloadBase64, "base64").toString("utf8");
    const prefix = [LEGACY_BACKUP_WRAPPER_PREFIX, PASSWORD_BACKUP_WRAPPER_PREFIX]
      .find((candidate) => decoded.startsWith(candidate));
    if (!prefix) return false;
    const parts = decoded.slice(prefix.length).split(".");
    if (parts.length !== 2) return false;
    const [iv, cipherText] = parts;
    return isValidBase64Canonical(iv) && Buffer.from(iv, "base64").length === 12 &&
      isValidBase64Canonical(cipherText) && Buffer.from(cipherText, "base64").length > 16;
  } catch {
    return false;
  }
}
