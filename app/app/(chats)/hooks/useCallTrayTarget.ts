"use client";
import { useEffect, useState } from "react";
import { watchMediaPortalTargets } from "@/lib/client/media-portal-targets";

export function useCallTrayTarget() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    let chatOpen = Boolean(document.getElementById("global-music-chat-slot")?.getClientRects().length);
    const sync = () => setTarget(document.getElementById(mobile.matches && chatOpen ? "global-music-chat-slot" : "global-music-list-slot"));
    const visibility = (event: Event) => { chatOpen = Boolean((event as CustomEvent<{ mobileChatOpen?: boolean }>).detail?.mobileChatOpen); sync(); };
    const stop = watchMediaPortalTargets(["global-music-list-slot", "global-music-chat-slot"], sync);
    mobile.addEventListener("change", sync);
    window.addEventListener("eclipse:mobile-chat-visibility", visibility);
    return () => { stop(); mobile.removeEventListener("change", sync); window.removeEventListener("eclipse:mobile-chat-visibility", visibility); };
  }, []);
  return target;
}
