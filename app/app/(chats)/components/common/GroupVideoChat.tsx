"use client";

import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { preload } from "react-dom";
import { PiWaveformBold } from "react-icons/pi";
import { MediaAvatar } from "@/components/ui/media";
import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";
import { useLanguage, useTranslation } from "@/components/LocaleProvider";
import { plural } from "@/lib/i18n/translate";
import type { GroupCallActivity, CallView } from "@/lib/calls";
import type { useCalls } from "../../hooks/useCalls";
import { PANEL_EASE } from "@/lib/client/panel-motion";
import { GroupVideoChatAnimation, VIDEO_CALL_ANIMATION } from "./GroupVideoChatAnimation";

export type GroupVideoChatTarget = { link: string; title: string; avatarUrl?: string | null; canStart: boolean };
type Controller = Pick<ReturnType<typeof useCalls>, "groupCall" | "current" | "groupEnabled" | "busy" | "start" | "join">;
const EMPTY = new Map<string, GroupCallActivity>();
const Activity = createContext<ReadonlyMap<string, GroupCallActivity>>(EMPTY);
const OpenLobby = createContext<(target: GroupVideoChatTarget) => void>(() => {});
const JoinedGroup = createContext<string | null>(null);
const GroupDetails = createContext<CallView | null>(null);
function sampledPeople(call: CallView | null | undefined, limit: number) {
  const rank = (id: string) => { let value = 2166136261; for (const char of `${call?.id}:${id}`) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; };
  return [...(call?.participants ?? [])].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id)).slice(0, limit);
}
export function GroupCallActivityProvider({ activities, controller, children }: { activities?: GroupCallActivity[]; controller?: Controller; children: ReactNode }) {
  const reduced = useReducedMotion();
  if (controller?.groupEnabled && !reduced) preload(VIDEO_CALL_ANIMATION, { as: "image", fetchPriority: "low" });
  const value = useMemo(() => activities?.length ? new Map(activities.map(call => [call.link, call])) : EMPTY, [activities]);
  const [target, setTarget] = useState<GroupVideoChatTarget | null>(null);
  const own = controller?.current?.kind === "group" ? controller.current : controller?.groupCall;
  const joined = own?.onThisSession && own.status !== "ended" ? own.link : null;
  const details = controller?.groupCall ?? (controller?.current?.kind === "group" ? controller.current : null);
  return <Activity.Provider value={value}><JoinedGroup.Provider value={joined}><GroupDetails.Provider value={details}><OpenLobby.Provider value={setTarget}>{children}
    <AnimatePresence>{target && controller && <GroupVideoChatLobby key={target.link} target={target} controller={controller} onClose={() => setTarget(null)} />}</AnimatePresence>
  </OpenLobby.Provider></GroupDetails.Provider></JoinedGroup.Provider></Activity.Provider>;
}
export function useGroupCallActivity(link: string) { return useContext(Activity).get(link); }
export function useOpenGroupVideoChat() { return useContext(OpenLobby); }

export function GroupCallListMarker({ link }: { link: string }) {
  const t = useTranslation();
  const reduced = useReducedMotion();
  const call = useGroupCallActivity(link);
  const label = call ? t("Видеочат: {0} участников", { 0: call.participantCount }) : undefined;
  return <AnimatePresence initial={false}>{call && <motion.span key={call.id} className="inline-flex shrink-0 overflow-hidden align-middle"
    initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : .2, ease: PANEL_EASE }}>
    <span data-group-call-marker title={label} aria-label={label} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-200"><PiWaveformBold size={13} aria-hidden />{call.participantCount}</span>
  </motion.span>}</AnimatePresence>;
}

