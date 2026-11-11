

import { type ProfileLinkEditor } from "../ProfileLinkEditor";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface ProfileLinkEditorSources {
  readonly page: Pick<ChatPageStateModel, "t"> & {
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "linkEditorTarget" | "setLinkEditorTarget" | "linkEditorValue" | "setLinkEditorValue" | "linkEditorStatus" | "linkEditorSaving">;

  };
  readonly callbacks: Pick<ChatPageCallbacks, "savePublicLinkChange">;
}

/** Projects only the props this memoized view consumes. */
export function bindProfileLinkEditor(sources: ProfileLinkEditorSources): React.ComponentProps<typeof ProfileLinkEditor> {
  const { t } = sources.page;
  const { linkEditorTarget, setLinkEditorTarget, linkEditorValue, setLinkEditorValue, linkEditorStatus, linkEditorSaving } = sources.page.profileNavigation;
  const { savePublicLinkChange } = sources.callbacks;
  return {
    "linkEditorTarget": linkEditorTarget,
    "setLinkEditorTarget": setLinkEditorTarget,
    "t": t,
    "linkEditorValue": linkEditorValue,
    "setLinkEditorValue": setLinkEditorValue,
    "linkEditorStatus": linkEditorStatus,
    "savePublicLinkChange": savePublicLinkChange,
    "linkEditorSaving": linkEditorSaving
  };
}
