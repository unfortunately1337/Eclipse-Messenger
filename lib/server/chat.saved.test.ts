import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $transaction: vi.fn(),
  $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/lib/server/prisma", () => ({
  prisma: prismaMock,
}));

describe("saved dialog service", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    prismaMock.$executeRawUnsafe.mockClear();
  });

  it("creates a saved dialog when none exists", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      conversation: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "saved-1" }),
      },
      conversationParticipant: {
        create: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<string>) => callback(tx));

    const { getOrCreateSavedDialog, SAVED_DIALOG_TYPE, SAVED_DIALOG_TITLE } = await import("@/lib/server/chat");
    const id = await getOrCreateSavedDialog("user-1");

    expect(id).toBe("saved-1");
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.conversation.create).toHaveBeenCalledWith({
      data: {
        type: SAVED_DIALOG_TYPE,
        ownerUserId: "user-1",
        title: SAVED_DIALOG_TITLE,
        isSystem: true,
        participants: {
          create: [{ userId: "user-1" }],
        },
      },
      select: { id: true },
    });
  });

  it("reuses existing saved dialog without creating a duplicate", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          id: "saved-existing",
          participants: [{ userId: "user-1" }],
        }),
        create: vi.fn(),
      },
      conversationParticipant: {
        create: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<string>) => callback(tx));

    const { getOrCreateSavedDialog } = await import("@/lib/server/chat");
    const first = await getOrCreateSavedDialog("user-1");
    const second = await getOrCreateSavedDialog("user-1");

    expect(first).toBe("saved-existing");
    expect(second).toBe("saved-existing");
    expect(tx.conversation.create).not.toHaveBeenCalled();
    expect(tx.conversationParticipant.create).not.toHaveBeenCalled();
  });

  it("repairs participant membership on an existing saved dialog", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      conversation: {
        findFirst: vi.fn().mockResolvedValue({
          id: "saved-existing",
          participants: [],
        }),
        create: vi.fn(),
      },
      conversationParticipant: {
        create: vi.fn().mockResolvedValue({ id: "participant-1" }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<string>) => callback(tx));

    const { getOrCreateSavedDialog } = await import("@/lib/server/chat");
    const id = await getOrCreateSavedDialog("user-1");

    expect(id).toBe("saved-existing");
    expect(tx.conversationParticipant.create).toHaveBeenCalledWith({
      data: {
        conversationId: "saved-existing",
        userId: "user-1",
      },
    });
  });
});
