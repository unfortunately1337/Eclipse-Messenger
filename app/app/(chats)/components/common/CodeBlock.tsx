"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { SearchHighlightedText } from "./SearchHighlightedText";

export function CodeBlock({ code, language, searchQuery = "" }: { code: string; language?: string; searchQuery?: string }) {
  const t = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-2 flex flex-col w-full max-w-full overflow-hidden rounded-[13px] border border-white/[0.08] bg-black/40 backdrop-blur-md shadow-sm select-text text-left">
      <div className="flex items-center justify-between bg-white/[0.04] px-3.5 py-1.5 border-b border-white/[0.05] text-[11px] font-medium text-zinc-400 select-none">
        <span className="lowercase tracking-wider font-mono text-[11px] opacity-80">{language || t("код")}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-[6px] px-2 py-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer text-[11px]"
          title={copied ? t("Скопировано") : t("Копировать код")}
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" strokeWidth={2.5} />
              <span className="text-emerald-400 font-medium">{t("Скопировано")}</span>
            </>
          ) : (
            <>
              <Copy size={12} strokeWidth={2} />
              <span>{t("Копировать")}</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-zinc-100 no-scrollbar select-text">
        <code className="select-text"><SearchHighlightedText text={code} query={searchQuery} /></code>
      </pre>
    </div>
  );
}

export function parseCodeBlocks(text: string) {
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  const result: Array<{ type: "code-block" | "inline"; language?: string; text: string; code?: string }> = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: "inline", text: text.slice(lastIndex, match.index) });
    }
    result.push({ type: "code-block", language: match[1] || undefined, text: "", code: match[2]?.trimEnd() || "" });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    result.push({ type: "inline", text: text.slice(lastIndex) });
  }
  return result;
}

export function SpoilerText({ children }: { children: React.ReactNode }) {
  const t = useTranslation();
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      onClick={() => setRevealed(true)}
      className={`inline rounded px-1 transition-all cursor-pointer ${
        revealed
          ? "bg-transparent"
          : "bg-white/20 text-transparent filter blur-[4px] select-none hover:bg-white/25"
      }`}
      title={revealed ? undefined : t("Нажмите, чтобы показать спойлер")}
    >
      {children}
    </span>
  );
}

export function parseBold(text: string, keyPrefix: string, renderTextWithEmojis: (val: string) => React.ReactNode): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  let elementIndex = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`${keyPrefix}-plain-${elementIndex}`}>
          {renderTextWithEmojis(text.slice(lastIndex, match.index))}
        </span>
      );
      elementIndex++;
    }
    parts.push(
      <strong key={`${keyPrefix}-bold-${elementIndex}`} className="font-semibold text-current">
        {renderTextWithEmojis(match[1])}
      </strong>
    );
    elementIndex++;
    lastIndex = boldRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`${keyPrefix}-plain-${elementIndex}`}>
        {renderTextWithEmojis(text.slice(lastIndex))}
      </span>
    );
  }

  return parts;
}

export function parseInlineMarkdown(text: string, keyPrefix: string, renderTextWithEmojis: (val: string) => React.ReactNode, searchQuery = ""): React.ReactNode[] {
  // Line-by-line check for blockquotes and headers if multi-line
  const lines = text.split("\n");
  if (lines.length > 1) {
    return lines.map((line, lineIndex) => {
      const lineKey = `${keyPrefix}-line-${lineIndex}`;
      const isLast = lineIndex === lines.length - 1;

      // Blockquote line: starts with "> "
      if (line.startsWith("> ")) {
        return (
          <React.Fragment key={lineKey}>
            <span className="my-1 block border-l-[3px] border-[var(--ui-accent-solid,#38bdf8)]/80 pl-2.5 py-0.5 bg-white/[0.04] rounded-r-md text-current italic">
              {parseInlineTokens(line.slice(2), `${lineKey}-quote`, renderTextWithEmojis, searchQuery)}
            </span>
            {!isLast && "\n"}
          </React.Fragment>
        );
      }

      // Heading: starts with "### ", "## ", "# "
      const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
      if (headingMatch) {
        return (
          <React.Fragment key={lineKey}>
            <span className="my-1 block font-bold text-[15px] leading-snug text-current">
              {parseInlineTokens(headingMatch[2], `${lineKey}-heading`, renderTextWithEmojis, searchQuery)}
            </span>
            {!isLast && "\n"}
          </React.Fragment>
        );
      }

      return (
        <React.Fragment key={lineKey}>
          {parseInlineTokens(line, lineKey, renderTextWithEmojis, searchQuery)}
          {!isLast && "\n"}
        </React.Fragment>
      );
    });
  }

  return parseInlineTokens(text, keyPrefix, renderTextWithEmojis, searchQuery);
}

function parseInlineTokens(text: string, keyPrefix: string, renderTextWithEmojis: (val: string) => React.ReactNode, searchQuery = ""): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Token regex matching code, spoiler, bold-italic, bold, strikethrough, italic (* or _)
  const tokenRegex = /(`[^`\n]+`)|(\|\|[\s\S]+?\|\|)|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(~~([^~]+)~~)|(\*([^*\n]+)\*)|(\b_([^_]+)_\b)/g;
  let lastIndex = 0;
  let match;
  let elementIndex = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`${keyPrefix}-plain-${elementIndex}`}>
          {renderTextWithEmojis(text.slice(lastIndex, match.index))}
        </span>
      );
      elementIndex++;
    }

    if (match[1]) {
      // Inline code
      parts.push(
        <code
          key={`${keyPrefix}-code-${elementIndex}`}
          className="mx-0.5 px-1.5 py-0.5 rounded-[5px] bg-black/25 dark:bg-white/10 font-mono text-[12.5px] text-zinc-200 border border-white/[0.05] align-baseline select-text inline-block"
        >
          <SearchHighlightedText text={match[1].slice(1, -1)} query={searchQuery} />
        </code>
      );
    } else if (match[2]) {
      // Spoiler ||text||
      parts.push(
        <SpoilerText key={`${keyPrefix}-spoiler-${elementIndex}`}>
          {renderTextWithEmojis(match[2].slice(2, -2))}
        </SpoilerText>
      );
    } else if (match[3]) {
      // Bold + Italic ***text***
      parts.push(
        <strong key={`${keyPrefix}-bi-${elementIndex}`} className="font-semibold italic text-current">
          {renderTextWithEmojis(match[4])}
        </strong>
      );
    } else if (match[5]) {
      // Bold **text**
      parts.push(
        <strong key={`${keyPrefix}-bold-${elementIndex}`} className="font-semibold text-current">
          {renderTextWithEmojis(match[6])}
        </strong>
      );
    } else if (match[7]) {
      // Strikethrough ~~text~~
      parts.push(
        <del key={`${keyPrefix}-del-${elementIndex}`} className="line-through text-current opacity-80">
          {renderTextWithEmojis(match[8])}
        </del>
      );
    } else if (match[9]) {
      // Italic *text*
      parts.push(
        <em key={`${keyPrefix}-em1-${elementIndex}`} className="italic text-current">
          {renderTextWithEmojis(match[10])}
        </em>
      );
    } else if (match[11]) {
      // Italic _text_
      parts.push(
        <em key={`${keyPrefix}-em2-${elementIndex}`} className="italic text-current">
          {renderTextWithEmojis(match[12])}
        </em>
      );
    }

    elementIndex++;
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`${keyPrefix}-plain-${elementIndex}`}>
        {renderTextWithEmojis(text.slice(lastIndex))}
      </span>
    );
  }

  return parts;
}
