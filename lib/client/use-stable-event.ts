"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/** Stable event identity with the handler from the latest committed render. */
export function useStableEvent<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
  const current = useRef(handler);
  useLayoutEffect(() => { current.current = handler; }, [handler]);
  return useCallback((...args: Args) => current.current(...args), []);
}
