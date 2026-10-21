type BeamsMessagePayload = {
  messageId: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  text: string;
  createdAt: string;
  deepLink?: string;
  cipherText?: string | null;
  iv?: string | null;
  encryptedKey?: string | null;
  keyVersion?: number | null;
};

type BeamsConfig = {
  instanceId: string;
  secretKey: string;
};

function getBeamsConfig(): BeamsConfig | null {
  const instanceId = process.env.PUSHER_BEAMS_INSTANCE_ID?.trim();
  const secretKey = process.env.PUSHER_BEAMS_SECRET_KEY?.trim();
  if (!instanceId || !secretKey) {
    return null;
  }
  return { instanceId, secretKey };
}

const NEW_MESSAGE_NOTIFICATION_TEXT = "Новое сообщение";

function normalizeText(text: string): string {
  void text;
  return NEW_MESSAGE_NOTIFICATION_TEXT;
}

export async function publishBeamsMessageToUser(userId: string, payload: BeamsMessagePayload): Promise<void> {
  const cfg = getBeamsConfig();
  if (!cfg) return;

  const deepLink = payload.deepLink ?? `/chat/${encodeURIComponent(payload.chatId)}`;
  const endpoint =
    `https://${cfg.instanceId}.pushnotifications.pusher.com` +
    `/publish_api/v1/instances/${cfg.instanceId}/publishes/interests`;

  const body = {
    interests: [`user-${userId}`],
    web: {
      notification: {
        title: payload.senderName || "New message",
        body: normalizeText(payload.text),
        icon: payload.senderAvatar || "/brand/hello_light.png",
        deep_link: deepLink,
      },
      data: {
        messageId: payload.messageId,
        chatId: payload.chatId,
        senderId: payload.senderId,
        senderName: payload.senderName || "New message",
        senderAvatar: payload.senderAvatar || "",
        text: normalizeText(payload.text),
        createdAt: payload.createdAt,
        deepLink,
        cipherText: payload.cipherText || "",
        iv: payload.iv || "",
        encryptedKey: payload.encryptedKey || "",
        keyVersion: payload.keyVersion != null ? String(payload.keyVersion) : "",
      },
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(5_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.secretKey}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Beams error: ${res.status} ${text.slice(0, 180)}`);
  }
}
