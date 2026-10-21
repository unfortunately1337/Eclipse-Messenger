"use client";

import type { ReactNode } from "react";

export function ReplyQuote({ author, preview, background, lineColor, authorColor, previewColor, onClick }: {
  author: string;
  preview: ReactNode;
  background: string;
  lineColor: string;
  authorColor: string;
  previewColor: string;
  onClick?: () => void;
}) {
  const Surface = onClick ? "button" : "div";
  return (
    <Surface
      data-reply-quote
      {...(onClick ? { type: "button" as const } : {})}
      onClick={onClick ? event => { event.stopPropagation(); onClick(); } : undefined}
      className="relative mb-1.5 block w-full min-w-0 overflow-hidden rounded-[6px] py-1 pl-2.5 pr-2 text-left select-none transition-[filter] hover:brightness-105"
      style={{ backgroundColor: background }}
    >
      <span data-reply-rule aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-full" style={{ backgroundColor: lineColor }} />
      <span className="block truncate text-[12px] font-semibold leading-4" style={{ color: authorColor }}>{author}</span>
      <span className="mt-px block truncate text-[12px] font-normal leading-4" style={{ color: previewColor }}>{preview}</span>
    </Surface>
  );
}
