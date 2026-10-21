"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { apiRequest } from "@/lib/client/http";

export default function GlobalPresence() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/app") return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || controller.signal.aborted) return;
      pending = true;
      try { await apiRequest("/api/realtime/presence", { method: "POST", body: JSON.stringify({ userIds: [] }), signal: controller.signal }); }
      catch { /* Activity is best-effort; privacy is enforced by the server. */ }
      finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 20_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [pathname]);
  return null;
}
