"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { videoCallPoster } from "@/lib/client/videocall-poster";

export const VIDEO_CALL_ANIMATION = "/animations/videocall.webp";

/** Inline first frame appears with the dialog; native playback needs no JS player. */
export function GroupVideoChatAnimation() {
  const reduced = useReducedMotion(), [ready, setReady] = useState(false);
  return <div data-group-call-animation aria-hidden className="pointer-events-none relative size-36 shrink-0 select-none">
    <img src={videoCallPoster} width={144} height={144} alt="" className={`absolute inset-0 size-full object-contain ${ready && !reduced ? "invisible" : ""}`} />
    {!reduced && <img data-group-call-animation-player src={VIDEO_CALL_ANIMATION} width={144} height={144} alt="" loading="eager" decoding="async" fetchPriority="high" onLoad={() => setReady(true)} className={`absolute inset-0 size-full object-contain transition-opacity duration-150 ${ready ? "opacity-100" : "opacity-0"}`} />}
  </div>;
}
