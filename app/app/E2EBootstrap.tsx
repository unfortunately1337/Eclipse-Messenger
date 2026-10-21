"use client";

import { useEffect } from "react";
import { apiRequest } from "@/lib/client/http";
import { resolveE2EIdentity } from "@/lib/client/e2e-identity";

export default function E2EBootstrap() {
  useEffect(() => {
    let probeTimer: ReturnType<typeof setInterval> | null = null;

    async function probeSession() {
      try {
        await apiRequest("/api/auth/me", { method: "GET" });
      } catch {
        // apiRequest handles invalid sessions centrally
      }
    }

    // Both the chat view and layout share one recovery operation; no password modal.
    void resolveE2EIdentity().catch(() => { /* The chat view exposes recovery failures. */ });

    probeTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void probeSession();
      }
    }, 60000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void probeSession();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (probeTimer) {
        clearInterval(probeTimer);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
