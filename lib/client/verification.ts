"use client";
import { useEffect, useSyncExternalStore } from "react";
import { apiRequest } from "./http";
import { subscribeProfileUpdated } from "./local-updates";

export type VerificationKind = "user" | "group" | "channel";
type Entity = { kind: VerificationKind; link: string };
type Appearance = { isVerified: boolean; emojiStatusId: string | null };
const EMPTY: Appearance = { isVerified: false, emojiStatusId: null };
const values = new Map<string, Appearance>();
const revisions = new Map<string, number>();
const pending = new Map<string, Entity>();
const listeners = new Set<() => void>();
let scheduled = false;
function owner() { return typeof document === "undefined" ? "" : document.cookie.match(/(?:^|; )eclipse\.active_user_id=([^;]+)/)?.[1] ?? ""; }
function key(entity: Entity, account = owner()) { return `${account}:${entity.kind}:${entity.link}`; }
let unsubscribeProfile: (() => void) | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  unsubscribeProfile ??= subscribeProfileUpdated(profile => {
    if (profile.emojiStatusId === undefined) return;
    for (const link of [profile.link, profile.previousLink]) {
      if (!link) continue;
      const id = key({ kind: "user", link: link.replace(/^@+/, "").trim().toLowerCase() });
      if (!values.has(id)) {
        pending.set(id, { kind: "user", link: link.replace(/^@+/, "").trim().toLowerCase() });
        if (!scheduled) { scheduled = true; queueMicrotask(() => void flush()); }
      }
      revisions.set(id, (revisions.get(id) ?? 0) + 1);
      values.set(id, { ...values.get(id) ?? EMPTY, emojiStatusId: profile.emojiStatusId });
    }
    listeners.forEach(notify => notify());
  });
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { unsubscribeProfile?.(); unsubscribeProfile = undefined; }
  };
}
async function flush() {
  scheduled = false;
  const account = owner();
  const entries = [...pending.entries()].filter(([id]) => id.startsWith(`${account}:`)).slice(0, 100);
  entries.forEach(([id]) => pending.delete(id));
  if (!entries.length) return;
  const requestedRevisions = new Map(entries.map(([id]) => [id, revisions.get(id) ?? 0]));
  try {
    const result = await apiRequest<{ entities: Array<Entity & Appearance> }>("/api/verification", { method: "POST", body: JSON.stringify({ entities: entries.map(([, entity]) => entity) }) });
    if (account !== owner()) return;
    result.entities.forEach(entity => {
      const id = key(entity, account);
      const changed = (revisions.get(id) ?? 0) !== requestedRevisions.get(id);
      values.set(id, { isVerified: entity.isVerified === true, emojiStatusId: changed ? values.get(id)?.emojiStatusId ?? null : entity.emojiStatusId ?? null });
    });
    listeners.forEach(listener => listener());
  } catch { /* A failed lookup never displays a verification badge. */ }
  if (pending.size && !scheduled) { scheduled = true; queueMicrotask(() => void flush()); }
}
export function useEntityAppearance(kind: VerificationKind, link: string) {
  const normalized = link.replace(/^@+/, "").trim().toLowerCase();
  const entity = { kind, link: normalized };
  const id = key(entity);
  const appearance = useSyncExternalStore(subscribe, () => values.get(id) ?? EMPTY, () => EMPTY);
  useEffect(() => {
    if (!normalized || values.has(id)) return;
    pending.set(id, { kind, link: normalized });
    if (!scheduled) { scheduled = true; queueMicrotask(() => void flush()); }
  }, [kind, normalized, id]);
  return appearance;
}
export function useEntityVerification(kind: VerificationKind, link: string) {
  return useEntityAppearance(kind, link).isVerified;
}
