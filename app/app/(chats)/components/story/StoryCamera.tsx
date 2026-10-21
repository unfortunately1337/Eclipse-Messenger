"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Paperclip, RotateCcw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

interface StoryCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, mediaType: "image" | "video", durationMs?: number) => void;
  onSelectFromFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function StoryCamera({
  isOpen,
  onClose,
  onCapture,
  onSelectFromFile,
}: StoryCameraProps) {
  const t = useTranslation();
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipRotation, setFlipRotation] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const cameraRequestRef = useRef(0);

  // Stop current media stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Initialize camera stream
  const startCamera = useCallback(async (facing: "user" | "environment") => {
    const request = ++cameraRequestRef.current;
    stopStream();
    setIsRecording(false);
    setCameraLoading(true);
    setCameraError(null);

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error(t("Камера не поддерживается в вашем браузере"));
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: cameraMode === "video",
      });

      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      if (request === cameraRequestRef.current) setCameraLoading(false);
    } catch (err: unknown) {
      if (request !== cameraRequestRef.current) return;
      console.warn("Camera init error:", err);
      setCameraLoading(false);
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        setCameraError(t("Доступ к камере отклонен. Разрешите доступ в настройках браузера."));
      } else {
        setCameraError(t("Не удалось подключиться к камере устройства."));
      }
    }
  }, [stopStream, cameraMode, t]);

  // Start / stop camera on open / close
  useEffect(() => {
    const frame = isOpen ? requestAnimationFrame(() => void startCamera(facingMode)) : null;
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      ++cameraRequestRef.current;
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      mediaRecorderRef.current = null;
      stopStream();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Flip camera with fast, smooth snappy animation
  const flipCamera = () => {
    if (isRecording || isFlipping) return;
    setIsFlipping(true);
    setFlipRotation((prev) => prev + 180);
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    setTimeout(() => setIsFlipping(false), 220);
  };

  // Take photo snapshot with shutter flash effect
  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    try {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 300);

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1080;
      canvas.height = video.videoHeight || 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // If front camera, mirror image
      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const request = cameraRequestRef.current;
      canvas.toBlob(
        (blob) => {
          if (!blob || request !== cameraRequestRef.current) return;
          const file = new File([blob], `story_photo_${Date.now()}.jpg`, { type: "image/jpeg" });
          stopStream();
          onCapture(file, "image");
        },
        "image/jpeg",
        0.92
      );
    } catch (err) {
      console.error("Take photo error:", err);
    }
  };

  // Start video recording with smooth transition
  const startRecording = () => {
    if (!streamRef.current || isRecording) return;

    try {
      recordedChunksRef.current = [];
      const options = MediaRecorder.isTypeSupported("video/mp4")
        ? { mimeType: "video/mp4" }
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? { mimeType: "video/webm;codecs=vp9" }
        : { mimeType: "video/webm" };

      const recorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "video/mp4";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `story_video_${Date.now()}.${ext}`, { type: mimeType });
        const durationMs = Date.now() - recordingStartTimeRef.current;
        stopStream();
        onCapture(file, "video", durationMs);
      };

      recordingStartTimeRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);

      recorder.start(250);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Start recording error:", err);
      setIsRecording(false);
    }
  };

  // Stop video recording
  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  // Shutter action
  const handleShutterClick = () => {
    if (cameraMode === "photo") {
      takePhoto();
    } else {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  // Format recording timer
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex h-full w-full flex-col bg-black text-white select-none overflow-hidden touch-none">
      {/* Hidden file input for gallery picker */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          stopStream();
          onSelectFromFile(e);
        }}
      />

      {/* Video Viewfinder with smooth 3D flip animation */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-black flex items-center justify-center [perspective:1000px]">
        <motion.video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          animate={{
            scaleX: facingMode === "user" ? -1 : 1,
            rotateY: isFlipping ? 90 : 0,
            scale: isFlipping ? 0.95 : 1,
          }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="h-full w-full object-cover will-change-transform"
        />

        {/* Shutter Flash Animation */}
        <AnimatePresence>
          {isFlashing ? (
            <motion.div
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="absolute inset-0 z-50 bg-white pointer-events-none"
            />
          ) : null}
        </AnimatePresence>



        {/* Camera Error Fallback */}
        {cameraError ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.06] text-zinc-400">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-1 max-w-[280px]">
              <h4 className="text-[17px] font-bold text-white">{t("Камера недоступна")}</h4>
              <p className="text-[13px] text-zinc-400 leading-relaxed">{t(cameraError ?? "")}</p>
            </div>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-[16px] bg-white text-zinc-950 font-bold text-[14px] shadow-lg active:scale-95 transition-transform cursor-pointer"
            >
              <Paperclip size={18} />
              <span>{t("Выбрать из галереи")}</span>
            </button>
          </div>
        ) : null}

        {/* Top Controls Overlay */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 pt-[max(env(safe-area-inset-top),16px)] bg-gradient-to-b from-black/60 via-black/20 to-transparent">
          {/* Recording Timer Badge */}
          {isRecording ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 rounded-full bg-red-600/80 backdrop-blur-md px-3.5 py-1 text-white font-mono text-[13px] font-bold shadow-lg animate-pulse"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
              <span>{formatTime(recordingSeconds)}</span>
            </motion.div>
          ) : (
            <div className="w-10" />
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            aria-label={t("Закрыть")}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-[#181818]/72 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px] hover:bg-[#222224]/80 active:scale-95 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bottom Bar Controls Overlay matching reference */}
        <div className="absolute bottom-0 inset-x-0 z-30 flex flex-col items-center pb-[max(env(safe-area-inset-bottom),20px)] pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent gap-6">
          {/* 1. Large Center Shutter Button */}
          <div className="flex justify-center w-full">
            <button
              type="button"
              onClick={handleShutterClick}
              aria-label={cameraMode === "photo" ? t("Сделать снимок") : isRecording ? t("Остановить запись") : t("Начать запись")}
              className="relative grid place-items-center cursor-pointer group active:scale-95 transition-transform"
            >
              {/* Outer Ring */}
              <motion.div
                animate={{
                  borderColor: isRecording ? "#ef4444" : "rgba(255,255,255,0.85)",
                  scale: isRecording ? 1.08 : 1,
                }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="h-[80px] w-[80px] rounded-full border-[4px] flex items-center justify-center shadow-lg"
              >
                {/* Inner Shutter Circle */}
                <motion.div
                  animate={{
                    width: isRecording ? 32 : 64,
                    height: isRecording ? 32 : 64,
                    borderRadius: isRecording ? 8 : 9999,
                    backgroundColor: isRecording ? "#dc2626" : "#ffffff",
                  }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="shadow-md"
                />
              </motion.div>
            </button>
          </div>

          {/* 2. Bottom Row on the EXACT SAME horizontal level: Paperclip | Mode Switcher | Flip Camera */}
          <div className="flex w-full items-center justify-between px-7">
            {/* Gallery Media Picker Button (Скрепка) */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              aria-label={t("Выбрать из медиа")}
              className="grid h-12 w-12 place-items-center rounded-full border border-white/[0.08] bg-[#181818]/72 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px] hover:bg-[#222224]/80 active:scale-95 transition-all cursor-pointer"
            >
              <Paperclip size={22} />
            </button>

            {/* Mode Switcher Capsule (ВИДЕО | ФОТО) matching reference with smooth spring pill transition */}
            <div className="relative flex items-center rounded-full border border-white/[0.08] bg-[#181818]/72 backdrop-blur-[16px] p-1 shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)]">
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setCameraMode("video")}
                className={cn(
                  "relative z-10 px-5 py-1.5 text-[13px] font-bold tracking-wider transition-colors duration-200 cursor-pointer disabled:opacity-50 uppercase",
                  cameraMode === "video"
                    ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {cameraMode === "video" && (
                  <motion.div
                    layoutId="camera-active-mode-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-white/[0.12] -z-10 shadow-sm border border-white/10"
                  />
                )}
                {t("Видео")}</button>
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setCameraMode("photo")}
                className={cn(
                  "relative z-10 px-5 py-1.5 text-[13px] font-bold tracking-wider transition-colors duration-200 cursor-pointer disabled:opacity-50 uppercase",
                  cameraMode === "photo"
                    ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {cameraMode === "photo" && (
                  <motion.div
                    layoutId="camera-active-mode-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-white/[0.12] -z-10 shadow-sm border border-white/10"
                  />
                )}
                {t("Фото")}</button>
            </div>

            {/* Flip Camera Button with fast smooth rotation */}
            <button
              type="button"
              onClick={flipCamera}
              aria-label={t("Перевернуть камеру")}
              disabled={isRecording}
              className="grid h-12 w-12 place-items-center rounded-full border border-white/[0.08] bg-[#181818]/72 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px] hover:bg-[#222224]/80 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
            >
              <motion.div
                animate={{ rotate: flipRotation }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="grid place-items-center"
              >
                <RotateCcw size={22} />
              </motion.div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
