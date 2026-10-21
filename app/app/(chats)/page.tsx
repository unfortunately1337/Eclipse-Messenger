import { getServerTranslation } from "@/lib/i18n/server";
﻿import type { Metadata } from "next";
import ChatsPageClient from "@/app/app/(chats)/ChatsPageClient";

export async function generateMetadata() {
  const t = await getServerTranslation();
  return {
  title: t("Чаты"),
};
}

export default function ChatsPage() {
  return <ChatsPageClient />;
}
