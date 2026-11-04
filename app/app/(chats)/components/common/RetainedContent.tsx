"use client";

import { memo, type ReactNode } from "react";

/** Preserve the committed screen through its exit, even when selection/data
 * have already changed. No clone of the message list or playing media. */
export const RetainedContent = memo(function RetainedContent({ children }: { children: ReactNode; frozen: boolean }) {
  return <>{children}</>;
}, (_previous, next) => next.frozen);
