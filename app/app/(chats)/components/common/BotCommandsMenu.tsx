"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { useEffect, useState } from "react";
import { CgMenuRound } from "react-icons/cg";
import { apiRequest } from "@/lib/client/http";
export function BotCommandsMenu({ link, onCommand }: { link: string; onCommand: (command: string) => void }) {
  const t = useTranslation();
  const [commands, setCommands] = useState<{ command: string; description: string }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { let live = true; void apiRequest<{ commands: typeof commands }>(`/api/bots/${encodeURIComponent(link)}/commands`, { cache: "no-store" }).then(data => { if (live) setCommands(data.commands); }).catch(() => {}); return () => { live = false; }; }, [link]);
  if (!commands.length) return null;
  return <div className="relative shrink-0 self-end mb-[3px] md:mb-1 mr-1">
    <button type="button" aria-label={t("Команды бота")} aria-expanded={open} onClick={() => setOpen(value => !value)} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-white/8 hover:text-zinc-100"><CgMenuRound size={18} /></button>
    {open && <div className="absolute bottom-10 right-0 z-50 max-h-64 w-64 overflow-auto rounded-[20px] border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-xl">
      {commands.map(item => <button type="button" key={item.command} onClick={() => { setOpen(false); onCommand(`/${item.command}`); }} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-white/8"><span className="text-sm text-zinc-100">/{item.command}</span><span className="block text-xs text-zinc-400">{item.description}</span></button>)}
    </div>}
  </div>;
}
