import { beforeEach, expect, it, vi } from "vitest";
import { handlePollVoteAction, type PollResult } from "./poll-actions";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/client/http", () => ({ apiRequest: mocks.request }));

beforeEach(() => vi.resetAllMocks());

it("retracts instantly while the request is pending and sends an explicit cancellation", async () => {
  const before: PollResult = { totalVotes: 3, optionCounts: { 0: 2, 1: 1 }, userVotedOptionIdx: 1 };
  let state: Record<string, PollResult> = { poll: before };
  let finish!: (result: PollResult) => void;
  mocks.request.mockImplementation(() => new Promise<PollResult>(resolve => { finish = resolve; }));
  const promise = handlePollVoteAction({ current: before, setPollResults: update => { state = typeof update === "function" ? update(state) : update; } }, "poll", null);
  const after = { totalVotes: 2, optionCounts: { 0: 2, 1: 0 }, userVotedOptionIdx: null };
  expect(state.poll).toEqual(after);
  expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toEqual({ messageId: "poll", optionIdx: null });
  finish(after);
  await promise;
  expect(state.poll).toEqual(after);
});

it("does not toggle a vote off when the same option is requested again", async () => {
  const current = { totalVotes: 1, optionCounts: { 0: 1 }, userVotedOptionIdx: 0 };
  await handlePollVoteAction({ current, setPollResults: vi.fn() }, "poll", 0);
  expect(mocks.request).not.toHaveBeenCalled();
});

it("restores the previous result immediately on failure without waiting for another request", async () => {
  const before = { totalVotes: 1, optionCounts: { 0: 1 }, userVotedOptionIdx: 0 };
  let state: Record<string, PollResult> = { poll: before };
  mocks.request.mockRejectedValue(new Error("offline"));
  await expect(handlePollVoteAction({ current: before, setPollResults: update => { state = typeof update === "function" ? update(state) : update; } }, "poll", null)).rejects.toThrow("offline");
  expect(state.poll).toBe(before);
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

it("keeps a quick cancellation visible while serializing it after the pending vote", async () => {
  const before = { totalVotes: 0, optionCounts: {}, userVotedOptionIdx: null };
  let state: Record<string, PollResult> = { poll: before };
  const setPollResults: HandleSetter = update => { state = typeof update === "function" ? update(state) : update; };
  const mutationQueue = new Map<string, Promise<void>>();
  const finish: ((value: PollResult) => void)[] = [];
  mocks.request.mockImplementation(() => new Promise<PollResult>(resolve => finish.push(resolve)));
  const vote = handlePollVoteAction({ current: state.poll, setPollResults, mutationQueue }, "poll", 0);
  const voted = state.poll;
  const cancel = handlePollVoteAction({ current: state.poll, setPollResults, mutationQueue }, "poll", null);
  expect(state.poll.userVotedOptionIdx).toBe(null);
  expect(mocks.request).toHaveBeenCalledTimes(1);
  finish[0](voted);
  await vote;
  expect(state.poll.userVotedOptionIdx).toBe(null);
  expect(mocks.request).toHaveBeenCalledTimes(2);
  finish[1](before);
  await cancel;
  expect(state.poll).toEqual(before);
  expect(mutationQueue.size).toBe(0);
});

type HandleSetter = React.Dispatch<React.SetStateAction<Record<string, PollResult>>>;
