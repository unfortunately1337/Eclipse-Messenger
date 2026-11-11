import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ access: vi.fn(), votes: vi.fn(), remove: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: {
  message: { findUnique: vi.fn().mockResolvedValue({ id: "poll", conversationId: "chat" }) },
  conversationParticipant: { findFirst: mocks.access, findMany: vi.fn().mockResolvedValue([]) },
  pollVote: { findMany: mocks.votes, deleteMany: mocks.remove, upsert: mocks.upsert },
} }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: vi.fn().mockResolvedValue({ user: { id: "reader" } }) }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn(), ensureCsrfCookie: vi.fn() }));
vi.mock("@/lib/server/realtime", () => ({ triggerRealtimeEvent: vi.fn(), userPrivateChannel: (id: string) => id }));
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ id: "participant" });
  mocks.votes.mockResolvedValue([{ userId: "reader", optionIdx: 1 }]);
  mocks.remove.mockResolvedValue({ count: 1 });
  mocks.upsert.mockResolvedValue({});
});
const vote = (optionIdx: number | null) => POST(new NextRequest("http://localhost/api/polls", { method: "POST", body: JSON.stringify({ messageId: "poll", optionIdx }) }));

it("repeating an option keeps the vote and returns anonymous counts", async () => {
  const response = await vote(1);
  expect(response.status).toBe(200);
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.upsert).toHaveBeenCalledOnce();
  const text = await response.text();
  expect(text).toContain('"totalVotes":1');
  expect(text).not.toContain("reader");
});
it("explicitly retracts only the requesting participant's vote", async () => {
  expect((await vote(null)).status).toBe(200);
  expect(mocks.remove).toHaveBeenCalledWith({ where: { messageId: "poll", userId: "reader" } });
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it("rejects outsiders before changing any votes", async () => {
  mocks.access.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await vote(null)).status).toBe(403);
  expect(mocks.remove).not.toHaveBeenCalled();
});
