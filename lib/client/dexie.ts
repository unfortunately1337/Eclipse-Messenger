import Dexie, { type Table } from "dexie";

export interface CachedSecretChat {
  id: string;
  title: string;
  expiresAt: number | null;     // Unix timestamp (ms), nullable before approval
  sessionKey: string;    // Encrypted session key
  messages: unknown[];
  lifetimeSeconds?: number;
  peerId?: string;
  peerLink?: string;
  peerDisplayName?: string;
  peerAvatarUrl?: string | null;
  isApproved?: boolean;
}

class SecretChatDatabase extends Dexie {
  secretChats!: Table<CachedSecretChat>;

  constructor() {
    super("SecretChatDatabase");
    this.version(1).stores({
      secretChats: "id, expiresAt",
    });
  }
}

export const db = new SecretChatDatabase();
