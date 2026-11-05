import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function MediaLoadingPreview({ preview, fit = "cover", className, mediaStyle, loading = true }: {
  preview?: string;
  fit?: "contain" | "cover";
  className?: string;
  mediaStyle?: CSSProperties;
  loading?: boolean;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] bg-white/[.04]", className)}
      data-media-loading-preview>
      {preview && <div className="absolute inset-0" style={mediaStyle}>
        <img src={preview} alt="" draggable={false}
          className={cn("h-full w-full scale-[1.04] blur-[8px]", fit === "contain" ? "object-contain" : "object-cover")} />
      </div>}
      {loading && <div className="media-preview-sheen absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/[.12] to-transparent" />}
    </div>
  );
}
