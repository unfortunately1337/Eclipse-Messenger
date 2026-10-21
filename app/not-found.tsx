'use client'
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Home, ArrowLeft, Ghost } from "lucide-react";

export default function NotFound() {
  const t = useTranslation();
    const router = useRouter();

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center bg-[#fafafa] dark:bg-[#09090b] p-4 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
                <motion.div
                    initial={{ y: 0 }}
                    animate={{ y: [-20, 0, -20] }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="mb-8 p-6 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] shadow-2xl"
                >
                    <Ghost size={80} className="text-primary opacity-80" />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h1 className="text-[120px] font-black leading-none tracking-tighter text-zinc-950 dark:text-zinc-50 opacity-10 select-none">
                        404
                    </h1>
                    <h2 className="text-3xl font-black mt-[-40px] mb-4">{t("Упс! Тут пусто")}</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-10 max-w-[320px] mx-auto">
                        {t("Похоже исчезла или никогда не существовала.")}</p>
                </motion.div>

                {/* Кнопки управления */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-col sm:flex-row gap-4 w-full"
                >
                    <Button
                        onClick={() => router.back()}
                        variant="outline"
                        className="h-12 px-8 rounded-2xl border-zinc-200 dark:border-zinc-800 font-bold gap-2 flex-1"
                    >
                        <ArrowLeft size={18} />
                        {t("Назад")}</Button>

                    <Button
                        onClick={() => router.push("/")}
                        className="h-12 px-8 rounded-2xl font-bold gap-2 flex-1 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                    >
                        <Home size={18} />
                        {t("На главную")}</Button>
                </motion.div>

                {/* Декоративный элемент "пути" */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.6, duration: 1 }}
                    className="h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent mt-16 w-full"
                />
            </div>
        </div>
    );
}