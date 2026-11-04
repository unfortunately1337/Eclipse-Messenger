import type { P2PCallConnection } from "@/lib/calls";
import { CALL_SIGNAL_HINT_EVENT, type CallSignalInbox, type CallSignalInput, type CallSignalMessage, type CallSignalPayload } from "@/lib/call-signaling";
import { apiRequest } from "./http";

export interface P2PSignaling {
  send(payload: CallSignalPayload): Promise<void>;
  refresh(): Promise<P2PCallConnection>;
  start(receive: (message: CallSignalMessage) => Promise<void>, reset: () => void, failed: (error: unknown) => void, connected: () => boolean): void;
  close(): void;
}

export function callClientId(callId: string) {
  const key = `eclipse:call-client:${callId}`;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(stored)) return stored;
    const id = crypto.randomUUID(); sessionStorage.setItem(key, id); return id;
  } catch { return crypto.randomUUID(); }
}

export function createP2PSignaling(connection: P2PCallConnection): P2PSignaling {
  const epoch = crypto.randomUUID();
  let closed = false, cursor = 0, pending = false, again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let refreshInbox = () => {};
  let outbound = Promise.resolve();
  const abort = new AbortController();
  const hint = (event: Event) => {
    if (event.type === CALL_SIGNAL_HINT_EVENT && (event as CustomEvent).detail?.id !== connection.callId) return;
    refreshInbox();
  };
  const events = [CALL_SIGNAL_HINT_EVENT, "online", "focus", "eclipse:calls-changed"];
  return {
    send(payload) {
      const input: CallSignalInput = { id: crypto.randomUUID(), clientId: connection.clientId, epoch, payload };
      const operation = async () => {
        for (let attempt = 0; attempt < 3 && !closed; attempt++) {
          try {
            await apiRequest(`/api/calls/${connection.callId}/signal`, { method: "POST", body: JSON.stringify(input), timeoutMs: 8000, signal: abort.signal });
            return;
          } catch (error) {
            if (closed || attempt === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
          }
        }
      };
      const next = outbound.then(operation);
      outbound = next.catch(() => {});
      return next;
    },
    async refresh() {
      const next = await apiRequest<P2PCallConnection>("/api/calls", { method: "POST", body: JSON.stringify({ action: "token", id: connection.callId, clientId: connection.clientId }), signal: abort.signal, timeoutMs: 8000 });
      if (next.transport !== "p2p") throw new Error("Call transport changed");
      return next;
    },
    start(receive, reset, failed, connected) {
      const poll = async () => {
        if (closed) return;
        if (pending) { again = true; return; }
        pending = true;
        if (timer) clearTimeout(timer);
        try {
          const result = await apiRequest<CallSignalInbox>(`/api/calls/${connection.callId}/signal?clientId=${connection.clientId}&after=${cursor}`, { signal: abort.signal, timeoutMs: 8000 });
          if (closed) return;
          if (result.reset) { cursor = result.cursor; reset(); return; }
          for (const message of result.messages) {
            if (closed) return;
            await receive(message);
            cursor = Math.max(cursor, message.sequence);
          }
          cursor = Math.max(cursor, result.cursor);
        } catch (error) { if (!closed) failed(error); }
        finally {
          pending = false;
          if (!closed) {
            const delay = again ? 0 : connected() ? 12_000 : 650;
            again = false; timer = setTimeout(() => void poll(), delay);
          }
        }
      };
      refreshInbox = () => { void poll(); };
      events.forEach(event => window.addEventListener(event, hint));
      void poll();
    },
    close() {
      closed = true; abort.abort(); if (timer) clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, hint));
    },
  };
}
