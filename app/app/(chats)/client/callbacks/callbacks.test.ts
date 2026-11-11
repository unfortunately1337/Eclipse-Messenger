import { describe, expect, it, vi } from "vitest";
import { createChatPageCallbacks, type ChatPageCallbackSources } from "./index";

describe("chat callback lifecycle", () => {
  it("constructs handlers before their render models are initialized", () => {
    const sources = new Proxy({} as ChatPageCallbackSources, {
      get(_target, name) {
        throw new Error(`Model ${String(name)} was read before initialization`);
      },
    });

    const callbacks = createChatPageCallbacks(sources);

    expect(callbacks.sendMessage).toBeTypeOf("function");
    expect(callbacks.openActiveDetails).toBeTypeOf("function");
    expect(callbacks.submitStoryDraft).toBeTypeOf("function");
    expect(callbacks.saveMemberRole).toBeTypeOf("function");
  });

  it("restores the draft through the models belonging to the same render", () => {
    function render(draft: string) {
      const setMessageText = vi.fn();
      const setEditTarget = vi.fn();
      const editPrefillTargetIdRef = { current: "editing" as string | null };
      const sources = {
        get page() {
          return {
            composerInteraction: { setEditTarget },
            selection: { setMessageText },
          };
        },
        get elements() {
          return {
            conversationElement: {
              editPrefillTargetIdRef,
              draftBeforeEditRef: { current: draft },
            },
          };
        },
      } as unknown as ChatPageCallbackSources;
      return { callbacks: createChatPageCallbacks(sources), setMessageText, setEditTarget, editPrefillTargetIdRef };
    }

    const first = render("first draft");
    const second = render("second draft");
    first.callbacks.cancelEditMode();

    expect(first.setMessageText).toHaveBeenCalledWith("first draft");
    expect(first.setEditTarget).toHaveBeenCalledWith(null);
    expect(first.editPrefillTargetIdRef.current).toBeNull();
    expect(second.setMessageText).not.toHaveBeenCalled();

    second.callbacks.cancelEditMode();
    expect(second.setMessageText).toHaveBeenCalledWith("second draft");
  });
});
