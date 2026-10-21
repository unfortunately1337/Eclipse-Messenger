"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import type { AnimationItem } from "lottie-web";
import { cn } from "@/lib/utils";
import { loadLottiePlayer } from "@/lib/client/lottie-player";
import { MonkeyImage, PasswordMonkeyFallback, TrackingMonkeyFallback } from "./MonkeyFallback";

// Instant background prefetch for 🔐 gif as soon as auth module loads
if (typeof window !== "undefined") {
  const preloadLockImg = new Image();
  preloadLockImg.src = "/gifs/lock-key.gif";
  const preloadCodeImg = new Image();
  preloadCodeImg.src = "/gifs/auth-code-message.webp";
}

const jsonCache = new Map<string, unknown>();

/** Local animated 💬, resized for auth so no third-party request is needed. */
export function CodeMessageAnimation({ size = 135 }: { size?: number }) {
  const [loaded, setLoaded] = useState(false);
  preload("/gifs/auth-code-message.webp", { as: "image", fetchPriority: "high" });
  return <div data-auth-code-animation aria-hidden className="relative shrink-0 select-none pointer-events-none -my-1" style={{ width: size, height: size }}>
    <img src="/emoji-picker/chat-bubble.large-still-hq-v1.webp" alt="" width={size} height={size} className={cn("absolute inset-0 h-full w-full object-contain", loaded && "opacity-0")} />
    <img src="/gifs/auth-code-message.webp" alt="" width={size} height={size} loading="eager" decoding="async" fetchPriority="high" onLoad={() => setLoaded(true)} className="relative h-full w-full object-contain" />
  </div>;
}

