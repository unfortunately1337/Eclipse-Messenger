import { getServerTranslation } from "@/lib/i18n/server";
import type { Metadata } from "next";
import MFAForm from "@/app/login/mfa/MFAForm";

export async function generateMetadata() {
  const t = await getServerTranslation();
  return {
  title: t("Подтверждение входа"),
};
}

export default function MFAPage() {
  return <MFAForm />;
}
