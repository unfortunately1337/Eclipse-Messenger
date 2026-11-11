

import { type CreatePollDialog } from "../CreatePollDialog";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface CreatePollDialogSources {
  readonly page: Pick<ChatPageStateModel, "t"> & {
    pollDraft: Pick<ChatPageStateModel["pollDraft"], "pollDialogOpen" | "setPollDialogOpen" | "pollQuestion" | "setPollQuestion" | "pollOptions" | "setPollOptions" | "pollQuizMode" | "pollCorrectOptionIndex" | "setPollCorrectOptionIndex" | "setPollQuizMode" | "pollExpiresInHours" | "setPollExpiresInHours">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "externalLinkPrompt" | "setExternalLinkPrompt">;

  };
  readonly callbacks: Pick<ChatPageCallbacks, "sendPollMessage">;
}

/** Projects only the props this memoized view consumes. */
export function bindCreatePollDialog(sources: CreatePollDialogSources): React.ComponentProps<typeof CreatePollDialog> {
  const { t } = sources.page;
  const { pollDialogOpen, setPollDialogOpen, pollQuestion, setPollQuestion, pollOptions, setPollOptions, pollQuizMode, pollCorrectOptionIndex, setPollCorrectOptionIndex, setPollQuizMode, pollExpiresInHours, setPollExpiresInHours } = sources.page.pollDraft;
  const { externalLinkPrompt, setExternalLinkPrompt } = sources.page.messageInteraction;
  const { sendPollMessage } = sources.callbacks;
  return {
    "pollDialogOpen": pollDialogOpen,
    "setPollDialogOpen": setPollDialogOpen,
    "t": t,
    "pollQuestion": pollQuestion,
    "setPollQuestion": setPollQuestion,
    "pollOptions": pollOptions,
    "setPollOptions": setPollOptions,
    "pollQuizMode": pollQuizMode,
    "pollCorrectOptionIndex": pollCorrectOptionIndex,
    "setPollCorrectOptionIndex": setPollCorrectOptionIndex,
    "setPollQuizMode": setPollQuizMode,
    "pollExpiresInHours": pollExpiresInHours,
    "setPollExpiresInHours": setPollExpiresInHours,
    "sendPollMessage": sendPollMessage,
    "externalLinkPrompt": externalLinkPrompt,
    "setExternalLinkPrompt": setExternalLinkPrompt
  };
}
