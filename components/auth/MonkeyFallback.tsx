"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";

const base = "/gifs/auth-monkey/";
type Pose = "idle" | "close" | "peek";
type Clip = Pose | "open" | "unpeek";

/** Native image decoding keeps the monkey available without a Canvas context or player chunk. */
export function MonkeyImage({ clip = "idle" }: { clip?: Clip }) {
  const src = `${base}${clip}.webp`;
  preload(src, { as: "image" });
  return (
    <img
      data-auth-monkey-fallback={clip}
      src={src}
      alt=""
      width={256}
      height={256}
      loading="eager"
      decoding="async"
      className="absolute inset-0 h-full w-full object-contain"
    />
  );
}

export function TrackingMonkeyFallback({ value }: { value: string }) {
  if (!value) return <MonkeyImage />;
  // The 25 gaze positions match the vector animation's input-length progression.
  const frame = Math.min(value.length, 24);
  return (
    <span
      data-auth-monkey-fallback="tracking"
      className="absolute inset-0"
      style={{
        backgroundImage: `url(${base}tracking.webp)`,
        backgroundSize: "500% 500%",
        backgroundPosition: `${(frame % 5) * 25}% ${Math.floor(frame / 5) * 25}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

export function PasswordMonkeyFallback({ hasPassword, showPassword }: {
  hasPassword: boolean;
  showPassword: boolean;
}) {
  const target: Pose = !hasPassword ? "idle" : showPassword ? "peek" : "close";
  const previous = useRef(target);
  const [playback, setPlayback] = useState<{ clip: Clip; revision: number }>({ clip: target, revision: 0 });

  useEffect(() => {
    if (previous.current === target) return;
    const clip: Clip = target === "idle" ? "open"
      : target === "close" && previous.current === "peek" ? "unpeek" : target;
    previous.current = target;
    // A new image node restarts single-play clips, then holds their final pose.
    setPlayback(current => ({ clip, revision: current.revision + 1 }));
    if (clip !== "open") return;
    const timer = window.setTimeout(() => {
      setPlayback(current => ({ clip: "idle", revision: current.revision + 1 }));
    }, 560);
    return () => window.clearTimeout(timer);
  }, [target]);

  return <MonkeyImage key={playback.revision} clip={playback.clip} />;
}
