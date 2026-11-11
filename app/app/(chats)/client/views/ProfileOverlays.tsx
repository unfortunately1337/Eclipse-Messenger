"use client";

import { LogOut } from "lucide-react";

import { MdDelete } from "react-icons/md";
import { AnimatePresence } from "framer-motion";

import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";

import { MobileUserProfile } from "../MobileUserProfile";
import { MobileChannelProfile } from "../MobileChannelProfile";
import { MobileGroupProfile } from "../MobileGroupProfile";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatInteractionModel } from "../controllers/useChatInteraction";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";
import { bindMobileUserProfile, type MobileUserProfileSources } from "../bindings/MobileUserProfile";
import { bindMobileChannelProfile, type MobileChannelProfileSources } from "../bindings/MobileChannelProfile";
import { bindMobileGroupProfile, type MobileGroupProfileSources } from "../bindings/MobileGroupProfile";

export interface ProfileOverlaysOwnSources {
  readonly page: Pick<ChatPageStateModel, "t"> & {
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "directChatDeleteConfirm" | "setDirectChatDeleteConfirm">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelDangerAction" | "channelModalData" | "setChannelDangerAction" | "channelLeaving" | "channelDeleting">;

  };
  readonly interaction: Pick<ChatInteractionModel, "deleteDirectChat">;
  readonly appearance: Pick<ChatAppearanceModel, "themedModalBackdropClassName">;
  readonly callbacks: Pick<ChatPageCallbacks, "confirmChannelDangerAction">;
}

export type ProfileOverlaysSources = ProfileOverlaysOwnSources & MobileUserProfileSources & MobileChannelProfileSources & MobileGroupProfileSources;

export function ProfileOverlays({ sources }: { sources: ProfileOverlaysSources }) {
  const { t } = sources.page;
  const { directChatDeleteConfirm, setDirectChatDeleteConfirm } = sources.page.notificationAndContacts;
  const { channelDangerAction, channelModalData, setChannelDangerAction, channelLeaving, channelDeleting } = sources.page.mediaAndChannel;
  const { deleteDirectChat } = sources.interaction;
  const { themedModalBackdropClassName } = sources.appearance;
  const { confirmChannelDangerAction } = sources.callbacks;
  return (
    <>
      <MobileUserProfile {...bindMobileUserProfile(sources)} />
      <MobileChannelProfile {...bindMobileChannelProfile(sources)} />
      <AnimatePresence>
        {directChatDeleteConfirm ? (
          <ConfirmationSheet
            open
            onOpenChange={(open) => {
              if (!open) setDirectChatDeleteConfirm(null);
            }}
            title={t("Удалить чат?")}
            description={t("Чат с {0} будет удалён полностью вместе со всей историей сообщений у обоих пользователей.", { 0: directChatDeleteConfirm.displayName })}
            actionLabel={t("Удалить")}
            actionIcon={MdDelete}
            onAction={() => {
              void deleteDirectChat(directChatDeleteConfirm.link).finally(() => {
                setDirectChatDeleteConfirm(null);
              });
            }}
            backdropClassName={themedModalBackdropClassName}
            zIndex={92}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {channelDangerAction && channelModalData?.channel ? (
          <ConfirmationSheet
            open
            onOpenChange={(open) => {
              if (!open) setChannelDangerAction(null);
            }}
            title={channelDangerAction === "delete" ? t("Удалить канал?") : t("Покинуть канал?")}
            description={
              channelDangerAction === "delete"
                ? t("Это действие удалит канал и все посты.")
                : t("Вы выйдете из канала и перестанете получать новые посты.")
            }
            actionLabel={channelDangerAction === "delete" ? t("Удалить") : t("Покинуть")}
            actionIcon={channelDangerAction === "delete" ? MdDelete : LogOut}
            actionDisabled={channelLeaving || channelDeleting}
            onAction={() => void confirmChannelDangerAction()}
            backdropClassName={themedModalBackdropClassName}
            zIndex={92}
          />
        ) : null}
      </AnimatePresence>
      <MobileGroupProfile {...bindMobileGroupProfile(sources)} />
    </>
  );
}
