export type SharedKeyHistory = { version: number; keyHolders: string[] };
export type SharedKeyRecipient = { userId: string; publicKey: string | null };

export async function shareMissingHistoryKeys(options: {
  history: SharedKeyHistory[];
  members: SharedKeyRecipient[];
  targetUserIds?: string[];
  resolveKey: (version: number) => Promise<string | null>;
  wrapKey: (key: string, publicKey: string) => Promise<string>;
  save: (version: number, keys: Array<{ userId: string; encryptedKey: string }>) => Promise<void>;
}) {
  let added = 0;
  const target = options.targetUserIds?.length ? new Set(options.targetUserIds) : null;
  const failedVersions: number[] = [];
  for (const epoch of options.history) {
    const holders = new Set(epoch.keyHolders);
    const missing = options.members.filter(member => member.publicKey && !holders.has(member.userId) && (!target || target.has(member.userId)));
    if (!missing.length) continue;
    try {
      const key = await options.resolveKey(epoch.version);
      if (!key) { failedVersions.push(epoch.version); continue; }
      const wrapped = await Promise.all(missing.map(async member => ({ userId: member.userId, encryptedKey: await options.wrapKey(key, member.publicKey!) })));
      await options.save(epoch.version, wrapped);
      added += wrapped.length;
    } catch { failedVersions.push(epoch.version); }
  }
  return { added, failedVersions };
}
