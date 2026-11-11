"use client";

import { dateLocale } from "@/lib/i18n/translate";
import { MESSAGE_ROW_GAP } from "./config";

export function clampVirtualRange(
  total: number,
  start: number,
  end: number,
  overscan: number,
) {
  if (total <= 0) return { start: 0, end: -1 };
  const clampedStart = Math.max(0, start - overscan);
  const clampedEnd = Math.min(total - 1, end + overscan);
  return { start: clampedStart, end: clampedEnd };
}

export function findStartIndex(offsets: number[], sizes: number[], scrollTop: number) {
  let low = 0;
  let high = offsets.length - 1;
  let answer = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const rowEnd = offsets[mid] + sizes[mid] + MESSAGE_ROW_GAP;
    if (rowEnd > scrollTop) {
      answer = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return answer;
}

export const formatSearchCount = (value: string | number | null | undefined, one: string, few: string, many: string) => {
  const count = Math.max(0, Number(value) || 0);
  const mod10 = count % 10;
  const mod100 = count % 100;
  const label = dateLocale() === "en-US" ? count === 1 ? one : many : mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${count} ${label}`;
};
