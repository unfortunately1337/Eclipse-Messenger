import { getServerTranslation } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RegistrationForm from "@/app/sign-up/SignUpForm";
import { getCurrentUser } from "@/lib/server/auth";

export async function generateMetadata() {
  const t = await getServerTranslation();
  return {
  title: t("Создать аккаунт"),
};
}

type Props = {
  searchParams?: Promise<{ addAccount?: string }>;
};

export default async function SignUpPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : undefined;
  const isAddingAccount = params?.addAccount === "1" || params?.addAccount === "true";

  const user = await getCurrentUser();
  if (!isAddingAccount && user?.verified && user.email) {
    redirect("/app");
  }

  return (
    <RegistrationForm
      pendingEmail={user && !user.verified ? user.email : null}
      isAddingAccount={isAddingAccount}
    />
  );
}
