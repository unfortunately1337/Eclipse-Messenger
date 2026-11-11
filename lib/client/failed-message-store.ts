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
  await writeInOrder(message.id, () => storage.messages.put({ key: key(account, target, message.id), account, target, messageId: message.id, message }));
}
export async function readFailedMessages(account: string, target: string): Promise<DecryptedMessage[]> {
  if (target.startsWith("direct:secret-")) return [];
  try {
    await Promise.all([clearing, ...writes.values()]);
    return (await storage.messages.where("[account+target]").equals([account, target]).toArray()).map(row => row.message);
  }
  catch { return []; }
}
export async function removeFailedMessage(messageId: string) {
  outgoing.delete(messageId);
  await writeInOrder(messageId, () => storage.messages.where("messageId").equals(messageId).delete());
}
export async function clearFailedMessages() {
  outgoing.clear();
  clearing = Promise.all([clearing, ...writes.values()]).then(() => storage.messages.clear()).catch(() => {});
  await clearing;
}
