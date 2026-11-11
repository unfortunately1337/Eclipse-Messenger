export function compareMessagesByTime<T extends { id?: string; createdAt: string }>(a: T, b: T) {
  const aTime = Date.parse(a.createdAt);
  const bTime = Date.parse(b.createdAt);

  if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
    return 0;
  }
  if (Number.isNaN(aTime)) {
    return 1;
  }
  if (Number.isNaN(bTime)) {
    return -1;
  }
  const diff = aTime - bTime;
  if (diff !== 0) return diff;

  return 0;
}

export function appendAndSortMessages<T extends { id: string; createdAt: string; pending?: boolean; sendFailure?: unknown; text?: string | null; senderId?: string | null; localId?: string | null }>(prev: T[], nextMessage: T) {
  if (prev.some((message) => message.id === nextMessage.id || (message.localId && message.localId === nextMessage.id))) {
    return prev;
  }

  // If nextMessage is a confirmed message (not pending), check if an optimistic pending message matches it
  if (!nextMessage.pending && !nextMessage.sendFailure && nextMessage.senderId && nextMessage.text) {
    const pendingIndex = prev.findIndex(
      (m) => m.pending && m.senderId === nextMessage.senderId && m.text === nextMessage.text,
    );
    if (pendingIndex >= 0) {
      const pendingMsg = prev[pendingIndex];
      const updated: T = {
        ...pendingMsg,
        ...nextMessage,
        localId: pendingMsg.localId || pendingMsg.id,
        pending: false,
      };
      const next = prev.filter((m, i) => i === pendingIndex || m.id !== nextMessage.id);
      const nextIdx = next.findIndex((m) => m.id === pendingMsg.id || m.localId === pendingMsg.id);
      if (nextIdx >= 0) {
        next[nextIdx] = updated;
      } else {
        next.push(updated);
      }
      return next;
    }
  }
  if (prev.length === 0) return [nextMessage];

  const nextTs = Date.parse(nextMessage.createdAt);
  if (Number.isNaN(nextTs)) {
    return [...prev, nextMessage];
  }

  let low = 0;
  let high = prev.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midTs = Date.parse(prev[mid].createdAt);
    const normalizedMidTs = Number.isNaN(midTs) ? Number.POSITIVE_INFINITY : midTs;
    if (normalizedMidTs <= nextTs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return [...prev.slice(0, low), nextMessage, ...prev.slice(low)];
}

export function finalizeOptimisticMessage<T extends { id: string; createdAt: string; pending?: boolean; localId?: string | null; sendFailure?: unknown }>(options: {
  prev: T[];
  nextMessage: T;
  optimisticMessageId?: string | null;
}) {
  const { prev, nextMessage, optimisticMessageId } = options;
  if (!optimisticMessageId) {
    return appendAndSortMessages(prev, nextMessage);
  }

  const optimisticIndex = prev.findIndex(
    (message) => message.id === optimisticMessageId || message.localId === optimisticMessageId,
  );
  if (optimisticIndex < 0) {
    return appendAndSortMessages(prev, nextMessage);
  }

  const optimisticMessage = prev[optimisticIndex];
  const updatedMessage: T = {
    ...optimisticMessage,
    ...nextMessage,
    createdAt: optimisticMessage.createdAt || nextMessage.createdAt,
    pending: false,
    sendFailure: undefined,
  };

  const next = prev.filter(
    (message, index) =>
      index === optimisticIndex || (message.id !== nextMessage.id && message.id !== optimisticMessageId),
  );
  const nextOptimisticIndex = next.findIndex(
    (message) => message.id === optimisticMessageId || message.localId === optimisticMessageId,
  );
  if (nextOptimisticIndex >= 0) {
    next[nextOptimisticIndex] = updatedMessage;
  } else {
    next.push(updatedMessage);
  }
  return next;
}

export function getEcliStreamDurationMs(textLength: number) {
  if (textLength <= 0) return 0;
  return Math.min(24_000, Math.max(2_800, 1_800 + textLength * 38));
}

export function getEcliStreamRevealIndex(elapsedMs: number, textLength: number, totalDurationMs: number) {
  if (textLength <= 0) return 0;
  if (elapsedMs >= totalDurationMs) return textLength;
  const progress = Math.min(1, elapsedMs / totalDurationMs);
  const eased = 1 - Math.pow(1 - progress, 1.25);
  return Math.min(textLength, Math.floor(eased * textLength));
}

export function mergeMessageWindow<T extends { id: string; createdAt: string; localId?: string | null; pending?: boolean; sendFailure?: unknown; text?: string | null; senderId?: string | null }>(baseMessages: T[], nextWindow: T[]) {
  if (baseMessages.length === 0) {
    return nextWindow.slice().sort(compareMessagesByTime);
  }
  if (nextWindow.length === 0) {
    return baseMessages.slice().sort(compareMessagesByTime);
  }

  const baseById = new Map(baseMessages.map((message) => [message.id, message]));
  const replacedPending = new Set<string>();
  const nextById = new Map(
    nextWindow.map((message) => {
      // Bot refreshes can arrive before the HTTP send response. Reconcile that
      // echo with one pending row instead of briefly displaying both bubbles.
      const pending = !baseById.has(message.id) && !message.pending && !message.sendFailure && message.senderId && message.text
        ? baseMessages.find(value => value.pending && !replacedPending.has(value.id) && value.senderId === message.senderId && value.text === message.text && Math.abs(Date.parse(value.createdAt) - Date.parse(message.createdAt)) < 30_000)
        : undefined;
      if (pending) replacedPending.add(pending.id);
      const existing = baseById.get(message.id) ?? pending;
      const stableMessage =
        existing?.localId || pending
          ? {
              ...message,
              localId: existing?.localId ?? pending?.id,
              createdAt: existing?.createdAt || message.createdAt,
              pending: false,
            }
          : message;
      return [message.id, stableMessage as T];
    }),
  );
  const merged = baseMessages.filter((message) => !nextById.has(message.id) && !replacedPending.has(message.id));
  merged.push(...nextById.values());
  return merged.sort(compareMessagesByTime);
}

/** The row index is absolute even when only a slice of the chat is mounted. */
export function getMessageSelectionNeighbors(
  messages: readonly { id: string }[],
  index: number,
  selected: ReadonlySet<string>,
) {
  const previousId = messages[index - 1]?.id;
  const nextId = messages[index + 1]?.id;
  return {
    previous: previousId !== undefined && selected.has(previousId),
    next: nextId !== undefined && selected.has(nextId),
  };
}

