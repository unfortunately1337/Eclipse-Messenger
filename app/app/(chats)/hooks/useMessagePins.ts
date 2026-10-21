"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/client/http";
import { PINS_UPDATED_EVENT, pinScopeKey, type MessagePins, type PinScope, type PinnedMessage } from "@/lib/message-pins";

const empty: MessagePins = { pins: [], canManage: false };

export function useMessagePins(scope: PinScope | null, onError: (error: unknown) => void) {
  const key = pinScopeKey(scope), chatId = scope?.chatId, chatType = scope?.chatType;
  const [snapshot, setSnapshot] = useState<MessagePins & { key: string }>({ ...empty, key: "" });
  const [selection, setSelection] = useState<{ key: string; id: string }>({ key: "", id: "" });
  const [busyKey, setBusyKey] = useState("");
  const currentKey = useRef(key), request = useRef(0), mutating = useRef(false);
  useEffect(() => { currentKey.current = key; ++request.current; }, [key]);

  const refresh = useCallback(async () => {
    if (!chatId || !chatType) return;
    const sequence = ++request.current;
    const data = await apiRequest<MessagePins>(`/api/message-pins?${new URLSearchParams({ chatId, chatType })}`, { cache: "no-store" });
    if (currentKey.current === key && sequence === request.current) setSnapshot({ ...data, key });
    return data;
  }, [chatId, chatType, key]);

  useEffect(() => {
    if (!key) return;
    let active = true;
    const reload = () => { if (active && document.visibilityState === "visible") void refresh().catch(() => {}); };
    const updated = (event: Event) => { if (pinScopeKey((event as CustomEvent<PinScope>).detail) === key) reload(); };
    reload();
    // Focus/visibility recovery also covers a temporarily disconnected realtime transport.
    const timer = window.setInterval(reload, 20_000);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    window.addEventListener(PINS_UPDATED_EVENT, updated);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
      window.removeEventListener(PINS_UPDATED_EVENT, updated);
    };
  }, [key, refresh]);

  const data = snapshot.key === key ? snapshot : empty;
  const selectedIndex = selection.key === key ? data.pins.findIndex(pin => pin.id === selection.id) : -1;
  const index = Math.max(0, selectedIndex);
  const active: PinnedMessage | undefined = data.pins[index];
  const advance = useCallback(() => {
    if (data.pins.length) setSelection({ key, id: data.pins[(index + 1) % data.pins.length].id });
  }, [data.pins, index, key]);

  const toggle = useCallback(async (messageId: string) => {
    if (!chatId || !chatType || !data.canManage || mutating.current) return;
    const pinned = !data.pins.some(pin => pin.id === messageId);
    mutating.current = true;
    setBusyKey(key);
    ++request.current;
    try {
      const result = await apiRequest<MessagePins>("/api/message-pins", {
        method: "POST", body: JSON.stringify({ chatId, chatType, messageId, pinned }),
      });
      if (currentKey.current !== key) return;
      ++request.current;
      setSnapshot({ ...result, key });
      setSelection({ key, id: pinned ? messageId : result.pins[0]?.id ?? "" });
    } catch (error) { if (currentKey.current === key) onError(error); }
    finally { mutating.current = false; setBusyKey(""); }
  }, [chatId, chatType, key, data.canManage, data.pins, onError]);

  return { ...data, active, index, advance, toggle, refresh, busy: busyKey === key && Boolean(key) };
}
