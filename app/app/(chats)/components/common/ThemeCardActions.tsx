"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ThemeCardActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const t = useTranslation();
  return <div className="absolute right-1 top-1">
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" aria-label={t("Действия с темой")}
        className="grid size-6 cursor-pointer place-items-center rounded-full bg-transparent text-white/80 hover:text-white"><MoreHorizontal size={16} /></button></DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={6} collisionPadding={12} className="z-[160] w-[160px] min-w-0 rounded-2xl p-1">
        <DropdownMenuItem onSelect={onEdit} aria-label={t("Редактировать свою тему")} className="min-h-9 gap-2 rounded-xl px-2.5 py-2 text-[13px]"><Pencil size={16} />{t("Редактировать")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} aria-label={t("Удалить свою тему")} variant="destructive" className="min-h-9 gap-2 rounded-xl px-2.5 py-2 text-[13px]"><Trash2 size={16} />{t("Удалить")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
