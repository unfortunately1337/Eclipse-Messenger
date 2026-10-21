import { prisma } from "@/lib/server/prisma";

export type StoredContact = {
  peerId: string;
  alias: string;
  createdAt: string;
  updatedAt: string;
};

export async function getContact(ownerId: string, peerId: string) {
  const contact = await prisma.contact.findUnique({
    where: {
      ownerId_peerId: {
        ownerId,
        peerId,
      },
    },
    select: {
      peerId: true,
      alias: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!contact) {
    return null;
  }

  return {
    peerId: contact.peerId,
    alias: contact.alias,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  } satisfies StoredContact;
}

export async function saveContact(params: {
  ownerId: string;
  peerId: string;
  alias: string;
}) {
  const saved = await prisma.contact.upsert({
    where: {
      ownerId_peerId: {
        ownerId: params.ownerId,
        peerId: params.peerId,
      },
    },
    create: {
      ownerId: params.ownerId,
      peerId: params.peerId,
      alias: params.alias,
    },
    update: {
      alias: params.alias,
    },
    select: {
      peerId: true,
      alias: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    peerId: saved.peerId,
    alias: saved.alias,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
  } satisfies StoredContact;
}

export async function deleteContact(ownerId: string, peerId: string) {
  await prisma.contact.deleteMany({
    where: {
      ownerId,
      peerId,
    },
  });
}

export async function getContactsMap(ownerId: string) {
  const items = await prisma.contact.findMany({
    where: { ownerId },
    select: {
      peerId: true,
      alias: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const result = new Map<string, StoredContact>();
  for (const item of items) {
    result.set(item.peerId, {
      peerId: item.peerId,
      alias: item.alias,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    });
  }

  return result;
}
