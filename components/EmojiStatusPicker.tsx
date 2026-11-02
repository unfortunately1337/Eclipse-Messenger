"use client";
import { type RefObject } from "react";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";
import { getPanelVisualStyle } from "@/lib/client/panel-visual";
import AccountPackPicker from "./AccountPackPicker";
export default function EmojiStatusPicker({ open, onOpenChange, value, onSelect, glass, saving, error, triggerRef }: {
 open:boolean;onOpenChange:(value:boolean)=>void;value:string|null;onSelect:(id:string|null)=>void;glass:boolean;saving:boolean;error:string|null;triggerRef:RefObject<HTMLButtonElement|null>;
}) {
 const t=useTranslation(),reduced=useReducedMotion();
 return <Dialog.Root open={open} onOpenChange={onOpenChange}><AnimatePresence>{open&&<Dialog.Portal forceMount>
 <Dialog.Overlay asChild><motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[140] bg-black/40"/></Dialog.Overlay>
 <Dialog.Content asChild forceMount aria-describedby={undefined} onCloseAutoFocus={event=>{event.preventDefault();triggerRef.current?.focus();}}>
 <motion.div data-emoji-status-picker initial={{opacity:0,scale:.94,y:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.96,y:8}} transition={{duration:reduced?0:.24,ease:[.22,1,.36,1]}} style={getPanelVisualStyle(glass)} className="fixed left-1/2 top-1/2 z-[141] flex h-[min(540px,80dvh)] w-[min(420px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[28px] bg-[#1c1c1e] p-4 text-zinc-100 shadow-2xl outline-none">
 <div className="mb-1 flex items-center gap-3"><Dialog.Title className="flex-1 text-[18px] font-semibold">{t("Эмодзи-статус")}</Dialog.Title><Dialog.Close aria-label={t("Закрыть")} className="grid size-8 place-items-center rounded-full hover:bg-white/10"><X size={20}/></Dialog.Close></div>
 <div className="min-h-0 flex-1"><AccountPackPicker kind="emoji" selectedId={value} onEmoji={(_,id)=>{if(id&&!saving)onSelect(id);}}/></div>
 <div className="mt-3 flex items-center justify-between text-[12px]"><span className="text-red-400">{error}</span><button type="button" disabled={saving} onClick={()=>onSelect(null)} className="ml-auto rounded-full px-3 py-2 hover:bg-white/8 disabled:opacity-40">{t("Убрать статус")}</button></div>
 </motion.div></Dialog.Content></Dialog.Portal>}</AnimatePresence></Dialog.Root>;
}