export function GroupVideoChatBanner({ link, title, avatarUrl, style }: { link: string; title: string; avatarUrl?: string | null; style?: CSSProperties }) {
  const t = useTranslation();
  const reduced = useReducedMotion();
  const { locale } = useLanguage();
  const call = useGroupCallActivity(link);
  const open = useOpenGroupVideoChat();
  const joined = useContext(JoinedGroup);
  const details = useContext(GroupDetails);
  const people = useMemo(() => sampledPeople(details?.link === link ? details : null, 5), [details, link]);
  return <AnimatePresence>{call && joined !== link && <motion.div key={call.id} className="overflow-hidden"
    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : .24, ease: PANEL_EASE }}>
    <motion.button type="button" data-group-video-chat onClick={() => open({ link, title, avatarUrl, canStart: false })} style={style}
    initial={{ y: reduced ? 0 : -6 }} animate={{ y: 0 }} exit={{ y: reduced ? 0 : -4 }} transition={{ duration: reduced ? 0 : .24, ease: PANEL_EASE }}
    className="pointer-events-auto mx-auto flex min-h-10 w-full items-center gap-2.5 rounded-full px-3.5 py-1.5 text-left text-zinc-100 transition-colors hover:brightness-110 active:scale-[0.995]">
    <PiWaveformBold size={21} className="shrink-0 text-zinc-200" />
    <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold leading-4">{t("Видеочат")}</span><span data-group-call-count className="mt-0.5 block text-[11px] leading-4 tabular-nums text-zinc-400">{plural(call.participantCount, ["участник", "участника", "участников"], "participant", locale)}</span></span>
    {people.length > 0 && <span data-group-call-avatars className="flex shrink-0 -space-x-2.5 pl-2" aria-hidden>{people.map(person => <span key={person.id} className="relative rounded-full ring-2 ring-[#202023]"><MediaAvatar src={person.avatarUrl ?? undefined} alt={person.name} fallbackText={person.name.slice(0, 1)} className="size-7 rounded-full" /></span>)}</span>}
  </motion.button></motion.div>}</AnimatePresence>;
}

function GroupVideoChatLobby({ target, controller, onClose }: { target: GroupVideoChatTarget; controller: Controller; onClose: () => void }) {
  const t = useTranslation();
  const { link, title, canStart } = target;
  const activity = useGroupCallActivity(link);
  const call = controller.groupCall?.link === link ? controller.groupCall : controller.current?.kind === "group" && controller.current.link === link ? controller.current : null;
  const active = call?.status === "active" ? call : null;
  const count = active?.participantCount ?? activity?.participantCount ?? 0;
  const callId = active?.id ?? activity?.id;
  const joined = Boolean(active?.onThisSession);
  const people = useMemo(() => sampledPeople(active, 8), [active]);
  const remaining = Math.max(0, count - people.length);
  const inAnotherCall = Boolean(controller.current && (controller.current.kind !== "group" || controller.current.link !== link));
  const unavailable = !controller.groupEnabled || inAnotherCall;
  const busy = controller.busy;
  const status = inAnotherCall ? "Сначала завершите текущий звонок" : !callId && !canStart ? "Дождитесь, пока администратор начнёт видеочат" : null;
  return (
    <ConfirmationSheet open onOpenChange={value => { if (!value) onClose(); }} title={<span className="block text-center">{t("Видеочат")}</span>}
      description={callId ? <span className="block text-center text-[13px] leading-5 text-zinc-400">{t("Присоединитесь к разговору в группе")}</span> : undefined}
      details={<div className="flex flex-col items-center gap-4 py-2">
        <GroupVideoChatAnimation />
        <p className="text-center text-[13px] text-zinc-400">{callId ? t("В видеочате:") : t("Участники смогут присоединиться из группы")}</p>
        {people.length > 0 && <div data-group-call-lobby-people className="flex max-w-full items-center justify-center -space-x-4 px-1" aria-label={t("Участники видеочата")}>{people.map((person, index) => <span key={person.id} title={person.name} className="relative shrink-0 rounded-full ring-[3px] ring-[#202023]" style={{ zIndex: people.length - index }}><MediaAvatar src={person.avatarUrl ?? undefined} alt={person.name} fallbackText={person.name.slice(0, 1)} className="size-10 rounded-full min-[380px]:size-11" /></span>)}</div>}
        {remaining > 0 && <p className="text-[12px] text-zinc-400">{t("…и ещё {0}", { 0: remaining })}</p>}
        {status && <p role="status" className="text-center text-[12px] leading-5 text-zinc-400">{t(status)}</p>}
      </div>}
      actionLabel={t(joined ? "Вы участвуете" : callId ? "Присоединиться" : "Начать видеочат")} actionIcon={PiWaveformBold}
      cancelLabel={t("Отмена")} footerClassName="mr-0 mb-0 flex-col-reverse items-stretch gap-1"
      cancelClassName="w-full rounded-full normal-case text-zinc-400 hover:text-white"
      actionClassName="h-11 w-full rounded-full bg-white px-5 normal-case text-zinc-950 hover:bg-zinc-200 hover:text-zinc-950" actionDisabled={busy || unavailable || joined || (!callId && !canStart)}
      onAction={() => { onClose(); if (callId) void controller.join(callId); else void controller.start("video", { kind: "group", link, title }); }} />
  );
}
