import { createSecretChatCallbacks, type SecretChatCallbackSources } from "./secretchat-callbacks";
import { createMessageCallbacks, type MessageCallbackSources } from "./message-callbacks";
import { createProfileCallbacks, type ProfileCallbackSources } from "./profile-callbacks";
import { createCommunityCallbacks, type CommunityCallbackSources } from "./community-callbacks";
import { createStoryCallbacks, type StoryCallbackSources } from "./story-callbacks";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export type ChatPageCallbackSources = SecretChatCallbackSources & MessageCallbackSources & ProfileCallbackSources & CommunityCallbackSources & StoryCallbackSources;

/** Source getters bind to this render; no shared mutable controller is introduced. */
export function createChatPageCallbacks(sources: ChatPageCallbackSources): ChatPageCallbacks {
  return {
    ...createSecretChatCallbacks(sources),
    ...createMessageCallbacks(sources),
    ...createProfileCallbacks(sources),
    ...createCommunityCallbacks(sources),
    ...createStoryCallbacks(sources),
  };
}
