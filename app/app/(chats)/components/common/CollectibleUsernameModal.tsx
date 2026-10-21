'use client';
import { useTranslation } from "@/components/LocaleProvider";


import React, { useState } from "react";
import dynamic from "next/dynamic";
import { AtSign } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { AppToastPayload } from "@/lib/client/app-toast";
import { toast } from "sonner";

const AnimatedAtSign = dynamic(() => import("@/components/ui/animated-at-sign"), {
  ssr: false,
  loading: () => <AtSign size={88} aria-hidden />,
});

interface CollectibleUsernameModalProps {
  isOpen: boolean;
  username: string | null;
  onClose: () => void;
  showToast?: (opts: AppToastPayload) => void;
  isSelf?: boolean;
  ownerName?: string | null;
}

export function CollectibleUsernameModal({
  isOpen,
  username,
  onClose,
  showToast,
  isSelf = false,
  ownerName,
}: CollectibleUsernameModalProps) {
  const t = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [displayedUsername, setDisplayedUsername] = useState<string | null>(username);

  React.useEffect(() => {
    setCopied(false);
    if (username) {
      setDisplayedUsername(username);
    }
  }, [username, isOpen]);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const activeUsername = username || displayedUsername;
  const cleanUsername = (activeUsername ?? "").trim().replace(/^@+/, "");
  const formattedHandle = `@${cleanUsername}`;
  const targetName = isSelf ? t("вам") : (ownerName?.trim() || t("этому пользователю"));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedHandle);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (showToast) {
        showToast({ title: t("Уникальное имя скопировано"), type: "success", icon: "copy" });
      } else {
        toast.success(t("Уникальное имя скопировано"));
      }
    } catch {
      // ignore
    }
  };

  return (
    <AnimatePresence>
      {isOpen && cleanUsername && (
        <motion.div
          className="fixed inset-0 z-[450] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md select-none p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="app-panel-surface relative w-full sm:max-w-[360px] rounded-t-[32px] sm:rounded-[32px] bg-[#1a1a1e]/95 border-0 p-6 pt-6 pb-7 shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl text-white flex flex-col items-center text-center touch-none"
            initial={isMobile ? { y: "100%", opacity: 0 } : { y: 24, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={isMobile ? { y: "100%", opacity: 0 } : { y: 24, scale: 0.94, opacity: 0 }}
            transition={{
              type: "spring",
              damping: 28,
              stiffness: 320,
              mass: 0.8,
            }}
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 70 || info.velocity.y > 350) {
                onClose();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Load the animated icon only while this panel is visible. */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.12 } }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 20,
                mass: 0.75,
                delay: 0.08,
              }}
              className="relative -mt-1 mb-4 h-20 w-20 shrink-0 text-white select-none"
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <AnimatedAtSign />
              </div>
            </motion.div>

            {/* Headline */}
            <h3 className="text-[18px] font-bold text-white tracking-tight leading-snug mt-2">
              {formattedHandle}
            </h3>

            {/* Description */}
            <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed max-w-[300px] font-normal">
              {t("Коллекционное имя пользователя, принадлежащее")}{" "}
              <span className="text-white font-semibold">{targetName}</span>{t(". Его можно использовать как ссылку или для поиска.")}</p>

            {/* Action button */}
            <div className="mt-7 w-full">
              <button
                type="button"
                onClick={handleCopy}
                className="w-full h-11 rounded-2xl bg-white text-zinc-950 font-semibold text-[14px] hover:bg-zinc-100 transition-all flex items-center justify-center cursor-pointer active:scale-[0.98] border-0 outline-none shadow-[0_4px_16px_rgba(255,255,255,0.12)]"
              >
                <span>{copied ? t("Скопировано") : t("Копировать")}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
