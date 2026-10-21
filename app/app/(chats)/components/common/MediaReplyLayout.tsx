"use client";

import type { ReactNode } from "react";

// Keep the quote outside content that has no text bubble of its own.
export function MediaReplyLayout({ quote, isMine, children }: {
  quote?: ReactNode; isMine: boolean; children: ReactNode;
}) {
  if (!quote) return children;
  return (
    <div data-media-reply className={`flex w-fit max-w-full items-start gap-2 pt-3 ${isMine ? "flex-row-reverse" : ""}`}>
      <div className="min-w-0 max-w-[min(52vw,280px)] [&>*]:max-w-full [&_button]:max-w-full [&_img]:max-w-full [&_video]:max-w-full">{children}</div>
      <div className="mt-1 w-fit max-w-[min(30vw,140px)] shrink-0 text-white">{quote}</div>
    </div>
  );
}
