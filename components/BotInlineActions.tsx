"use client";

import type { ReactNode } from "react";

export const BOT_INLINE_ACTION_CLASS_NAME = "inline-flex min-h-[38px] w-full min-w-0 items-center justify-center rounded-[14px] bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] px-4 py-2.5 text-center text-[13px] font-medium text-zinc-100 hover:text-white backdrop-blur-[4px] active:scale-[0.985] transition-[background-color,border-color,color,transform] duration-150 disabled:opacity-50 select-none cursor-pointer [overflow-wrap:anywhere]";

/** Keep every bot keyboard aligned with its message and use the system bot's spacing. */
export function BotInlineActions({ children, keyboard = false }: { children: ReactNode; keyboard?: boolean }) {
  return <div data-bot-inline-actions data-bot-inline-keyboard={keyboard || undefined}
    className="mt-1.5 flex w-full min-w-0 flex-col gap-1.5"
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    {children}
  </div>;
}
