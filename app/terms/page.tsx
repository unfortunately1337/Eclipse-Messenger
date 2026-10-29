"use client";

import { useTranslation } from "@/components/LocaleProvider";
import { useRouter } from "next/navigation";
import { AuthScreen, AuthCard, AuthPrimaryButton } from "@/components/auth/auth-ui";
import { LegalDocuments } from "@/components/auth/LegalDocuments";

export default function TermsPage() {
  const t = useTranslation();
  const router = useRouter();

  return (
    <AuthScreen>
      <AuthCard title={t("Правовые документы")} subtitle={t("Политика конфиденциальности и условия Eclipse")}>
        <div className="space-y-4">
          <div className="max-h-[55dvh] min-h-0 overflow-y-auto rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 custom-scrollbar">
            <LegalDocuments />
          </div>
          <AuthPrimaryButton onClick={() => router.back()}>{t("Назад")}</AuthPrimaryButton>
        </div>
      </AuthCard>
    </AuthScreen>
  );
}
