"use client";

import { MdDelete } from "react-icons/md";
import { HiMusicalNote } from "react-icons/hi2";
import { useTranslation } from "@/components/LocaleProvider";
import { Spinner } from "@/components/ui/spinner";

export function ProfileMusicEditor({ music, uploading, coverUploading, saving, onRemove, onChooseAudio, onChooseCover, onTitleChange, onAuthorChange }: {
  music: { musicUrl?: string | null; musicTitle?: string | null; musicAuthor?: string | null; musicCoverUrl?: string | null };
  uploading: boolean;
  coverUploading: boolean;
  saving: boolean;
  onRemove: () => void;
  onChooseAudio: () => void;
  onChooseCover: () => void;
  onTitleChange: (title: string) => void;
  onAuthorChange: (author: string) => void;
}) {
  const t = useTranslation();
  return <section data-profile-music-editor className="mx-5 space-y-4 rounded-[24px] bg-white/[0.04] p-4">
    <header className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center text-zinc-200"><HiMusicalNote size={21} /></span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-5 text-white">{t("Музыка в профиле")}</h3>
        <p className="mt-0.5 text-[12px] leading-4 text-zinc-400">{t(uploading ? "Загрузка аудиофайла..." : music.musicUrl ? "Трек загружен" : "Загрузите трек (MP3, WAV)")}</p>
      </div>
      {music.musicUrl && <div className="flex shrink-0 gap-0.5">
        <button type="button" onClick={onRemove} disabled={uploading || coverUploading || saving} aria-label={t("Удалить аудиофайл")} title={t("Удалить аудиофайл")}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"><MdDelete size={21} /></button>
      </div>}
    </header>
    {music.musicUrl ? <div className="flex items-center gap-3">
      <button type="button" onClick={onChooseCover} disabled={coverUploading} aria-label={t("Изменить обложку")}
        className="relative grid size-[84px] shrink-0 cursor-pointer place-items-center overflow-hidden rounded-[20px] bg-white/[0.06] text-zinc-300 disabled:cursor-wait">
        {music.musicCoverUrl ? <img src={music.musicCoverUrl} alt={t("Обложка")} className="size-full object-cover" /> : <HiMusicalNote size={30} />}
        {coverUploading && <span className="absolute inset-0 grid place-items-center bg-black/45"><Spinner className="size-5 animate-spin text-white" /></span>}
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-[18px] border border-white/[0.08] px-3.5 py-2 transition-colors focus-within:border-[var(--ui-accent-solid,#38bdf8)]">
          <input type="text" value={music.musicTitle ?? ""} onChange={event => onTitleChange(event.target.value)} placeholder={t("Название трека")} aria-label={t("Название трека")} maxLength={64}
            className="w-full bg-transparent text-[14.5px] text-white outline-none placeholder:text-zinc-500" />
        </div>
        <div className="rounded-[18px] border border-white/[0.08] px-3.5 py-2 transition-colors focus-within:border-[var(--ui-accent-solid,#38bdf8)]">
          <input type="text" value={music.musicAuthor ?? ""} onChange={event => onAuthorChange(event.target.value)} placeholder={t("Исполнитель")} aria-label={t("Исполнитель")} maxLength={64}
            className="w-full bg-transparent text-[14.5px] text-white outline-none placeholder:text-zinc-500" />
        </div>
      </div>
    </div> : <button type="button" disabled={uploading} onClick={onChooseAudio}
      className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-50">
      {uploading ? <Spinner className="size-4 animate-spin" /> : <><HiMusicalNote size={18} />{t("Выбрать аудиофайл")}</>}
    </button>}
  </section>;
}
