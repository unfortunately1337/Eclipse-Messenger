"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, UsersRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/client/http";

type GroupView = {
  id: string;
  link: string;
  name: string;
  avatarUrl?: string | null;
  membersCount: number;
  createdAt: string;
};

export default function GroupPage() {
  const t = useTranslation();
  const params = useParams<{ link: string }>();
  const [group, setGroup] = useState<GroupView | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiRequest<{ group: GroupView | null }>(
          `/api/groups/${encodeURIComponent(params.link)}`,
          { method: "GET" },
        );
        if (!cancelled) setGroup(data.group);
      } catch (error) {
        if (!cancelled) {
          setErrorText(error instanceof Error ? error.message : t("Ошибка загрузки группы"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.link, t]);

  return (
    <div className="h-[100dvh] w-full bg-white/70 dark:bg-zinc-950/70">
      <div className="mx-auto h-full w-full max-w-2xl px-4 py-4 md:px-6 md:py-6">
        <div className="h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/20 p-4 md:p-6">
          <Link
            href="/app"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            aria-label={t("Назад")}
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="mt-6">
            {loading ? (
              <p className="text-sm text-zinc-500">{t("Загрузка группы...")}</p>
            ) : errorText ? (
              <p className="text-sm text-red-500">{errorText}</p>
            ) : !group ? (
              <p className="text-sm text-zinc-500">{t("Группа не найдена.")}</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={group.avatarUrl ?? undefined} alt={group.name} />
                    <AvatarFallback>{group.name.slice(0, 1).toUpperCase() || <UsersRound size={18} />}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-xl font-black">{group.name}</h1>
                    <p className="text-sm text-zinc-500">@{group.link}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-sm text-zinc-500">
                  {t("Участников: ")}{group.membersCount}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
