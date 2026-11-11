"use client";
import Dexie, { type Table } from "dexie";
import type { DecryptedMessage } from "@/app/app/(chats)/types";

type FailedRow = { key: string; account: string; target: string; messageId: string; message: DecryptedMessage };
class FailedMessages extends Dexie {
  messages!: Table<FailedRow, string>;
  constructor() { super("EclipseFailedOutgoing"); this.version(1).stores({ messages: "key, account, messageId, [account+target]" }); }
}
const storage = new FailedMessages();
const outgoing = new Map<string, DecryptedMessage>();
const failed = new Map<string, FailedRow>();
const removed = new Set<string>();
const warming = new Map<string, Promise<void>>();
let generation = 0;
const writes = new Map<string, Promise<unknown>>();
let clearing: Promise<unknown> = Promise.resolve();
function writeInOrder(id: string, action: () => Promise<unknown>) {
  const pending = Promise.all([clearing, writes.get(id)]).then(action).catch(() => {});
  writes.set(id, pending);
  void pending.finally(() => { if (writes.get(id) === pending) writes.delete(id); });
  return pending;
}
export function rememberOutgoingMessage(message: DecryptedMessage) { outgoing.set(message.id, message); }
export function peekOutgoingMessage(id: string) { return outgoing.get(id); }
export function forgetOutgoingMessage(id: string) { outgoing.delete(id); }
const key = (account: string, target: string, id: string) => JSON.stringify([account, target, id]);
export async function saveFailedMessage(account: string, target: string, message: DecryptedMessage) {
  if (target.startsWith("direct:secret-")) return; // Secret chats remain bound to the current device/session.
  const row = { key: key(account, target, message.id), account, target, messageId: message.id, message };
  removed.delete(message.id);
  failed.set(row.key, row);
  await writeInOrder(message.id, () => storage.messages.put(row));
}
export function peekFailedMessages(account: string, target: string): DecryptedMessage[] {
  if (target.startsWith("direct:secret-")) return [];
  return [...failed.values()].filter(row => row.account === account && row.target === target).map(row => row.message);
}
export function warmFailedMessages(account: string): Promise<void> {
  const existing = warming.get(account);
  if (existing) return existing;
  const requestedGeneration = generation;
  const pending = clearing.then(() => storage.messages.where("account").equals(account).toArray()).then(rows => {
    if (generation !== requestedGeneration) return;
    for (const row of rows) {
      if (removed.has(row.messageId) || row.target.startsWith("direct:secret-") || failed.has(row.key)) continue;
      failed.set(row.key, row);
      rememberOutgoingMessage(row.message);
    }
  }).catch(() => { if (warming.get(account) === pending) warming.delete(account); });
  warming.set(account, pending);
  return pending;
}
export async function readFailedMessages(account: string, target: string): Promise<DecryptedMessage[]> {
  if (target.startsWith("direct:secret-")) return [];
  await warmFailedMessages(account);
  return peekFailedMessages(account, target);
}
export async function removeFailedMessage(messageId: string) {
  outgoing.delete(messageId);
  removed.add(messageId);
  for (const [id, row] of failed) if (row.messageId === messageId) failed.delete(id);
  await writeInOrder(messageId, () => storage.messages.where("messageId").equals(messageId).delete());
}
export async function clearFailedMessages() {
  outgoing.clear();
  failed.clear();
  removed.clear();
  warming.clear();
  generation++;
  clearing = Promise.all([clearing, ...writes.values()]).then(() => storage.messages.clear()).catch(() => {});
  await clearing;
}
