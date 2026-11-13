"use client";

import { InviteLinksPanel } from "../../components/common/InviteLinksPanel";

import { MemberActionMenu } from "../../components/common/MemberActionMenu";

import { MemberRoleDialog } from "../../components/common/MemberRoleDialog";

import { LogOut } from "lucide-react";

import { MdDelete } from "react-icons/md";
import { AnimatePresence } from "framer-motion";

import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";

import { getPresenceStatusText } from "@/lib/client/presence-status";
import { showAppToast } from "@/lib/client/app-toast";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface CommunityDialogsOwnSources {
  readonly page: Pick<ChatPageStateModel, "memberContextMenu" | "t" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs"> & {
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "inviteModalOpen" | "inviteModalKind" | "inviteModalLink" | "setInviteModalOpen" | "groupModalData" | "groupMemberRemovalTarget" | "setGroupMemberRemovalTarget" | "removingMemberId" | "channelSubscriberRemovalTarget" | "setChannelSubscriberRemovalTarget" | "removingSubscriberId" | "leavingGroup" | "deletingGroup">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    memberRole: Pick<ChatPageStateModel["memberRole"], "roleModalMember" | "roleEditorKind" | "roleNameDraft" | "setRoleNameDraft" | "setRoleModalMember" | "permPostMessages" | "setPermPostMessages" | "permPinMessages" | "permStartVideoChat" | "setPermPinMessages" | "setPermStartVideoChat" | "permEditForeignMessages" | "setPermEditForeignMessages" | "permDeleteForeignMessages" | "setPermDeleteForeignMessages" | "permDeleteForeign" | "setPermDeleteForeign" | "permChangeAvatar" | "setPermChangeAvatar" | "permChangeName" | "setPermChangeName" | "permChangeReactions" | "setPermChangeReactions" | "permAddMembers" | "setPermAddMembers" | "permGenerateInviteLink" | "setPermGenerateInviteLink" | "permManageAdmins" | "setPermManageAdmins">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelModalData" | "savingRole" | "groupDangerAction" | "setGroupDangerAction">;

  };
  readonly active: Pick<ActiveConversationModel, "leftSidebarThemeStyle">;
  readonly bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache">;
  readonly appearance: Pick<ChatAppearanceModel, "themedModalBackdropClassName">;
  readonly callbacks: Pick<ChatPageCallbacks, "saveMemberRole" | "removeMemberFromGroup" | "removeSubscriberFromChannel" | "confirmGroupDangerAction">;
}

export type CommunityDialogsSources = CommunityDialogsOwnSources;

