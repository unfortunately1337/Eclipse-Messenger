"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CallView } from "@/lib/calls";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import { translate } from "@/lib/i18n/translate";

type Audio = { volume: number; muted: boolean };
export function useParticipantAudio(call: CallView) {
  const [local, setLocal] = useState<Record<string, Audio>>({});
  const pending = useRef(new Map<string, Audio>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef(Promise.resolve());
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const values = [...pending.current];
    pending.current.clear();
    queue.current = queue.current.then(async () => {
      for (const [peerId, audio] of values) {
        try {
          await apiRequest("/api/calls", { method: "POST", body: JSON.stringify({ action: "participant-audio", id: call.id, peerId, ...audio }) });
        } catch {
          showAppToast({ type: "error", title: translate("Не удалось сохранить громкость") });
        }
      }
    });
    return queue.current;
  }, [call.id]);
  useEffect(() => () => { void flush(); }, [flush]);
  const get = (peerId: string): Audio => local[peerId] ?? call.audioPreferences?.[peerId] ?? { volume: 1, muted: false };
  const update = (peerId: string, audio: Audio) => {
    setLocal(previous => ({ ...previous, [peerId]: audio }));
    pending.current.set(peerId, audio);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 250);
  };
  return { get, update, flush };
}
