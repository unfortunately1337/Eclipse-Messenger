import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isCallPlaybackActive, setCallPlaybackActive, subscribeCallPlayback } from "@/lib/client/call-playback";
import { openVideoRecorderAction, sendRecordedMediaAction, startVideoRecordingForStreamAction, startVoiceRecordingAction, type OpenVideoRecorderActionContext, type SendRecordedMediaActionContext, type StartVideoRecordingForStreamActionContext, type StartVoiceRecordingActionContext } from "./recording-actions";

beforeEach(() => { vi.stubGlobal("window", new EventTarget()); });
afterEach(() => { setCallPlaybackActive(false); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("blocks microphone/camera acquisition and uploads during a call", async () => {
  setCallPlaybackActive(true);
  await startVoiceRecordingAction({} as StartVoiceRecordingActionContext);
  await openVideoRecorderAction({} as OpenVideoRecorderActionContext, true);
  await sendRecordedMediaAction({} as SendRecordedMediaActionContext, new Blob(["voice"]), "voice", 1000);
  const stop = vi.fn();
  await startVideoRecordingForStreamAction({} as StartVideoRecordingForStreamActionContext, { getTracks: () => [{ stop }] } as unknown as MediaStream);
  expect(stop).toHaveBeenCalledOnce();
});

it("releases a late microphone permission result when a call starts", async () => {
  let grant!: (stream: MediaStream) => void;
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(resolve => { grant = resolve; }) } });
  const context = { voiceStartInProgressRef: { current: false }, activeChat: { link: "peer" }, activeConversationRef: { current: { chatType: "direct" } }, selectedLinkRef: { current: "peer" }, voiceHoldActiveRef: { current: false }, recordingLocksRef: { current: { voice: false } } } as unknown as StartVoiceRecordingActionContext;
  const start = startVoiceRecordingAction(context), stop = vi.fn();
  setCallPlaybackActive(true);
  grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await start;
  expect(stop).toHaveBeenCalledOnce();
  expect(context.voiceStartInProgressRef.current).toBe(false);
});

it("does not send a recording whose upload finishes after a call starts", async () => {
  let finish!: (result: { url: string }) => void;
  const objectUrl = vi.spyOn(URL, "createObjectURL");
  const context = { activeChat: { link: "peer" }, selfId: "self", selectedLinkRef: { current: "peer" }, currentUserIdRef: { current: "self" }, pushOptimisticMessage: vi.fn(() => "draft"), setSendingMedia: vi.fn(), setSendingRealtimeKind: vi.fn(), pushSending: vi.fn(), uploadChatMediaFile: vi.fn(() => new Promise(resolve => { finish = resolve; })), sendPreparedMessage: vi.fn(), removeOptimisticMessage: vi.fn() } as unknown as SendRecordedMediaActionContext;
  const send = sendRecordedMediaAction(context, new Blob(["voice"]), "voice", 1000);
  setCallPlaybackActive(true);finish({ url: "/media/recorded.webm" });await send;
  expect(context.sendPreparedMessage).not.toHaveBeenCalled();
  expect(context.removeOptimisticMessage).toHaveBeenCalledWith("draft");
  expect(context.setSendingMedia).toHaveBeenLastCalledWith(false);
  URL.revokeObjectURL(objectUrl.mock.results[0].value);
});

it("notifies recorders only on call transitions and unlocks after leaving", () => {
  const notify = vi.fn(), unsubscribe = subscribeCallPlayback(notify);
  setCallPlaybackActive(true);setCallPlaybackActive(true);
  expect(notify).toHaveBeenCalledOnce();
  setCallPlaybackActive(false);expect(isCallPlaybackActive()).toBe(false);
  expect(notify).toHaveBeenCalledTimes(2);
  unsubscribe();setCallPlaybackActive(true);expect(notify).toHaveBeenCalledTimes(2);
});
