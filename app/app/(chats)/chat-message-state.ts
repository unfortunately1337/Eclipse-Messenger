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

export function appendAndSortMessages<T extends { id: string; createdAt: string; pending?: boolean; text?: string | null; senderId?: string | null; localId?: string | null }>(prev: T[], nextMessage: T) {
  if (prev.some((message) => message.id === nextMessage.id || (message.localId && message.localId === nextMessage.id))) {
    return prev;
  }

  // If nextMessage is a confirmed message (not pending), check if an optimistic pending message matches it
  if (!nextMessage.pending && (nextMessage as any).senderId && (nextMessage as any).text) {
    const pendingIndex = prev.findIndex(
      (m) => m.pending && (m as any).senderId === (nextMessage as any).senderId && (m as any).text === (nextMessage as any).text,
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

export function finalizeOptimisticMessage<T extends { id: string; createdAt: string; pending?: boolean; localId?: string | null }>(options: {
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

export function mergeMessageWindow<T extends { id: string; createdAt: string; localId?: string | null }>(baseMessages: T[], nextWindow: T[]) {
  if (baseMessages.length === 0) {
    return nextWindow.slice().sort(compareMessagesByTime);
  }
  if (nextWindow.length === 0) {
    return baseMessages.slice().sort(compareMessagesByTime);
  }

  const baseById = new Map(baseMessages.map((message) => [message.id, message]));
  const nextById = new Map(
    nextWindow.map((message) => {
      const existing = baseById.get(message.id);
      const stableMessage =
        existing?.localId
          ? {
              ...message,
              localId: existing.localId,
              createdAt: existing.createdAt || message.createdAt,
            }
          : message;
      return [message.id, stableMessage as T];
    }),
  );
  const merged = baseMessages.filter((message) => !nextById.has(message.id));
  merged.push(...nextById.values());
  return merged.sort(compareMessagesByTime);
}
