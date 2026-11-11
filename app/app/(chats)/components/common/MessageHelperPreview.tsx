"use client";

import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { DecryptedMessage } from "../../types";
import { MessageDeliveryProvider } from "./MessageStatus";

type Preview = { content: ReactNode; width?: number; isMine: boolean };
function createPreviewStore() {
  const previews = new Map<string, Preview>();
  const listeners = new Set<() => void>();
  return {
    get: (id: string) => previews.get(id),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    put(id: string, preview: Preview) {
      previews.clear();
      previews.set(id, preview);
      listeners.forEach(listener => listener());
    },
  };
}
const PreviewContext = createContext<ReturnType<typeof createPreviewStore> | null>(null);

export function MessageHelperPreviewProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPreviewStore);
  return <PreviewContext.Provider value={store}>{children}</PreviewContext.Provider>;
}

/** Publish the actual bubble only while its helper is open; no duplicate renderer or DOM cloning. */
export function MessageHelperPreviewSource({ id, active, isMine = true, children }: { id: string; active: boolean; isMine?: boolean; children: ReactNode }) {
  const store = useContext(PreviewContext);
  useLayoutEffect(() => {
    if (!active || !store) return;
    const origin = document.querySelector<HTMLElement>(`[data-message-preview-origin="${CSS.escape(id)}"]`);
    const width = origin?.getBoundingClientRect().width;
    store.put(id, { content: children, width: width && width > 0 ? width : undefined, isMine });
  }, [active, children, id, isMine, store]);
  return children;
}

const emptySubscribe = () => () => {};
const emptySnapshot = () => undefined;
export function MessageHelperPreview({ message }: { message: DecryptedMessage }) {
  const store = useContext(PreviewContext);
  const preview = useSyncExternalStore(store?.subscribe ?? emptySubscribe, () => store?.get(message.id), emptySnapshot);
  if (!preview) return null;
  return <MessageDeliveryProvider pending={Boolean(message.pending)} failed={Boolean(message.sendFailure)}>
    <div data-message-helper-preview className="pointer-events-none relative max-w-full [&_*]:!animate-none" style={{ width: preview.width, marginRight: message.sendFailure && preview.isMine ? 24 : 0, marginLeft: message.sendFailure && !preview.isMine ? 24 : 0 }} inert>
      {preview.content}
    </div>
  </MessageDeliveryProvider>;
}