async function getAnimationData(src: string) {
  if (jsonCache.has(src)) {
    return jsonCache.get(src);
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to load animation: ${src}`);
  const data = await res.json();
  jsonCache.set(src, data);
  return data;
}

function whenAnimationLoaded(animation: AnimationItem): Promise<void> {
  if (animation.isLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    animation.addEventListener("DOMLoaded", () => resolve());
    animation.addEventListener("data_failed", () => reject(new Error("Animation data could not be rendered")));
  });
}

/**
 * Generic Lottie Animation player
 */
export function AuthAnimation({
  src,
  size = 145,
  loop = true,
  autoplay = true,
  className,
}: {
  src: string;
  size?: number;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !src) return;

    let isCancelled = false;

    Promise.all([loadLottiePlayer(), getAnimationData(src)])
      .then(async ([lottie, animationData]) => {
        if (!lottie) return;
        if (isCancelled || !containerRef.current) return;
        if (animRef.current) {
          animRef.current.destroy();
          animRef.current = null;
        }
        animRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop,
          autoplay,
          animationData,
        });
        await whenAnimationLoaded(animRef.current);
        if (!isCancelled) setReady(true);
      })
      .catch((err) => {
        console.error("Lottie load error:", err);
      });

    return () => {
      isCancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [src, loop, autoplay]);

  return (
    <div
      style={{ width: size, height: size }}
      className={cn("relative select-none pointer-events-none flex items-center justify-center shrink-0 -my-2", className)}
    >
      {!ready && <MonkeyImage />}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}

/**
 * Tracking Monkey that follows the input text length / cursor smoothly
 */
export function MonkeyTrackingAnimation({
  value = "",
  size = 145,
  className,
}: {
  value?: string;
  size?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let isCancelled = false;

    Promise.all([loadLottiePlayer(), getAnimationData("/tgs/TwoFactorSetupMonkeyTracking.json")])
      .then(async ([lottie, animationData]) => {
        if (!lottie) return;
        if (isCancelled || !containerRef.current) return;
        if (animRef.current) {
          animRef.current.destroy();
          animRef.current = null;
        }
        const anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: false,
          autoplay: false,
          animationData,
        });
        animRef.current = anim;
        await whenAnimationLoaded(anim);
        if (!isCancelled) setReady(true);
      })
      .catch((err) => {
        console.error("Tracking monkey load error:", err);
      });

    return () => {
      isCancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, []);

  // Update gaze frame smoothly as text is entered
  useEffect(() => {
    const anim = animRef.current;
    if (!anim || !anim.totalFrames) return;

    if (!value || value.length === 0) {
      anim.goToAndStop(0, true);
    } else {
      const progress = Math.min(value.length / 24, 1);
      const targetFrame = Math.floor(progress * (anim.totalFrames - 1));
      anim.goToAndStop(targetFrame, true);
    }
  }, [value, ready]);

  return (
    <div
      style={{ width: size, height: size }}
      className={cn("relative select-none pointer-events-none flex items-center justify-center shrink-0 -my-2", className)}
    >
      {!ready && <TrackingMonkeyFallback value={value} />}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}

/**
 * Idle Monkey that sits calmly, breathing and blinking
 */
export function MonkeyIdleAnimation({
  size = 145,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <AuthAnimation
      src="/tgs/TwoFactorSetupMonkeyIdle.json"
      size={size}
      loop={true}
      autoplay={true}
      className={className}
    />
  );
}

/**
 * Multi-layer living Monkey Password animation:
 * - Idle when empty
 * - Covers eyes when typing password (Close)
 * - Peeks with one eye when toggle is on (Peek)
 * - Lowers paws back down when cleared (ToIdle)
 */
export function MonkeyPasswordAnimation({
  hasPassword,
  showPassword,
  size = 145,
  className,
}: {
  hasPassword: boolean;
  showPassword: boolean;
  size?: number;
  className?: string;
}) {
  const idleRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const toIdleRef = useRef<HTMLDivElement>(null);

  const idleAnim = useRef<AnimationItem | null>(null);
  const closeAnim = useRef<AnimationItem | null>(null);
  const peekAnim = useRef<AnimationItem | null>(null);
  const toIdleAnim = useRef<AnimationItem | null>(null);

  const [activeLayer, setActiveLayer] = useState<"idle" | "close" | "peek" | "toIdle">("idle");
  const [ready, setReady] = useState(false);
  const prevTargetRef = useRef<"idle" | "close" | "peek">("idle");

  // Preload and mount all 4 layers
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const lottie = await loadLottiePlayer();
        if (!active || !lottie) return;
        const [idleData, closeData, peekData, toIdleData] = await Promise.all([
          getAnimationData("/tgs/TwoFactorSetupMonkeyIdle.json"),
          getAnimationData("/tgs/TwoFactorSetupMonkeyClose.json"),
          getAnimationData("/tgs/TwoFactorSetupMonkeyCloseAndPeek.json"),
          getAnimationData("/tgs/TwoFactorSetupMonkeyCloseAndPeekToIdle.json"),
        ]);

        if (!active) return;

        if (idleRef.current && !idleAnim.current) {
          idleAnim.current = lottie.loadAnimation({
            container: idleRef.current,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData: idleData,
          });
        }

        if (closeRef.current && !closeAnim.current) {
          closeAnim.current = lottie.loadAnimation({
            container: closeRef.current,
            renderer: "svg",
            loop: false,
            autoplay: false,
            animationData: closeData,
          });
        }

        if (peekRef.current && !peekAnim.current) {
          peekAnim.current = lottie.loadAnimation({
            container: peekRef.current,
            renderer: "svg",
            loop: false,
            autoplay: false,
            animationData: peekData,
          });
        }

        if (toIdleRef.current && !toIdleAnim.current) {
          toIdleAnim.current = lottie.loadAnimation({
            container: toIdleRef.current,
            renderer: "svg",
            loop: false,
            autoplay: false,
            animationData: toIdleData,
          });
        }

        await Promise.all([idleAnim.current, closeAnim.current, peekAnim.current, toIdleAnim.current]
          .filter((animation): animation is AnimationItem => animation !== null)
          .map(whenAnimationLoaded));
        if (active) setReady(true);
      } catch (err) {
        console.error("Failed to initialize monkey animations:", err);
      }
    }

    void init();

    return () => {
      active = false;
      idleAnim.current?.destroy();
      closeAnim.current?.destroy();
      peekAnim.current?.destroy();
      toIdleAnim.current?.destroy();
      idleAnim.current = null;
      closeAnim.current = null;
      peekAnim.current = null;
      toIdleAnim.current = null;
    };
  }, []);

  // Handle transitions
  useEffect(() => {
    if (!ready) return;

    let target: "idle" | "close" | "peek";
    if (!hasPassword) {
      target = "idle";
    } else if (showPassword) {
      target = "peek";
    } else {
      target = "close";
    }

    const prev = prevTargetRef.current;
    if (prev === target) return;
    prevTargetRef.current = target;

    if (target === "close") {
      if (prev === "peek") {
        // Reverse peek to closed
        if (peekAnim.current) {
          peekAnim.current.setDirection(-1);
          peekAnim.current.play();
          const onPeekReverseComplete = () => {
            peekAnim.current?.removeEventListener("complete", onPeekReverseComplete);
            setActiveLayer("close");
            closeAnim.current?.goToAndStop(closeAnim.current.totalFrames - 1, true);
          };
          peekAnim.current.addEventListener("complete", onPeekReverseComplete);
        } else {
          setActiveLayer("close");
          closeAnim.current?.goToAndStop(closeAnim.current.totalFrames - 1, true);
        }
      } else {
        // Transition from open to closed
        setActiveLayer("close");
        if (closeAnim.current) {
          closeAnim.current.setDirection(1);
          closeAnim.current.setSpeed(1.3);
          closeAnim.current.goToAndPlay(0, true);
        }
      }
    } else if (target === "peek") {
      // Transition from closed to peek (one eye open)
      setActiveLayer("peek");
      if (peekAnim.current) {
        peekAnim.current.setDirection(1);
        peekAnim.current.setSpeed(1.2);
        peekAnim.current.goToAndPlay(0, true);
      }
    } else if (target === "idle") {
      // Transition from closed/peek back down to idle (living monkey lowers paws)
      if (prev === "close" || prev === "peek") {
        setActiveLayer("toIdle");
        if (toIdleAnim.current) {
          toIdleAnim.current.setDirection(1);
          toIdleAnim.current.setSpeed(1.3);
          toIdleAnim.current.goToAndPlay(0, true);

          const onToIdleComplete = () => {
            toIdleAnim.current?.removeEventListener("complete", onToIdleComplete);
            setActiveLayer("idle");
            idleAnim.current?.goToAndPlay(0, true);
          };
          toIdleAnim.current.addEventListener("complete", onToIdleComplete);
        } else {
          setActiveLayer("idle");
          idleAnim.current?.goToAndPlay(0, true);
        }
      } else {
        setActiveLayer("idle");
        idleAnim.current?.goToAndPlay(0, true);
      }
    }
  }, [ready, hasPassword, showPassword]);

  return (
    <div
      style={{ width: size, height: size }}
      className={cn("relative select-none pointer-events-none flex items-center justify-center shrink-0 -my-2 overflow-hidden", className)}
    >
      {!ready && <PasswordMonkeyFallback hasPassword={hasPassword} showPassword={showPassword} />}
      <div
        ref={idleRef}
        style={{ width: size, height: size }}
        className={cn("absolute inset-0 transition-opacity duration-150", activeLayer === "idle" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0")}
      />
      <div
        ref={closeRef}
        style={{ width: size, height: size }}
        className={cn("absolute inset-0 transition-opacity duration-150", activeLayer === "close" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0")}
      />
      <div
        ref={peekRef}
        style={{ width: size, height: size }}
        className={cn("absolute inset-0 transition-opacity duration-150", activeLayer === "peek" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0")}
      />
      <div
        ref={toIdleRef}
        style={{ width: size, height: size }}
        className={cn("absolute inset-0 transition-opacity duration-150", activeLayer === "toIdle" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0")}
      />
    </div>
  );
}

/**
 * 🔐 Telegram Animated Lock with Key GIF for Password Recovery / Security
 * Designed for instant zero-latency rendering with HTML stream preload and memory prefetch.
 */
export function LockKeyGifAnimation({
  size = 135,
  className,
}: {
  size?: number;
  className?: string;
}) {
  // Hint browser to preload in HTML stream
  preload("/gifs/lock-key.gif", { as: "image", fetchPriority: "high" });

  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "relative select-none pointer-events-none flex items-center justify-center shrink-0 -my-1",
        className
      )}
    >
      <img
        src="/gifs/lock-key.gif"
        alt="🔐"
        width={size}
        height={size}
        className="w-full h-full object-contain pointer-events-none select-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
