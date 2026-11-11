"use client";
import { ChatPageView } from "./client/views/ChatPageView";
import { OutgoingMessageActionsProvider } from "./components/common/FailedMessageActions";
import { MessageHelperPreviewProvider } from "./components/common/MessageHelperPreview";
import { createChatPageCallbacks, type ChatPageCallbackSources } from "./client/callbacks";

import { useChatPageState } from "./client/controllers/useChatPageState";
import { useChatAppearance } from "./client/controllers/useChatAppearance";
import { useChatElementState } from "./client/controllers/useChatElementState";
import { useChatInteraction } from "./client/controllers/useChatInteraction";
import { useActiveConversation } from "./client/controllers/useActiveConversation";
import { useChatBootstrap } from "./client/controllers/useChatBootstrap";
import { useConversationNavigation } from "./client/controllers/useConversationNavigation";
import { useConversationPresentation } from "./client/controllers/useConversationPresentation";
import { useProfileMedia } from "./client/controllers/useProfileMedia";
import { useChatDirectory } from "./client/controllers/useChatDirectory";
import { useMessageHistory } from "./client/controllers/useMessageHistory";
import { useMessageEncryption } from "./client/controllers/useMessageEncryption";
import { useComposerCapture } from "./client/controllers/useComposerCapture";
import { useConversationActions } from "./client/controllers/useConversationActions";
import { useMessageReactions } from "./client/controllers/useMessageReactions";
import { useChatRealtime } from "./client/controllers/useChatRealtime";
import { useProfileDetails } from "./client/controllers/useProfileDetails";
import { useChatStories } from "./client/controllers/useChatStories";
import { useChatPagePresentation } from "./client/controllers/useChatPagePresentation";

export default function ChatsPageClient() {
  // These getters are read by events after the models below are initialized.
  const callbackSources: ChatPageCallbackSources = {
    get callbacks() { return callbacks; },
    get page() { return page; },
    get bootstrap() { return bootstrap; },
    get elements() { return elements; },
    get presentation() { return presentation; },
    get active() { return active; },
    get capture() { return capture; },
    get messageActions() { return messageActions; },
    get history() { return history; },
    get encryption() { return encryption; },
    get navigation() { return navigation; },
    get stories() { return stories; },
  };
  const callbacks = createChatPageCallbacks(callbackSources);

  const page = useChatPageState({
    get elements() { return elements; },
    get history() { return history; }
  });

  const appearance = useChatAppearance({ page });

  const elements = useChatElementState({ page });

  const interaction = useChatInteraction({ elements, page });

  const active = useActiveConversation({ page, elements });

  const bootstrap = useChatBootstrap({ active, page, elements, interaction, callbacks }, {
    get history() { return history; },
    get reactions() { return reactions; }
  });

  const navigation = useConversationNavigation({ page, bootstrap, elements, active, interaction, callbacks }, {
    get history() { return history; },
    get view() { return view; }
  });

  const presentation = useConversationPresentation({ navigation, page, callbacks, active, bootstrap, elements }, {
    get view() { return view; }
  });

  const profileMedia = useProfileMedia({ presentation, page, active, bootstrap, callbacks, elements });

  const directory = useChatDirectory({ profileMedia, active, page, presentation, elements, bootstrap, interaction }, {
    get reactions() { return reactions; }
  });

  const history = useMessageHistory({ elements, page, directory, bootstrap, active, callbacks, presentation, interaction });

  const encryption = useMessageEncryption({ history, presentation, elements, directory, page, interaction, bootstrap }, {
    get reactions() { return reactions; }
  });

  const capture = useComposerCapture({ page, elements, history, bootstrap, active, presentation, encryption, callbacks });

  const messageActions = useConversationActions({ page, bootstrap, elements, directory, callbacks, active, presentation });

  const reactions = useMessageReactions({ page, callbacks, elements, active, messageActions, history, bootstrap, encryption });

  const realtime = useChatRealtime({ reactions, encryption, bootstrap, page, messageActions, active, elements, history, callbacks, interaction, navigation, capture });

  const details = useProfileDetails({ page, active, presentation, elements, bootstrap, profileMedia, callbacks, reactions, interaction, messageActions, directory, history });

  const stories = useChatStories({ page, elements, details, active });

  const view = useChatPagePresentation({ page, active, presentation, directory, history, appearance, reactions, callbacks, stories });

  return <MessageHelperPreviewProvider><OutgoingMessageActionsProvider retry={message => capture.sendPreparedMessage(message.text, { resetComposer: false, replyToMessageId: message.replyToMessageId, optimisticMessageId: message.id })}><ChatPageView sources={{ view, presentation, appearance, page, realtime, active, messageActions, callbacks, directory, stories, elements, interaction, bootstrap, details, navigation, history, encryption, reactions, profileMedia, capture }} /></OutgoingMessageActionsProvider></MessageHelperPreviewProvider>;
}
