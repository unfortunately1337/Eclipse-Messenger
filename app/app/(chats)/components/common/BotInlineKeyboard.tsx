"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { useRef, useState } from "react";
import type { BotReplyMarkup } from "@/lib/bot-api";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import { ECLIPSE_INLINE_ACTION_CLASS_NAME } from "../../EclipseChatUi";

export function BotInlineKeyboard({ markup, link, messageId }: { markup: BotReplyMarkup; link: string; messageId: string }) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ data: string; requestId: string } | null>(null);
  async function click(data: string) {
    if (busy) return;
    const request = pending.current?.data === data ? pending.current : { data, requestId: crypto.randomUUID() };
    pending.current = request; setBusy(true);
    try { await apiRequest(`/api/bots/${encodeURIComponent(link)}/callback`, { method: "POST", body: JSON.stringify({ messageId, ...request }) }); pending.current = null; }
    catch (error) { showAppToast({ type: "error", title: error instanceof Error ? error.message : t("Не удалось нажать кнопку") }); }
    finally { setBusy(false); }
  }
  return <div className="mt-2 flex w-full min-w-[160px] flex-col gap-1" data-bot-inline-keyboard onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    {markup.inline_keyboard.map((row, index) => <div className="flex gap-1" key={index}>
      {row.map((button, column) => button.url
        ? <a key={column} href={button.url} target="_blank" rel="noopener noreferrer" className={`${ECLIPSE_INLINE_ACTION_CLASS_NAME} flex-1`}>{button.text}</a>
        : <button key={column} type="button" disabled={busy} className={`${ECLIPSE_INLINE_ACTION_CLASS_NAME} flex-1 disabled:opacity-50`} onClick={() => void click(button.callback_data!)}>{button.text}</button>)}
    </div>)}
  </div>;
}
