"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
// components/registration/ChatPreview.tsx
import { motion } from "framer-motion";

export const ChatPreview = ({ displayName }: { displayName: string }) => {
  const t = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="hidden lg:flex flex-col justify-center items-center p-12 w-1/2"
        >
            <div className="w-full max-w-md space-y-6">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
                        <div className="bg-muted/50 border rounded-2xl rounded-tl-none p-4 shadow-sm">
                            <p className="text-sm">{t("Твой новый профиль выглядит круто!")}</p>
                        </div>
                    </div>

                    <motion.div
                        key={displayName}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-end gap-1"
                    >
                        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none p-4 shadow-xl">
                            <p className="text-[10px] font-black uppercase tracking-tighter mb-1 opacity-90 border-b border-primary-foreground/20 pb-1">
                                {displayName || t("Твое Имя")}
                            </p>
                            <p className="text-sm font-medium">{t("Спасибо, друг!")}</p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};