export function CommunityDialogs({ sources }: { sources: CommunityDialogsSources }) {
  const { memberContextMenu, t, onlineUserIds, lastOfflineAtByUserId, presenceNowTs } = sources.page;
  const { inviteModalOpen, inviteModalKind, inviteModalLink, setInviteModalOpen, groupModalData, groupMemberRemovalTarget, setGroupMemberRemovalTarget, removingMemberId, channelSubscriberRemovalTarget, setChannelSubscriberRemovalTarget, removingSubscriberId, leavingGroup, deletingGroup } = sources.page.groupDetails;
  const { isDesktop } = sources.page.panels;
  const { roleModalMember, roleEditorKind, roleNameDraft, setRoleNameDraft, setRoleModalMember, permPostMessages, setPermPostMessages, permPinMessages, permStartVideoChat, setPermPinMessages, setPermStartVideoChat, permEditForeignMessages, setPermEditForeignMessages, permDeleteForeignMessages, setPermDeleteForeignMessages, permDeleteForeign, setPermDeleteForeign, permChangeAvatar, setPermChangeAvatar, permChangeName, setPermChangeName, permChangeReactions, setPermChangeReactions, permAddMembers, setPermAddMembers, permGenerateInviteLink, setPermGenerateInviteLink, permManageAdmins, setPermManageAdmins } = sources.page.memberRole;
  const { channelModalData, savingRole, groupDangerAction, setGroupDangerAction } = sources.page.mediaAndChannel;
  const { leftSidebarThemeStyle } = sources.active;
  const { readProfileFromCache } = sources.bootstrap;
  const { themedModalBackdropClassName } = sources.appearance;
  const { saveMemberRole, removeMemberFromGroup, removeSubscriberFromChannel, confirmGroupDangerAction } = sources.callbacks;
  return (
    <>
      <AnimatePresence>
        {inviteModalOpen && inviteModalKind && inviteModalLink ? <InviteLinksPanel
          key={inviteModalKind + ":" + inviteModalLink}
          kind={inviteModalKind} link={inviteModalLink} desktop={isDesktop}
          panelThemeStyle={leftSidebarThemeStyle}
          onClose={() => setInviteModalOpen(false)}
          notify={message => showAppToast({ type: "info", title: message })}
        /> : null}
      </AnimatePresence>
      <AnimatePresence>
        {memberContextMenu.menu && <MemberActionMenu menu={memberContextMenu.menu} onClose={memberContextMenu.close} />}
      </AnimatePresence>
      <AnimatePresence>
        {roleModalMember && (groupModalData?.group || channelModalData?.channel) ? (
          <MemberRoleDialog
            key={roleModalMember.id}
            member={roleModalMember}
            panelThemeStyle={leftSidebarThemeStyle}
            statusText={t(getPresenceStatusText(roleModalMember.id, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, readProfileFromCache(roleModalMember.id)?.presenceVisibility !== "none", readProfileFromCache(roleModalMember.id)?.lastSeenVisibility !== "none"))}
            online={onlineUserIds.has(roleModalMember.id)}
            desktop={isDesktop}
            channel={roleEditorKind === "channel"}
            backdropClassName={themedModalBackdropClassName}
            roleName={roleNameDraft}
            onRoleNameChange={setRoleNameDraft}
            saving={savingRole}
            onClose={() => !savingRole && setRoleModalMember(null)}
            onSave={() => void saveMemberRole()}
            messagePermissions={roleEditorKind === "channel" ? [
              { id: "post", label: t("Отправка публикаций"), enabled: permPostMessages, onChange: setPermPostMessages },
              { id: "pin", label: t("Закрепление сообщений"), enabled: permPinMessages, onChange: setPermPinMessages },
              { id: "edit", label: t("Редактирование чужих публикаций"), enabled: permEditForeignMessages, onChange: setPermEditForeignMessages },
              { id: "delete", label: t("Удаление чужих публикаций"), enabled: permDeleteForeignMessages, onChange: setPermDeleteForeignMessages },
            ] : [
              { id: "post", label: t("Отправка сообщений"), enabled: permPostMessages, onChange: setPermPostMessages },
              { id: "pin", label: t("Закрепление сообщений"), enabled: permPinMessages, onChange: setPermPinMessages },
              { id: "delete", label: t("Удаление чужих сообщений"), enabled: permDeleteForeign, onChange: setPermDeleteForeign },
            ]}
            permissions={[
              { id: "avatar", label: t("Менять аватар"), enabled: permChangeAvatar, onChange: setPermChangeAvatar },
              { id: "name", label: roleEditorKind === "channel" ? t("Менять название канала") : t("Менять название группы"), enabled: permChangeName, onChange: setPermChangeName },
              { id: "reactions", label: t("Изменение реакций"), enabled: permChangeReactions, onChange: setPermChangeReactions },
              ...(roleEditorKind === "group" ? [{ id: "videochat", label: t("Начинать видеочат"), enabled: permStartVideoChat, onChange: setPermStartVideoChat }] : []),
              { id: "members", label: roleEditorKind === "channel" ? t("Добавлять подписчиков") : t("Добавлять участников"), enabled: permAddMembers, onChange: setPermAddMembers },
              ...((roleEditorKind === "channel" ? !channelModalData?.channel?.isPublic : !groupModalData?.group?.isPublic) ? [
                { id: "invite", label: t("Генерация приватной ссылки"), enabled: permGenerateInviteLink, onChange: setPermGenerateInviteLink },
              ] : []),
              { id: "admins", label: t("Назначение администраторов"), enabled: permManageAdmins, onChange: setPermManageAdmins },
            ]}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {groupMemberRemovalTarget && groupModalData?.group ? (
          <ConfirmationSheet
            open
            onOpenChange={(open) => {
              if (!open) setGroupMemberRemovalTarget(null);
            }}
            title={t("Удалить участника?")}
            description={t("Пользователь {0} будет удалён из группы {1}.", { 0: groupMemberRemovalTarget.displayName, 1: groupModalData.group.name })}
            actionLabel={t("Удалить")}
            actionIcon={MdDelete}
            actionDisabled={removingMemberId === groupMemberRemovalTarget.id}
            onAction={() => {
              void removeMemberFromGroup(groupMemberRemovalTarget.id).finally(() => {
                setGroupMemberRemovalTarget(null);
              });
            }}
            backdropClassName={themedModalBackdropClassName}
            zIndex={93}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {channelSubscriberRemovalTarget && channelModalData?.channel ? (
          <ConfirmationSheet
            open
            onOpenChange={(open) => {
              if (!open) setChannelSubscriberRemovalTarget(null);
            }}
            title={t("Удалить подписчика?")}
            description={t("Пользователь {0} будет удалён из канала {1}.", { 0: channelSubscriberRemovalTarget.displayName, 1: channelModalData.channel.name })}
            actionLabel={t("Удалить")}
            actionIcon={MdDelete}
            actionDisabled={removingSubscriberId === channelSubscriberRemovalTarget.id}
            onAction={() => {
              void removeSubscriberFromChannel(channelSubscriberRemovalTarget.id).finally(() => {
                setChannelSubscriberRemovalTarget(null);
              });
            }}
            backdropClassName={themedModalBackdropClassName}
            zIndex={93}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {groupDangerAction && groupModalData?.group ? (
          <ConfirmationSheet
            open
            onOpenChange={(open) => {
              if (!open) setGroupDangerAction(null);
            }}
            title={groupDangerAction === "delete" ? t("Удалить группу?") : t("Покинуть группу?")}
            description={
              groupDangerAction === "delete"
                ? t("Это действие удалит группу и историю сообщений для всех участников.")
                : t("Вы выйдете из группы и потеряете доступ к её чату.")
            }
            actionLabel={groupDangerAction === "delete" ? t("Удалить") : t("Покинуть")}
            actionIcon={groupDangerAction === "delete" ? MdDelete : LogOut}
            actionDisabled={leavingGroup || deletingGroup}
            onAction={() => void confirmGroupDangerAction()}
            backdropClassName={themedModalBackdropClassName}
            zIndex={93}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
