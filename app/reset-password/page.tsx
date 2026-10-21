import { getServerTranslation } from "@/lib/i18n/server";
import type { Metadata } from "next";
import ResetPasswordForm from "@/app/reset-password/ResetPasswordForm";

export async function generateMetadata() {
  const t = await getServerTranslation();
  return {
  title: t("Сброс пароля"),
};
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
