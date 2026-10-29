"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { messageSearchNeedle } from "@/lib/client/message-search";

type Item = { id: string; text: string };
type Options = {
  scope: string; messages: Item[]; hasMore: boolean; loading: boolean;
  loadOlder: () => Promise<void>; scroll: (id: string, duration?: number) => void;
  stopScroll: () => void;
};
export function useMessageSearch(options: Options) {
  const [state, setState] = useState({ scope: "", open: false, query: "", selected: "" });
  const [work, setWork] = useState({ scope: "", query: "", busy: false, failed: false });
  const current = useRef(options), navigating = useRef("");
  useLayoutEffect(() => { current.current = options; }, [options]);
  const open = state.open && state.scope === options.scope;
  const query = open ? state.query : "", needle = messageSearchNeedle(query);
  const matches = useMemo(() => needle ? options.messages.filter(item => item.text.toLowerCase().includes(needle)).reverse().map(item => item.id) : [], [options.messages, needle]);
  const selected = matches.includes(state.selected) ? state.selected : matches[0] ?? "";
  const index = matches.indexOf(selected);
  useEffect(() => {
    if (!open || !needle || !selected) return;
    const key = `${options.scope}:${needle}:${selected}`;
    if (navigating.current === key) return;
    const timer = setTimeout(() => {
      navigating.current = key;
      setState(previous => previous.scope === options.scope && previous.query.trim().toLowerCase() === needle ? { ...previous, selected } : previous);
      current.current.scroll(selected, 0);
    }, 220);
    return () => clearTimeout(timer);
  }, [open, needle, selected, options.scope]);
  useEffect(() => {
    if (!open || !needle) return;
    const scope = options.scope;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setWork({ scope, query: needle, busy: true, failed: false });
        let unchanged = 0;
        try {
          while (!cancelled && current.current.scope === scope && current.current.hasMore) {
            if (current.current.loading) { await new Promise(resolve => setTimeout(resolve, 100)); continue; }
            const first = current.current.messages[0]?.id;
            await current.current.loadOlder();
            await new Promise(resolve => setTimeout(resolve, 750));
            if (cancelled || current.current.scope !== scope) return;
            if (current.current.messages[0]?.id === first && current.current.hasMore) {
              if (++unchanged >= 3) throw new Error("history unavailable");
            } else unchanged = 0;
          }
          if (!cancelled) setWork({ scope, query: needle, busy: false, failed: false });
        } catch { if (!cancelled) setWork({ scope, query: needle, busy: false, failed: true }); }
      })();
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, needle, options.scope]);
  return {
    open, query, matches, selected, index,
    busy: open && Boolean(needle) && (options.loading || (work.scope === options.scope && work.query === needle && work.busy)),
    failed: open && Boolean(needle) && work.scope === options.scope && work.query === needle && work.failed,
    hasMore: options.hasMore,
    begin: (scope = options.scope) => { navigating.current = ""; setState({ scope, open: true, query: "", selected: "" }); },
    close: () => { current.current.stopScroll(); setState(previous => ({ ...previous, open: false, query: "", selected: "" })); },
    change: (value: string) => setState(previous => ({ ...previous, query: value, selected: "" })),
    move: (delta: number) => {
      if (!matches.length) return;
      const id = matches[(Math.max(index, 0) + delta + matches.length) % matches.length];
      navigating.current = `${options.scope}:${needle}:${id}`;
      setState(previous => ({ ...previous, selected: id }));
      current.current.scroll(id, 0);
    },
  };
}
