"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CALL_END_FEEDBACK_MS, CALL_END_EFFECT_MS, CALL_RETURN_SECONDS } from "@/lib/client/call-window-motion";

/** Shared 1×1/group return: finish the entrance, then contract around the actual avatar. */
export function useCallReturnAnimation({ connected, terminal, completed, minimized, host }: { connected: boolean; terminal: boolean; completed: boolean; minimized: boolean; host: RefObject<HTMLElement | null> }) {
  const avatar = useRef<HTMLDivElement>(null), connectionWave = useRef<HTMLDivElement>(null);
  const updateWaveOrigin = useRef<(() => void) | null>(null);
  const [avatarReady, setAvatarReady] = useState(false), [waveComplete, setWaveComplete] = useState(false);
  const [wasConnected, setWasConnected] = useState(connected);
  if (connected && !wasConnected) setWasConnected(true);
  const [terminalSettled, setTerminalSettled] = useState(false), [closeRequested, setCloseRequested] = useState(false);
  const needsReturn = completed && (wasConnected || connected) && !minimized;
  const returning = needsReturn && avatarReady && waveComplete;
  const failed = terminal && !completed;
  const showWave = failed || ((wasConnected || connected) && !terminalSettled);
  const setAvatarRef = useCallback((node: HTMLDivElement | null) => {
    avatar.current = node; setAvatarReady(Boolean(node));
    if (node) updateWaveOrigin.current?.();
  }, []);
  useEffect(() => {
    if (!terminal) return;
    const timer = window.setTimeout(() => setCloseRequested(true), CALL_END_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [terminal]);
  useEffect(() => {
    if (!terminal || (needsReturn && !returning)) return;
    const timer = window.setTimeout(() => setTerminalSettled(true), needsReturn ? CALL_RETURN_SECONDS * 1000 + 30 : CALL_END_EFFECT_MS);
    return () => window.clearTimeout(timer);
  }, [terminal, needsReturn, returning]);
  useLayoutEffect(() => {
    const node = host.current, wave = connectionWave.current;
    if (!showWave || minimized || !node || !wave) return;
    const sync = () => {
      const bounds = node.getBoundingClientRect(), photo = avatar.current?.getBoundingClientRect();
      const x = photo ? photo.left + photo.width / 2 - bounds.left : bounds.width / 2;
      const y = photo ? photo.top + photo.height / 2 - bounds.top : bounds.height * .4;
      const radius = Math.hypot(Math.max(x, bounds.width - x), Math.max(y, bounds.height - y)) + 24;
      wave.style.width = wave.style.height = `${radius * 2}px`;
      wave.style.left = `${x - radius}px`; wave.style.top = `${y - radius}px`;
    };
    updateWaveOrigin.current = sync; sync();
    const observer = new ResizeObserver(sync); observer.observe(node);
    return () => { observer.disconnect(); updateWaveOrigin.current = null; };
  }, [host, showWave, minimized, terminal]);
  return { setAvatarRef, setAvatarReady, connectionWave, waveComplete, showWave, returning, closingWindow: closeRequested && (!needsReturn || terminalSettled),
    onWaveComplete: () => { if (returning) setTerminalSettled(true); else setWaveComplete(true); } };
}
