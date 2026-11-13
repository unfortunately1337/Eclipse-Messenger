"use client";

import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { PiWaveformBold } from "react-icons/pi";
import { MediaAvatar } from "@/components/ui/media";
import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";
import { useLanguage, useTranslation } from "@/components/LocaleProvider";
import { plural } from "@/lib/i18n/translate";
import type { GroupCallActivity } from "@/lib/calls";
import type { useCalls } from "../../hooks/useCalls";

export type GroupVideoChatTarget = { link: string; title: string; avatarUrl?: string | null; canStart: boolean };
type Controller = Pick<ReturnType<typeof useCalls>, "groupCall" | "current" | "groupEnabled" | "busy" | "start" | "join">;
const EMPTY = new Map<string, GroupCallActivity>();
const Activity = createContext<ReadonlyMap<string, GroupCallActivity>>(EMPTY);
const OpenLobby = createContext<(target: GroupVideoChatTarget) => void>(() => {});
export function GroupCallActivityProvider({ activities, controller, children }: { activities?: GroupCallActivity[]; controller?: Controller; children: ReactNode }) {
  const value = useMemo(() => activities?.length ? new Map(activities.map(call => [call.link, call])) : EMPTY, [activities]);
  const [target, setTarget] = useState<GroupVideoChatTarget | null>(null);
  return <Activity.Provider value={value}><OpenLobby.Provider value={setTarget}>{children}
    {target && controller && <GroupVideoChatLobby key={target.link} target={target} controller={controller} onClose={() => setTarget(null)} />}
  </OpenLobby.Provider></Activity.Provider>;
}
export function useGroupCallActivity(link: string) { return useContext(Activity).get(link); }
export function useOpenGroupVideoChat() { return useContext(OpenLobby); }

export function GroupCallListMarker({ link }: { link: string }) {
  const t = useTranslation();
  const call = useGroupCallActivity(link);
  if (!call) return null;
  const label = t("Видеочат: {0} участников", { 0: call.participantCount });
  return <span data-group-call-marker title={label} aria-label={label} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-200"><PiWaveformBold size={13} aria-hidden />{call.participantCount}</span>;
}

export function GroupVideoChatBanner({ link, title, avatarUrl, style }: { link: string; title: string; avatarUrl?: string | null; style?: CSSProperties }) {
  const t = useTranslation();
  const { locale } = useLanguage();
  const call = useGroupCallActivity(link);
  const open = useOpenGroupVideoChat();
  if (!call) return null;
  return <button type="button" data-group-video-chat onClick={() => open({ link, title, avatarUrl, canStart: false })} style={style}
    className="pointer-events-auto mx-auto flex min-h-10 w-full items-center gap-2.5 rounded-full px-3.5 py-1.5 text-left text-zinc-100 transition-colors hover:brightness-110 active:scale-[0.995]">
    <PiWaveformBold size={21} className="shrink-0 text-zinc-200" />
    <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold leading-4">{t("Видеочат")}</span><span data-group-call-count className="mt-0.5 block text-[11px] leading-4 tabular-nums text-zinc-400">{plural(call.participantCount, ["участник", "участника", "участников"], "participant", locale)}</span></span>
    <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-zinc-100">{t("Присоединиться")}</span>
  </button>;
}

function GroupVideoChatLobby({ target, controller, onClose }: { target: GroupVideoChatTarget; controller: Controller; onClose: () => void }) {
  const t = useTranslation();
  const { locale } = useLanguage();
  const { link, title, avatarUrl, canStart } = target;
  const activity = useGroupCallActivity(link);
  const call = controller.groupCall?.link === link ? controller.groupCall : controller.current?.kind === "group" && controller.current.link === link ? controller.current : null;
  const active = call?.status === "active" ? call : null;
  const count = active?.participantCount ?? activity?.participantCount ?? 0;
  const callId = active?.id ?? activity?.id;
  const joined = Boolean(active?.onThisSession);
  const people = active?.participants ?? [];
  const countLabel = plural(count, ["участник", "участника", "участников"], "participant", locale);
  const inAnotherCall = Boolean(controller.current && (controller.current.kind !== "group" || controller.current.link !== link));
  const unavailable = !controller.groupEnabled || inAnotherCall;
  const busy = controller.busy;
  const status = inAnotherCall ? "Сначала завершите текущий звонок" : !callId && !canStart ? "Дождитесь, пока администратор начнёт видеочат" : null;
  return (
    <ConfirmationSheet open onOpenChange={value => { if (!value) onClose(); }} title={<span className="block text-center">{t("Видеочат")}</span>}
      description={callId ? <span className="block text-center text-[13px] leading-5 text-zinc-400">{t("Присоединитесь к разговору в группе")}</span> : undefined}
      details={<div className="flex flex-col items-center gap-4 py-2">
        <MediaAvatar src={avatarUrl ?? undefined} alt={title} fallbackText={title.slice(0, 1)} className="size-20 rounded-full" />
        <div className="text-center"><p className="text-[19px] font-semibold text-zinc-100">{title}</p><p className="mt-1 text-[13px] text-zinc-400">{callId ? countLabel : t("Участники смогут присоединиться из группы")}</p></div>
        {people.length > 0 && <div className="flex max-w-full flex-wrap justify-center gap-3">{people.slice(0, 6).map(person => <div key={person.id} className="flex w-14 flex-col items-center gap-1.5"><MediaAvatar src={person.avatarUrl ?? undefined} alt={person.name} fallbackText={person.name.slice(0, 1)} className="size-11 rounded-full" /><span className="w-full truncate text-center text-[11px] text-zinc-400">{person.name}</span></div>)}</div>}
        {status && <p role="status" className="text-center text-[12px] leading-5 text-zinc-400">{t(status)}</p>}
      </div>}
      actionLabel={t(joined ? "Вы участвуете" : callId ? "Присоединиться" : "Начать видеочат")} actionIcon={PiWaveformBold}
      cancelLabel={t("Отмена")} footerClassName="mr-0 mb-0 flex-col-reverse items-stretch gap-1"
      cancelClassName="w-full rounded-full normal-case text-zinc-400 hover:text-white"
      actionClassName="h-11 w-full rounded-full bg-white px-5 normal-case text-zinc-950 hover:bg-zinc-200 hover:text-zinc-950" actionDisabled={busy || unavailable || joined || (!callId && !canStart)}
      onAction={() => { onClose(); if (callId) void controller.join(callId); else void controller.start("video", { kind: "group", link }); }} />
  );
}
