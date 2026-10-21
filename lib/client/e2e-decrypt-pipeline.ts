"use client";

export const DIRECT_DECRYPT_LIMITS = {
  cipherTextMaxChars: 1_200_000,
  encryptedKeyMaxChars: 50_000,
  ivMaxChars: 1000,
} as const;

export const SHARED_DECRYPT_LIMITS = {
  cipherTextMaxChars: 1_200_000,
  ivMaxChars: 1000,
} as const;

export type DirectEncryptedPayload = {
  cipherText?: string | null;
  iv?: string | null;
  encryptedKey?: string | null;
};

export type SharedEncryptedPayload = {
  cipherText?: string | null;
  iv?: string | null;
  keyVersion?: number | null;
};

export type CryptoDiagnosticEvent = {
  flow:
    | "direct.decrypt"
    | "direct.decrypt.fallback"
    | "shared.decrypt"
    | "shared.key.resolve"
    | "shared.key.fetch";
  ok: boolean;
  reason?: string;
  chatType?: "direct" | "group" | "channel";
  chatLink?: string;
  messageId?: string;
  keyVersion?: number | null;
};

export type CryptoDiagnosticLogger = (event: CryptoDiagnosticEvent) => void;

export function createCryptoDiagnosticLogger(scope: string): CryptoDiagnosticLogger {
  return (event) => {
    const payload = {
      scope,
      at: new Date().toISOString(),
      ...event,
    };
    if (event.ok) {
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        console.info("[crypto]", payload);
      }
      return;
    }
    console.warn("[crypto]", payload);
  };
}

export function isValidDirectEncryptedPayload(input: DirectEncryptedPayload) {
  if (!input.cipherText || !input.iv || !input.encryptedKey) return false;
  return (
    input.cipherText.length <= DIRECT_DECRYPT_LIMITS.cipherTextMaxChars &&
    input.encryptedKey.length <= DIRECT_DECRYPT_LIMITS.encryptedKeyMaxChars &&
    input.iv.length <= DIRECT_DECRYPT_LIMITS.ivMaxChars
  );
}

export function isValidSharedEncryptedPayload(input: SharedEncryptedPayload) {
  if (!input.cipherText || !input.iv) return false;
  if (typeof input.keyVersion !== "number" || !Number.isFinite(input.keyVersion) || input.keyVersion <= 0) {
    return false;
  }
  return (
    input.cipherText.length <= SHARED_DECRYPT_LIMITS.cipherTextMaxChars &&
    input.iv.length <= SHARED_DECRYPT_LIMITS.ivMaxChars
  );
}

export async function decryptDirectPayloadDeterministic(input: {
  payload: { cipherText: string; iv: string; encryptedKey: string };
  tryPrimary: () => Promise<string>;
  tryFallback?: () => Promise<string>;
  fallbackText: string;
  logger?: CryptoDiagnosticLogger;
  chatLink?: string;
  messageId?: string;
}) {
  try {
    const text = await input.tryPrimary();
    input.logger?.({
      flow: "direct.decrypt",
      ok: true,
      chatType: "direct",
      chatLink: input.chatLink,
      messageId: input.messageId,
    });
    return text;
  } catch {
    input.logger?.({
      flow: "direct.decrypt",
      ok: false,
      reason: "primary_failed",
      chatType: "direct",
      chatLink: input.chatLink,
      messageId: input.messageId,
    });
  }

  if (input.tryFallback) {
    try {
      const text = await input.tryFallback();
      input.logger?.({
        flow: "direct.decrypt.fallback",
        ok: true,
        chatType: "direct",
        chatLink: input.chatLink,
        messageId: input.messageId,
      });
      return text;
    } catch {
      input.logger?.({
        flow: "direct.decrypt.fallback",
        ok: false,
        reason: "fallback_failed",
        chatType: "direct",
        chatLink: input.chatLink,
        messageId: input.messageId,
      });
    }
  }

  return input.fallbackText;
}

export async function decryptSharedPayloadDeterministic(input: {
  payload: { cipherText: string; iv: string; keyVersion: number };
  chatType: "group" | "channel";
  chatLink: string;
  messageId?: string;
  resolveKeyByVersion: (version: number) => string | null;
  fetchKeyByVersion?: (version: number) => Promise<string | null>;
  decryptWithKey: (keyBase64: string) => Promise<string>;
  fallbackText: string;
  logger?: CryptoDiagnosticLogger;
}) {
  const localKey = input.resolveKeyByVersion(input.payload.keyVersion);
  if (localKey) {
    try {
      const text = await input.decryptWithKey(localKey);
      input.logger?.({
        flow: "shared.decrypt",
        ok: true,
        chatType: input.chatType,
        chatLink: input.chatLink,
        messageId: input.messageId,
        keyVersion: input.payload.keyVersion,
      });
      return text;
    } catch {
      input.logger?.({
        flow: "shared.decrypt",
        ok: false,
        reason: "local_key_decrypt_failed",
        chatType: input.chatType,
        chatLink: input.chatLink,
        messageId: input.messageId,
        keyVersion: input.payload.keyVersion,
      });
    }
  } else {
    input.logger?.({
      flow: "shared.key.resolve",
      ok: false,
      reason: "missing_local_version_key",
      chatType: input.chatType,
      chatLink: input.chatLink,
      messageId: input.messageId,
      keyVersion: input.payload.keyVersion,
    });
  }

  if (input.fetchKeyByVersion) {
    try {
      const fetched = await input.fetchKeyByVersion(input.payload.keyVersion);
      if (fetched) {
        const text = await input.decryptWithKey(fetched);
        input.logger?.({
          flow: "shared.key.fetch",
          ok: true,
          chatType: input.chatType,
          chatLink: input.chatLink,
          messageId: input.messageId,
          keyVersion: input.payload.keyVersion,
        });
        return text;
      }
      input.logger?.({
        flow: "shared.key.fetch",
        ok: false,
        reason: "missing_server_version_key",
        chatType: input.chatType,
        chatLink: input.chatLink,
        messageId: input.messageId,
        keyVersion: input.payload.keyVersion,
      });
    } catch {
      input.logger?.({
        flow: "shared.key.fetch",
        ok: false,
        reason: "server_fetch_failed",
        chatType: input.chatType,
        chatLink: input.chatLink,
        messageId: input.messageId,
        keyVersion: input.payload.keyVersion,
      });
    }
  }

  return input.fallbackText;
}
