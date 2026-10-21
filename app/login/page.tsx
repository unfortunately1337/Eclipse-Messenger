import { getServerTranslation } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { getCurrentUser } from "@/lib/server/auth";

export async function generateMetadata() {
  const t = await getServerTranslation();
  return {
  title: t("Вход в Eclipse"),
};
}

type Props = {
  searchParams?: Promise<{ addAccount?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : undefined;
  const isAddingAccount = params?.addAccount === "1" || params?.addAccount === "true";

  const user = await getCurrentUser();
  if (!isAddingAccount) {
    if (user?.verified && user.email) {
      redirect("/app");
    }
    if (user && (!user.verified || !user.email)) {
      redirect("/sign-up");
    }
  }

  return <LoginForm isAddingAccount={isAddingAccount} />;
}
