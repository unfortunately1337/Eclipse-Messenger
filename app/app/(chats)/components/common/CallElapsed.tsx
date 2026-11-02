"use client";

import { memo, useEffect, useState } from "react";
import { callElapsedSeconds, formatCallElapsed, observeCallElapsed } from "@/lib/client/call-elapsed";

/** Timer updates stay inside the label instead of rerendering the media scene. */
export const CallElapsed = memo(function CallElapsed({ startedAt }: { startedAt: number }) {
  const [seconds, setSeconds] = useState(() => callElapsedSeconds(startedAt));
  useEffect(() => observeCallElapsed(startedAt, setSeconds), [startedAt]);
  return <span data-call-elapsed>{formatCallElapsed(seconds)}</span>;
});
