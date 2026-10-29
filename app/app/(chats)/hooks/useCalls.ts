"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/client/http";
import type { CallKind, CallMode, CallsSnapshot, CallView } from "@/lib/calls";
import { CALL_CLOSING_RETENTION_MS } from "@/lib/client/call-window-motion";
import { setCallPlaybackActive } from "@/lib/client/call-playback";

import { useCallRingtone } from "./useCallRingtone";

const empty: CallsSnapshot = { enabled: false, current: null, groupCall: null };
export const CALLS_CHANGED_EVENT = "eclipse:calls-changed";
type Target = { kind: CallKind; link: string } | null;

async function microphonePermission(video = false) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Микрофон недоступен. Откройте Eclipse по HTTPS в обычном браузере.");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    stream.getTracks().forEach(track => track.stop());
  } catch { throw new Error("Разрешите доступ к микрофону и камере в настройках браузера"); }
}

export function useCalls(userId: string | null, target: Target) {
  const [stored, setStored] = useState<CallsSnapshot & { ownerId: string | null; closing: CallView | null; closingUntil: number }>({ ...empty, ownerId: userId, closing: null, closingUntil: 0 });
  const snapshot = stored.ownerId === userId ? stored : empty;
  const setSnapshot = useCallback((update: CallsSnapshot | ((previous: CallsSnapshot) => CallsSnapshot)) => {
    setStored(previous => {
      const next = { ...(typeof update === "function" ? update(previous.ownerId === userId ? previous : empty) : update), ownerId: userId };
      const finished = previous.ownerId === userId && previous.current && !next.current ? previous.current : null;
      const closing = next.current ? null : finished ? { ...finished, status: "ended" as const, incoming: false,
        endOutcome: next.ended?.id === finished.id ? next.ended.outcome : finished.startedAt ? "completed" as const : "missed" as const } : previous.ownerId === userId ? previous.closing : null;
      const value = { ...next, closing, closingUntil: finished ? Date.now() + CALL_CLOSING_RETENTION_MS : previous.closingUntil };
      return JSON.stringify(previous) === JSON.stringify(value) ? previous : value;
    });
  }, [userId]);
  useEffect(() => {
    if (!stored.closing || stored.ownerId !== userId) return;
    const timer = setTimeout(() => setStored(previous => ({ ...previous, closing: null })), Math.max(0, stored.closingUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [stored.closing, stored.closingUntil, stored.ownerId, userId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const owner = useRef(userId);
  useEffect(() => {
    owner.current = userId;
    ++version.current;
    return () => { owner.current = null; };
  }, [userId]);
  const call = snapshot.current;
  useCallRingtone(call?.status === "ringing" ? call.incoming ? "incoming" : call.onThisSession ? "outgoing" : null : null);
  const callIdRef = useRef<string | null>(null);
  useEffect(() => { callIdRef.current = call?.id ?? null; }, [call?.id, userId]);
  const onThisSession = Boolean(call?.onThisSession);
  const blocksPlayback = Boolean(call && (call.onThisSession || call.incoming));
  useEffect(() => {
    setCallPlaybackActive(blocksPlayback);
    return () => setCallPlaybackActive(false);
  }, [blocksPlayback]);
  const groupLink = target?.kind === "group" ? target.link : "";
  const polling = useRef(false);
  const queuedRefresh = useRef(false);
  const refreshLatest = useRef<() => void>(() => {});
  const mutating = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || owner.current !== userId) return;
    if (polling.current || mutating.current) { queuedRefresh.current = true; return; }
    queuedRefresh.current = false;
    polling.current = true;
    const sequence = version.current;
    try {
      const params = new URLSearchParams();
      if (groupLink) params.set("group", groupLink);
      if (callIdRef.current) params.set("previous", callIdRef.current);
      const response = await apiRequest<CallsSnapshot>(`/api/calls?${params}`, { timeoutMs: 10_000 });
      if (owner.current === userId && sequence === version.current) setSnapshot(response);
    } catch { /* Realtime hints and the next poll recover temporary failures. */ }
    finally {
      polling.current = false;
      if (queuedRefresh.current) { queuedRefresh.current = false; queueMicrotask(() => refreshLatest.current()); }
    }
  }, [userId, groupLink, setSnapshot]);

  useEffect(() => { refreshLatest.current = () => { void refresh(); }; }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const changed = () => { void refresh(); };
    const pushed = (event: MessageEvent) => { if (event.data?.type === "CALLS_CHANGED") changed(); };
    const tick = () => {
      if (document.visibilityState === "visible" || onThisSession) void refresh();
    };
    tick();
    const timer = window.setInterval(tick, 5_000);
    window.addEventListener(CALLS_CHANGED_EVENT, changed);
    window.addEventListener("online", changed);
    navigator.serviceWorker?.addEventListener("message", pushed);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener(CALLS_CHANGED_EVENT, changed);
      window.removeEventListener("online", changed);
      navigator.serviceWorker?.removeEventListener("message", pushed);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId, onThisSession, refresh]);

  useEffect(() => {
    if (!userId || !call?.onThisSession) return;
    const id = call.id;
    let alive = true, pending = false;
    let lastSuccess = Date.now();
    const beat = async () => {
      if (pending || !alive || owner.current !== userId) return;
      pending = true;
      try {
        await apiRequest("/api/calls", { method: "POST", body: JSON.stringify({ action: "heartbeat", id }), timeoutMs: 8_000 });
        lastSuccess = Date.now();
      } catch {
        if (alive && Date.now() - lastSuccess > 75_000) {
          setError("Не удалось восстановить звонок. Позвоните ещё раз.");
          setSnapshot(previous => ({ ...previous, current: previous.current?.id === id ? null : previous.current }));
        }
        void refresh();
      } finally { pending = false; }
    };
    const timer = window.setInterval(() => void beat(), 15_000);
    return () => { alive = false; clearInterval(timer); };
  }, [userId, call?.id, call?.onThisSession, refresh, setSnapshot]);

  const run = useCallback(async (operation: () => Promise<void>) => {
    if (mutating.current || !userId) return;
    mutating.current = true;
    ++version.current;
    setBusy(true);
    setError(null);
    try { await operation(); }
    catch (failure) { if (owner.current === userId && !(failure instanceof DOMException && failure.name === "AbortError")) setError(failure instanceof Error ? failure.message : "Не удалось подключиться к звонку"); }
    finally {
      mutating.current = false;
      if (owner.current === userId) { setBusy(false); void refresh(); }
    }
  }, [userId, refresh]);

  const start = useCallback((mode: CallMode, destination: Target = target) => run(async () => {
    if (!destination || call) return;
    // Parse the media SDK while the permission prompt/API request is in progress.
    void import("livekit-client").catch(() => {});
    await microphonePermission(mode === "video");
    if (owner.current !== userId) return;
    const result = await apiRequest<{ call: CallView }>("/api/calls", { method: "POST", body: JSON.stringify({ action: "start", ...destination, mode }) });
    if (owner.current === userId) setSnapshot(previous => ({ ...previous, current: result.call }));
  }), [run, target, call, userId, setSnapshot]);

  const join = useCallback((id: string) => run(async () => {
    void import("livekit-client").catch(() => {});
    await microphonePermission(false);
    if (owner.current !== userId) return;
    const result = await apiRequest<{ call: CallView }>("/api/calls", { method: "POST", body: JSON.stringify({ action: "join", id }) });
    if (owner.current === userId) setSnapshot(previous => ({ ...previous, current: result.call }));
  }), [run, userId, setSnapshot]);

  const leave = useCallback((end = false) => run(async () => {
    if (!call) return;
    const result = await apiRequest<{ outcome?: CallView["endOutcome"] }>("/api/calls", { method: "POST", body: JSON.stringify({ action: end ? "end" : "leave", id: call.id }), timeoutMs: 15_000 });
    if (owner.current === userId) setSnapshot(previous => ({ ...previous, current: null, groupCall: null,
      ended: { id: call.id, outcome: result.outcome ?? (call.startedAt ? "completed" : call.incoming ? "declined" : "cancelled") } }));
  }), [run, call, userId, setSnapshot]);

  const clearError = useCallback(() => setError(null), []);
  return { ...snapshot, presentation: snapshot.current ?? (stored.ownerId === userId ? stored.closing : null), busy, error, clearError, start, join, leave, refresh };
}
