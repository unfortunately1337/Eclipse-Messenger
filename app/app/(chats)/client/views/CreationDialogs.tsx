"use client";

import { CreateCommunityPanel } from "../CreateCommunityPanel";
import { CreateSecretChatPanel } from "../CreateSecretChatPanel";
import { CreatePollDialog } from "../CreatePollDialog";

import { bindCreateCommunityPanel, type CreateCommunityPanelSources } from "../bindings/CreateCommunityPanel";
import { bindCreateSecretChatPanel, type CreateSecretChatPanelSources } from "../bindings/CreateSecretChatPanel";
import { bindCreatePollDialog, type CreatePollDialogSources } from "../bindings/CreatePollDialog";

export type CreationDialogsSources = CreateCommunityPanelSources & CreateSecretChatPanelSources & CreatePollDialogSources;

export function CreationDialogs({ sources }: { sources: CreationDialogsSources }) {

  return (
    <>
      <CreateCommunityPanel {...bindCreateCommunityPanel(sources)} />
      {/* Secret Chat Create Modal */}
      <CreateSecretChatPanel {...bindCreateSecretChatPanel(sources)} />
      <CreatePollDialog {...bindCreatePollDialog(sources)} />
    </>
  );
}
