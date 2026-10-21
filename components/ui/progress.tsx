import * as React from "react";

import { cn } from "@/lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
};

export function Progress({ value = 0, className, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-white/15", className)}
      {...props}
    >
      <div
        className="h-full w-full bg-white transition-[transform] duration-150 ease-out"
        style={{ transform: `translateX(${clamped - 100}%)` }}
      />
    </div>
  );
}
