"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { STORY_FONTS, normalizeStoryFont, storyFontStyle, type StoryFont } from "@/lib/story-fonts";
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Pencil, Type, Eraser, X, Download, Smile, Upload, Check, Undo2 } from "lucide-react";
import { PencilSparkles } from "./PencilSparkles";
import { StorySizeButton } from "./StorySizeButton";
import { StoryColorPicker } from "./StoryColorPicker";
import { StoryEmojiGlyph } from "./StoryEmojiGlyph";
import { StoryLayerContent } from "./StoryLayerContent";
import { TELEGRAM_COMPOSER_EMOJIS, getTelegramEmojiGifUrl } from "@/lib/client/telegram-emoji-gifs";
import { singleStoryEmoji, storyEmojiGraphemes } from "@/lib/story-editor";
import { MdDelete, MdEdit } from "react-icons/md";
import { Spinner } from "@/components/ui/spinner";

type ReactPointerEvent<T> = React.PointerEvent<T>;

import {
  clampStoryMediaTransform,
  buildStoryMediaTransformStyle,
  drawStoryOverlayToCanvas,
  createStoryOverlayTextLayer,
  clampStoryOverlayUnit,
} from "../../helpers";

import {
  STORY_TEXT_MIN_SIZE,
  STORY_TEXT_MAX_SIZE,
  STORY_TEXT_DEFAULT_SIZE,
  STORY_OVERLAY_ERASER_THRESHOLD,
} from "../../constants";

import type {
  StoryDraft,
  StoryOverlayTextLayer,
  StoryOverlayTool,
  StoryOverlay,
  StoryOverlayStroke,
  StoryMediaTransform,
} from "../../types";

const storyPickerEmojis = Array.from(new Set(TELEGRAM_COMPOSER_EMOJIS)).filter(emoji => getTelegramEmojiGifUrl(emoji) !== null);

type StoryEditorProps = {
  isOpen: boolean;
  isDesktop: boolean;
  storyDraft: StoryDraft | null;
  setStoryDraft: React.Dispatch<React.SetStateAction<StoryDraft | null>>;
  closeStoryDraft: () => void;
  storyUploading: boolean;
  submitStoryDraft: (draft?: StoryDraft) => void;
};

export function StoryEditor(props: StoryEditorProps) {
  const t = useTranslation();
  if (!props.isOpen || !props.storyDraft) return null;
  return <StoryEditorSession key={props.storyDraft.previewUrl} {...props} initialDraft={props.storyDraft} />;
}

function StoryEditorSession({ isDesktop, initialDraft, closeStoryDraft, storyUploading, submitStoryDraft }: StoryEditorProps & { initialDraft: StoryDraft }) {
  const t = useTranslation();
  // Keep high-frequency edits out of the chat page. Publish one complete snapshot.
  const [storyDraft, setStoryDraft] = useState<StoryDraft | null>(initialDraft);
  const isOpen = true;
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiDraft, setEmojiDraft] = useState("");
  const [emojiEditingId, setEmojiEditingId] = useState<string | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState({ x: false, y: false });
  const mediaPendingRef = useRef<Partial<StoryMediaTransform> | null>(null);
  const mediaRafRef = useRef<number | null>(null);
  const erasingPointerRef = useRef<number | null>(null);
  const eraseRafRef = useRef<number | null>(null);
  const erasePointsRef = useRef<{ x: number; y: number }[]>([]);
  const pinchRafRef = useRef<number | null>(null);
  const pinchPendingRef = useRef<{ id: string; size: number } | null>(null);
  const gestureMovedRef = useRef(false);
  // Local States
  const [editorMode, setEditorModeState] = useState<"none" | "draw" | "text">("none");
  const [storyOverlayTool, setStoryOverlayTool] = useState<StoryOverlayTool>("none");
  const [storyOverlayEraserMode, setStoryOverlayEraserMode] = useState(false);
  const [storyTextColor, setStoryTextColor] = useState("#ffffff");
  const [storyTextSize, setStoryTextSize] = useState(28);
  const [storyTextFont, setStoryTextFont] = useState<StoryFont>("tiktok");
  const [brushWidthPickerOpen, setBrushWidthPickerOpen] = useState(false);
  const [storyTextDragActive, setStoryTextDragActive] = useState(false);
  const [storyTextDragDeleteHover, setStoryTextDragDeleteHover] = useState(false);
  const [storyTextEditorOpen, setStoryTextEditorOpen] = useState(false);
  const [storyTextDraft, setStoryTextDraft] = useState("");
  const [storyTextEditingId, setStoryTextEditingId] = useState<string | null>(null);
  const [storyTtlPickerOpen, setStoryTtlPickerOpen] = useState(false);
  const [storyMediaDragActive, setStoryMediaDragActive] = useState(false);
  const [storyDraftKeyboardInset, setStoryDraftKeyboardInset] = useState(0);
  const [storyOverlaySelectedTextId, setStoryOverlaySelectedTextId] = useState<string | null>(null);
  const [storyOverlayColor, setStoryOverlayColor] = useState("#ffffff");
  const [storyOverlayStrokeWidth, setStoryOverlayStrokeWidth] = useState<number>(6);

  const editSnapshotRef = useRef<StoryOverlay | null>(null);
  const storyTextInputRef = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const input = storyTextInputRef.current;
    if (!storyTextEditorOpen || !input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(280, Math.max(48, input.scrollHeight))}px`;
  }, [storyTextDraft, storyTextEditorOpen, storyTextSize, storyTextFont]);

  // Local Refs
  const storyOverlayStageRef = useRef<HTMLDivElement | null>(null);
  const storyOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const storyTextDeleteTargetRef = useRef<HTMLButtonElement | null>(null);
  const storyOverlayRenderRafRef = useRef<number | null>(null);
  const storyDraftRef = useRef<StoryDraft | null>(initialDraft);
  useLayoutEffect(() => { storyDraftRef.current = storyDraft; }, [storyDraft]);
  const storyOverlayDrawingRef = useRef<StoryOverlayStroke | null>(null);
  const storyOverlayLastDrawPointRef = useRef<{ x: number; y: number } | null>(null);
  const storyOverlayTextDragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const storyOverlayTextPointersRef = useRef<Record<number, { x: number; y: number }>>({});
  const storyOverlayTextPinchRef = useRef<{ id: string; distance: number; baseSize: number } | null>(null);
  const storyMediaPointersRef = useRef<Record<number, { x: number; y: number }>>({});
  const storyMediaPinchRef = useRef<{ distance: number; baseScale: number } | null>(null);
  const storyMediaDragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const stageRectRef = useRef<{ left: number; top: number; width: number; height: number }>({ left: 0, top: 0, width: 0, height: 0 });
  const storyTextPendingDragRef = useRef<{ id: string; x: number; y: number; isDeleteHover: boolean } | null>(null);
  const storyTextDragRafRef = useRef<number | null>(null);



  useEffect(() => {
    if (!isOpen) return;

    const syncViewport = () => {
      const viewport = window.visualViewport;
      if (!viewport) {
        setStoryDraftKeyboardInset(0);
        return;
      }
      const keyboardInset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      setStoryDraftKeyboardInset(keyboardInset > 60 ? keyboardInset : 0);
    };

    syncViewport();
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    return () => {
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      setStoryDraftKeyboardInset(0);
    };
  }, [isOpen]);

  const handleDownloadMedia = () => {
    if (!storyDraft) return;
    const a = document.createElement("a");
    a.href = storyDraft.previewUrl;
    a.download = `story_${Date.now()}.${storyDraft.mediaType === "video" ? "mp4" : "jpg"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const updateStageRect = useCallback(() => {
    const stage = storyOverlayStageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    stageRectRef.current = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    return stageRectRef.current;
  }, []);

  const renderStoryOverlayCanvas = useCallback((overlay: StoryOverlay | null | undefined = storyDraftRef.current?.overlay) => {
    const stage = storyOverlayStageRef.current;
    const canvas = storyOverlayCanvasRef.current;
    if (!stage || !canvas) return;
    let rect = stageRectRef.current;
    if (rect.width <= 0 || rect.height <= 0) {
      const updated = updateStageRect();
      if (!updated || updated.width <= 0 || updated.height <= 0) return;
      rect = updated;
    }
    const drawing = storyOverlayDrawingRef.current;
    const visibleOverlay = drawing && overlay
      ? { ...overlay, strokes: [...overlay.strokes, drawing] }
      : overlay;
    drawStoryOverlayToCanvas(canvas, visibleOverlay, rect.width, rect.height);
  }, [updateStageRect]);

  const scheduleStoryOverlayCanvasRender = useCallback(() => {
    if (storyOverlayRenderRafRef.current !== null) return;
    storyOverlayRenderRafRef.current = window.requestAnimationFrame(() => {
      storyOverlayRenderRafRef.current = null;
      // Read at paint time: a stroke may have been committed since this frame was queued.
      renderStoryOverlayCanvas(storyDraftRef.current?.overlay);
    });
  }, [renderStoryOverlayCanvas]);

  const beginStoryAction = useCallback(() => {
    const draft = storyDraftRef.current;
    if (!editSnapshotRef.current && draft) editSnapshotRef.current = structuredClone(draft.overlay);
  }, []);
  const activateEditorMode = useCallback((mode: "none" | "draw" | "text") => {
    if (mode === "none") { editSnapshotRef.current = null; setBrushWidthPickerOpen(false); }
    else beginStoryAction();
    setEditorModeState(mode);
  }, [beginStoryAction]);
  function cancelStoryAction() {
    const snapshot = editSnapshotRef.current;
    for (const ref of [storyOverlayRenderRafRef, storyTextDragRafRef, eraseRafRef, pinchRafRef]) {
      if (ref.current !== null) cancelAnimationFrame(ref.current);
      ref.current = null;
    }
    storyOverlayDrawingRef.current = null;
    storyOverlayLastDrawPointRef.current = null;
    erasePointsRef.current = [];
    pinchPendingRef.current = null;
    erasingPointerRef.current = null;
    if (snapshot) {
      setStoryDraft(prev => prev ? { ...prev, overlay: snapshot } : prev);
      if (storyDraftRef.current) storyDraftRef.current = { ...storyDraftRef.current, overlay: snapshot };
      renderStoryOverlayCanvas(snapshot);
    }
    setStoryTextEditorOpen(false);
    setStoryTextDraft("");
    setStoryTextEditingId(null);
    setStoryOverlaySelectedTextId(null);
    setStoryOverlayTool("none");
    setStoryOverlayEraserMode(false);
    setStoryTextDragActive(false);
    activateEditorMode("none");
  }

  useEffect(() => {
    if (!isOpen || !storyDraft) return;
    const stage = storyOverlayStageRef.current;
    if (!stage) return;

    updateStageRect();
    scheduleStoryOverlayCanvasRender();

    const handleResize = () => {
      updateStageRect();
      scheduleStoryOverlayCanvasRender();
    };

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
    observer?.observe(stage);
    window.addEventListener("resize", handleResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, updateStageRect, scheduleStoryOverlayCanvasRender]);

  useEffect(() => {
    renderStoryOverlayCanvas(storyDraftRef.current?.overlay);
  }, [renderStoryOverlayCanvas, storyDraft?.overlay.strokes]);


  useEffect(() => () => {
    for (const ref of [storyOverlayRenderRafRef, storyTextDragRafRef, mediaRafRef, eraseRafRef, pinchRafRef]) {
      if (ref.current !== null) cancelAnimationFrame(ref.current);
      ref.current = null;
    }
  }, []);

  function addEmojiLayer() {
    if (!emojiDraft || storyEmojiGraphemes(emojiDraft).length > 12) return;
    const layer = { ...createStoryOverlayTextLayer(emojiDraft), kind: "emoji" as const, size: 64 };
    setStoryDraft(prev => prev ? { ...prev, overlay: { ...prev.overlay, texts: emojiEditingId ? prev.overlay.texts.map(existing => existing.id === emojiEditingId ? { ...existing, text: emojiDraft } : existing) : [...prev.overlay.texts, layer] } } : prev);
    setStoryOverlaySelectedTextId(emojiEditingId ?? layer.id);
    setStoryTextSize(layer.size);
    activateEditorMode("text");
    setEmojiPickerOpen(false);
    setEmojiDraft("");
  }

  function addStoryTextLayer() {
    if (!storyDraft) return;
    setStoryOverlaySelectedTextId(null);
    setStoryTextEditingId(null);
    setStoryTextDraft("");
    setStoryTextColor("#ffffff");
    setStoryTextSize(STORY_TEXT_DEFAULT_SIZE);
    setStoryTextFont("tiktok");
    setStoryTextEditorOpen(true);
    setStoryOverlayTool("none");
    activateEditorMode("text");
  }

  function updateStoryTextLayer(layerId: string) {
    if (!storyDraft) return;
    const current = storyDraft.overlay.texts.find((layer) => layer.id === layerId);
    if (!current) return;
    if (current.kind === "emoji") { setEmojiEditingId(current.id); setEmojiDraft(current.text); setEmojiPickerOpen(true); return; }
    setStoryOverlaySelectedTextId(layerId);
    setStoryTextEditingId(layerId);
    setStoryTextDraft(current.text);
    setStoryTextFont(normalizeStoryFont(current.font));
    setStoryTextColor(current.color || "#ffffff");
    setStoryTextSize(
      Number.isFinite(current.size)
        ? Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, Number(current.size)))
        : STORY_TEXT_DEFAULT_SIZE,
    );
    setStoryTextEditorOpen(true);
    activateEditorMode("text");
  }

  function updateSelectedStoryTextLayer(
    patch: Partial<Pick<StoryOverlayTextLayer, "color" | "size" | "align" | "bgStyle" | "font">>,
    explicitTargetId?: string | null
  ) {
    if (storyTextEditorOpen && !storyTextEditingId) {
      // In editor mode creating brand new text - NEVER mutate existing layers!
      return;
    }
    beginStoryAction();
    const targetId = explicitTargetId ?? (storyTextEditorOpen ? storyTextEditingId : storyOverlaySelectedTextId);
    if (!targetId) return;
    setStoryDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        overlay: {
          ...prev.overlay,
          texts: prev.overlay.texts.map((layer) =>
            layer.id === targetId
              ? {
                  ...layer,
                  color: patch.color ?? layer.color,
                  font: patch.font ?? layer.font,
                  size:
                    patch.size !== undefined
                      ? Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, patch.size))
                      : layer.size,
                  align: patch.align ?? layer.align,
                  bgStyle: patch.bgStyle ?? layer.bgStyle,
                }
              : layer,
          ),
        },
      };
    });
  }

  const handleStoryTextColorChange = (newColor: string) => {
    setStoryTextColor(newColor);
    if (!storyTextEditorOpen && editorMode === "text" && storyOverlaySelectedTextId) {
      updateSelectedStoryTextLayer({ color: newColor }, storyOverlaySelectedTextId);
    }
  };

  function submitStoryTextEditor() {
    const nextText = storyTextDraft.trim().slice(0, 140);
    if (!storyDraft) return;
    if (storyTextEditingId) {
      setStoryDraft((prev) => {
        if (!prev) return prev;
        if (!nextText) {
          return {
            ...prev,
            overlay: {
              ...prev.overlay,
              texts: prev.overlay.texts.filter((layer) => layer.id !== storyTextEditingId),
            },
          };
        }
        return {
          ...prev,
          overlay: {
            ...prev.overlay,
              texts: prev.overlay.texts.map((layer) =>
                layer.id === storyTextEditingId
                  ? {
                      ...layer,
                      text: nextText,
                      color: storyTextColor,
                      font: storyTextFont,
                      size: Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, storyTextSize)),
                    }
                  : layer,
              ),
          },
        };
      });
      setStoryOverlaySelectedTextId(nextText ? storyTextEditingId : null);
    } else if (nextText) {
      const layer = createStoryOverlayTextLayer(nextText);
      layer.color = storyTextColor;
      layer.font = storyTextFont;
      layer.size = Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, storyTextSize));
      setStoryDraft((prev) =>
        prev
          ? {
              ...prev,
              overlay: {
                ...prev.overlay,
                texts: [...prev.overlay.texts, layer],
              },
            }
          : prev,
      );
      setStoryOverlaySelectedTextId(layer.id);
    }
    setStoryTextEditorOpen(false);
    setStoryTextDraft("");
    setStoryTextEditingId(null);
    if (nextText) {
      activateEditorMode("text");
    } else {
      setStoryOverlaySelectedTextId(null);
      activateEditorMode("none");
    }
  }

  const getStoryOverlayPoint = useCallback((clientX: number, clientY: number) => {
    let rect = stageRectRef.current;
    if (rect.width <= 0 || rect.height <= 0) {
      const updated = updateStageRect();
      if (!updated || updated.width <= 0 || updated.height <= 0) return null;
      rect = updated;
    }
    return {
      x: clampStoryOverlayUnit((clientX - rect.left) / rect.width),
      y: clampStoryOverlayUnit((clientY - rect.top) / rect.height),
    };
  }, [updateStageRect]);

  function isOverStoryTextDeleteTarget(clientX: number, clientY: number) {
    const target = storyTextDeleteTargetRef.current;
    if (!target) return false;
    const rect = target.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function flushEraser() {
    if (eraseRafRef.current !== null) cancelAnimationFrame(eraseRafRef.current);
    eraseRafRef.current = null;
    const points = erasePointsRef.current;
    erasePointsRef.current = [];
    if (!points.length) return;
    setStoryDraft(prev => {
      if (!prev) return prev;
      const strokes = prev.overlay.strokes.filter(stroke => !stroke.points.some(point => points.some(eraser => Math.hypot(point.x - eraser.x, point.y - eraser.y) <= STORY_OVERLAY_ERASER_THRESHOLD)));
      return strokes.length === prev.overlay.strokes.length ? prev : { ...prev, overlay: { ...prev.overlay, strokes } };
    });
  }
  function eraseAt(point: { x: number; y: number }) {
    erasePointsRef.current.push(point);
    if (eraseRafRef.current === null) eraseRafRef.current = requestAnimationFrame(flushEraser);
  }
  function flushTextPinch() {
    if (pinchRafRef.current !== null) cancelAnimationFrame(pinchRafRef.current);
    pinchRafRef.current = null;
    const pending = pinchPendingRef.current;
    pinchPendingRef.current = null;
    if (!pending) return;
    setStoryTextSize(pending.size);
    setStoryDraft(prev => prev ? { ...prev, overlay: { ...prev.overlay, texts: prev.overlay.texts.map(layer => layer.id === pending.id ? { ...layer, size: pending.size } : layer) } } : prev);
  }

  const onStoryDrawPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!storyDraft || editorMode !== "draw" || storyTextEditorOpen) return;
    updateStageRect();
    const point = getStoryOverlayPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (storyOverlayEraserMode) {
      erasingPointerRef.current = event.pointerId;
      eraseAt(point);
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    const stroke: StoryOverlayStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color: storyOverlayColor,
      width: storyOverlayStrokeWidth,
      points: [point],
    };
    storyOverlayDrawingRef.current = stroke;
    storyOverlayLastDrawPointRef.current = point;
    scheduleStoryOverlayCanvasRender();
  }, [editorMode, getStoryOverlayPoint, scheduleStoryOverlayCanvasRender, storyDraft, storyOverlayColor, storyOverlayEraserMode, storyOverlayStrokeWidth, storyTextEditorOpen, updateStageRect]);

  const onStoryDrawPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!storyDraft || editorMode !== "draw" || storyTextEditorOpen) return;
    const point = getStoryOverlayPoint(event.clientX, event.clientY);
    if (!point) return;
    if (storyOverlayEraserMode) {
      if (erasingPointerRef.current !== event.pointerId) return;
      event.preventDefault();
      eraseAt(point);
      return;
    }
    const drawing = storyOverlayDrawingRef.current;
    if (!drawing) return;
    event.preventDefault();
    const lastPoint = storyOverlayLastDrawPointRef.current;
    if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 0.0015) return;
    storyOverlayLastDrawPointRef.current = point;
    drawing.points.push(point);
    scheduleStoryOverlayCanvasRender();
  }, [editorMode, getStoryOverlayPoint, scheduleStoryOverlayCanvasRender, storyDraft, storyOverlayEraserMode, storyTextEditorOpen]);

  const onStoryDrawPointerUp = useCallback((event?: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {}
    }
    flushEraser();
    erasingPointerRef.current = null;
    const drawing = storyOverlayDrawingRef.current;
    storyOverlayDrawingRef.current = null;
    storyOverlayLastDrawPointRef.current = null;
    if (!drawing) return;
    setStoryDraft((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        overlay: {
          ...prev.overlay,
          strokes: [...prev.overlay.strokes, { ...drawing, points: [...drawing.points] }],
        },
      };
      storyDraftRef.current = next;
      return next;
    });
  }, []);

  const onStoryTextPointerDown = useCallback((layer: StoryOverlayTextLayer, event: ReactPointerEvent<HTMLDivElement>) => {
    if (editorMode === "draw" || storyOverlayTool === "draw" || storyTextEditorOpen) return;
    updateStageRect();
    const point = getStoryOverlayPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    setStoryOverlaySelectedTextId(layer.id);
    activateEditorMode("text");
    setStoryTextColor(layer.color || "#ffffff");
    setStoryTextSize(
      Number.isFinite(layer.size)
        ? Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, Number(layer.size)))
        : STORY_TEXT_DEFAULT_SIZE,
    );
    gestureMovedRef.current = false;
    setStoryTextDragActive(true);
    setStoryTextDragDeleteHover(false);

    if (Object.keys(storyOverlayTextPointersRef.current).length === 0) {
      storyOverlayTextPointersRef.current = { [event.pointerId]: { x: event.clientX, y: event.clientY } };
    } else {
      storyOverlayTextPointersRef.current[event.pointerId] = { x: event.clientX, y: event.clientY };
    }

    const points = Object.values(storyOverlayTextPointersRef.current);
    if (points.length >= 2) {
      const [a, b] = points;
      const initialDist = Math.hypot(a.x - b.x, a.y - b.y);
      if (initialDist > 20) {
        storyOverlayTextPinchRef.current = {
          id: layer.id,
          distance: initialDist,
          baseSize: Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, Number(layer.size) || STORY_TEXT_DEFAULT_SIZE)),
        };
      }
      storyOverlayTextDragRef.current = null;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    storyOverlayTextDragRef.current = {
      id: layer.id,
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      baseX: layer.x,
      baseY: layer.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [editorMode, getStoryOverlayPoint, storyOverlayTool, storyTextEditorOpen, updateStageRect]);

  const onStoryTextPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (storyOverlayTextPointersRef.current[event.pointerId]) {
      storyOverlayTextPointersRef.current[event.pointerId] = { x: event.clientX, y: event.clientY };
    }
    const textPoints = Object.values(storyOverlayTextPointersRef.current);
    const pinch = storyOverlayTextPinchRef.current;
    if (pinch && textPoints.length >= 2) {
      event.preventDefault();
      const [a, b] = textPoints;
      const nextDistance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      if (pinch.distance > 0 && Math.abs(nextDistance - pinch.distance) > 1) {
        const ratio = nextDistance / pinch.distance;
        const boundedRatio = Math.max(0.6, Math.min(4, ratio));
        const nextSize = Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, Math.round(pinch.baseSize * boundedRatio)));
        pinchPendingRef.current = { id: pinch.id, size: nextSize };
        if (pinchRafRef.current === null) pinchRafRef.current = requestAnimationFrame(flushTextPinch);
      }
      setStoryTextDragDeleteHover(false);
      return;
    }
    const drag = storyOverlayTextDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !storyDraft || storyOverlayTool === "draw" || editorMode === "draw") return;
    const point = getStoryOverlayPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    if (Math.hypot(dx * stageRectRef.current.width, dy * stageRectRef.current.height) > 4) gestureMovedRef.current = true;
    const rawX = clampStoryOverlayUnit(drag.baseX + dx), rawY = clampStoryOverlayUnit(drag.baseY + dy);
    const snapX = Math.abs(rawX - .5) * stageRectRef.current.width < 7;
    const snapY = Math.abs(rawY - .5) * stageRectRef.current.height < 7;
    const nextX = snapX ? .5 : rawX, nextY = snapY ? .5 : rawY;
    const isDeleteHover = isOverStoryTextDeleteTarget(event.clientX, event.clientY);

    storyTextPendingDragRef.current = {
      id: drag.id,
      x: nextX,
      y: nextY,
      isDeleteHover,
    };

    if (storyTextDragRafRef.current === null) {
      storyTextDragRafRef.current = window.requestAnimationFrame(() => {
        storyTextDragRafRef.current = null;
        const pending = storyTextPendingDragRef.current;
        if (!pending) return;
        setStoryDraft((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            overlay: {
              ...prev.overlay,
              texts: prev.overlay.texts.map((layer) =>
                layer.id === pending.id ? { ...layer, x: pending.x, y: pending.y } : layer,
              ),
            },
          };
        });
        setStoryTextDragDeleteHover(pending.isDeleteHover);
        setAlignmentGuides({ x: pending.x === .5, y: pending.y === .5 });
      });
    }
  }, [editorMode, getStoryOverlayPoint, storyDraft, storyOverlayTool]);

  const onStoryTextPointerUp = useCallback((event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event) {
      delete storyOverlayTextPointersRef.current[event.pointerId];
    }
    if (storyTextDragRafRef.current !== null) {
      window.cancelAnimationFrame(storyTextDragRafRef.current);
      storyTextDragRafRef.current = null;
    }
    flushTextPinch();
    const remainingPointers = Object.keys(storyOverlayTextPointersRef.current).length;
    if (remainingPointers === 0) {
      storyOverlayTextPointersRef.current = {};
      storyOverlayTextPinchRef.current = null;
    } else if (remainingPointers < 2) {
      storyOverlayTextPinchRef.current = null;
    }
    const drag = storyOverlayTextDragRef.current;
    const pending = storyTextPendingDragRef.current;
    storyTextPendingDragRef.current = null;

    if (drag && event && event.type !== "pointercancel" && isOverStoryTextDeleteTarget(event.clientX, event.clientY)) {
      setStoryDraft((prev) =>
        prev
          ? {
              ...prev,
              overlay: {
                ...prev.overlay,
                texts: prev.overlay.texts.filter((layer) => layer.id !== drag.id),
              },
            }
          : prev,
      );
      setStoryOverlaySelectedTextId((prev) => (prev === drag.id ? null : prev));
      activateEditorMode("none");
    } else if (drag && pending) {
      setStoryDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          overlay: {
            ...prev.overlay,
            texts: prev.overlay.texts.map((layer) =>
              layer.id === pending.id ? { ...layer, x: pending.x, y: pending.y } : layer,
            ),
          },
        };
      });
    }
    storyOverlayTextDragRef.current = null;
    if (event) { try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch {} }
    setAlignmentGuides({ x: false, y: false });
    setStoryTextDragActive(remainingPointers > 0);
    setStoryTextDragDeleteHover(false);
  }, []);

  const adjustSelectedStoryTextSize = useCallback((delta: number) => {
    if (storyTextEditorOpen) {
      setStoryTextSize(prev => Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, prev + delta)));
      return;
    }
    if (!storyDraft) return;
    const targetId = storyOverlaySelectedTextId;
    if (!targetId) return;
    const targetLayer = storyDraft.overlay.texts.find((l) => l.id === targetId);
    if (!targetLayer) return;
    const currentSize = targetLayer.size || storyTextSize;
    const nextSize = Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, currentSize + delta));
    setStoryTextSize(nextSize);
    updateSelectedStoryTextLayer({ size: nextSize }, targetId);
  }, [storyDraft, storyOverlaySelectedTextId, storyTextEditingId, storyTextEditorOpen, storyTextSize]);

  const deleteSelectedStoryText = useCallback(() => {
    if (!storyDraft) return;
    const targetId = storyOverlaySelectedTextId;
    if (!targetId) return;
    setStoryDraft((prev) => {
      if (!prev) return prev;
      const remaining = prev.overlay.texts.filter((layer) => layer.id !== targetId);
      return {
        ...prev,
        overlay: {
          ...prev.overlay,
          texts: remaining,
        },
      };
    });
    setStoryOverlaySelectedTextId(null);
    activateEditorMode("none");
  }, [storyDraft, storyOverlaySelectedTextId]);

  const undoLastDrawingStroke = useCallback(() => {
    setStoryDraft((prev) => {
      if (!prev || prev.overlay.strokes.length === 0) return prev;
      const nextStrokes = prev.overlay.strokes.slice(0, -1);
      const next = {
        ...prev,
        overlay: {
          ...prev.overlay,
          strokes: nextStrokes,
        },
      };
      storyDraftRef.current = next;
      scheduleStoryOverlayCanvasRender();
      return next;
    });
  }, [scheduleStoryOverlayCanvasRender, setStoryDraft]);

  const clearStoryOverlayDrawings = useCallback(() => {
    setStoryDraft((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        overlay: {
          ...prev.overlay,
          strokes: [],
        },
      };
      storyDraftRef.current = next;
      scheduleStoryOverlayCanvasRender();
      return next;
    });
  }, [scheduleStoryOverlayCanvasRender, setStoryDraft]);

  function commitStoryMediaTransform(patch: Partial<StoryMediaTransform>) {
    setStoryDraft((prev) => {
      if (!prev) return prev;
      const nextTransform = clampStoryMediaTransform({ ...(prev.overlay.media ?? {}), ...patch });
      const next = {
        ...prev,
        overlay: {
          ...prev.overlay,
          media: nextTransform,
        },
      };
      storyDraftRef.current = next;
      return next;
    });
  }

  function flushStoryMediaTransform() {
    if (mediaRafRef.current !== null) cancelAnimationFrame(mediaRafRef.current);
    mediaRafRef.current = null;
    const patch = mediaPendingRef.current;
    mediaPendingRef.current = null;
    if (patch) commitStoryMediaTransform(patch);
  }
  function updateStoryMediaTransform(patch: Partial<StoryMediaTransform>) {
    mediaPendingRef.current = { ...mediaPendingRef.current, ...patch };
    if (mediaRafRef.current === null) mediaRafRef.current = requestAnimationFrame(flushStoryMediaTransform);
  }

  function resetStoryMediaTransform() {
    updateStoryMediaTransform({ scale: 1, x: 0, y: 0 });
  }

  const onStoryMediaPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!storyDraft || editorMode === "draw" || storyOverlayTool === "draw" || storyTextEditorOpen || storyTextDragActive) return;
    event.preventDefault();
    event.stopPropagation();

    // Auto-close color pickers, duration picker, and clear text selection on background interaction
    setStoryTtlPickerOpen(false);
    setStoryOverlaySelectedTextId(null);
    if (editorMode === "text") {
      activateEditorMode("none");
    }

    updateStageRect();
    setStoryMediaDragActive(true);
    storyMediaPointersRef.current[event.pointerId] = { x: event.clientX, y: event.clientY };
    const points = Object.values(storyMediaPointersRef.current);
    if (points.length >= 2) {
      const [a, b] = points;
      storyMediaPinchRef.current = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        baseScale: clampStoryMediaTransform(storyDraft.overlay.media).scale,
      };
      storyMediaDragRef.current = null;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    const transform = clampStoryMediaTransform(storyDraft.overlay.media);
    storyMediaDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: transform.x,
      baseY: transform.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [editorMode, storyDraft, storyOverlayTool, storyTextDragActive, storyTextEditorOpen]);

  const onStoryMediaPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (storyMediaPointersRef.current[event.pointerId]) {
      storyMediaPointersRef.current[event.pointerId] = { x: event.clientX, y: event.clientY };
    }
    const points = Object.values(storyMediaPointersRef.current);
    const pinch = storyMediaPinchRef.current;
    if (pinch && points.length >= 2) {
      event.preventDefault();
      const [a, b] = points;
      const nextDistance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      updateStoryMediaTransform({ scale: pinch.baseScale * (nextDistance / pinch.distance) });
      return;
    }
    const drag = storyMediaDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const stage = storyOverlayStageRef.current;
    if (!stage) return;
    const rect = stageRectRef.current;
    const nextX = drag.baseX + (event.clientX - drag.startX) / Math.max(1, rect.width);
    const nextY = drag.baseY + (event.clientY - drag.startY) / Math.max(1, rect.height);
    updateStoryMediaTransform({ x: nextX, y: nextY });
  }, []);

  const onStoryMediaPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    flushStoryMediaTransform();
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    delete storyMediaPointersRef.current[event.pointerId];
    if (Object.keys(storyMediaPointersRef.current).length < 2) {
      storyMediaPinchRef.current = null;
    }
    const drag = storyMediaDragRef.current;
    if (drag?.pointerId === event.pointerId) {
      storyMediaDragRef.current = null;
    }
    if (Object.keys(storyMediaPointersRef.current).length === 0) {
      setStoryMediaDragActive(false);
    }
  }, []);

  const onStoryMediaWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!storyDraftRef.current || storyOverlayTool === "draw" || storyTextEditorOpen) return;
    event.preventDefault();
    const current = clampStoryMediaTransform(storyDraftRef.current.overlay.media);
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    updateStoryMediaTransform({ scale: current.scale + delta });
  }, [storyOverlayTool, storyTextEditorOpen]);


  const renderDrawColorPickerBar = () => <StoryColorPicker color={storyOverlayColor} label={t("Цвет кисти")} onChange={color => { setStoryOverlayColor(color); setStoryOverlayEraserMode(false); }} />;
  const renderTextColorPickerBar = () => <StoryColorPicker color={storyTextColor} label={t("Цвет текста")} onChange={handleStoryTextColorChange} />;

  if (!storyDraft) return null;
  const selectedLayer = storyDraft.overlay.texts.find(layer => layer.id === (storyTextEditorOpen ? storyTextEditingId : storyOverlaySelectedTextId));
  const hideTextColors = selectedLayer?.kind === "emoji" || (storyTextEditorOpen && singleStoryEmoji(storyTextDraft) !== null);
  return (
<motion.div
            className="fixed inset-0 z-[87] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/92"
              onClick={closeStoryDraft}
              aria-label={t("Закрыть")}
            />
            <motion.div
              className="relative z-[1] flex h-full w-full touch-none select-none flex-col overflow-hidden bg-black md:h-[min(calc(100dvh-24px),820px)] md:w-[min(430px,calc(100vw-40px))] md:max-w-[calc(100vw-40px)] md:rounded-[34px] md:bg-zinc-950/94 md:shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
              inert={storyUploading}
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                height: isDesktop ? undefined : "100dvh",
                minHeight: isDesktop ? undefined : "100dvh",
                maxHeight: isDesktop ? undefined : "100dvh",
                overflow: isDesktop ? undefined : "hidden",
              }}
            >
              <div
                className={cn(
                  "absolute left-4 right-4 top-[max(env(safe-area-inset-top),12px)] z-20 flex items-center justify-between transition-opacity duration-200 md:left-5 md:right-5",
                  storyTextDragActive || storyTextEditorOpen || editorMode !== "none" ? "pointer-events-none opacity-0" : "opacity-100",
                )}
              >
                {/* Close Button on the left */}
                <button
                  type="button"
                  onClick={closeStoryDraft}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-[#181818]/72 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px] transition-all hover:bg-[#222224]/80 active:scale-95 cursor-pointer"
                  aria-label={t("Закрыть")}
                >
                  <X size={20} />
                </button>

                {/* Download Button on the right matching reference */}
                <button
                  type="button"
                  onClick={handleDownloadMedia}
                  title={t("Скачать")}
                  aria-label={t("Скачать")}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-[#181818]/72 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px] transition-all hover:bg-[#222224]/80 active:scale-95 cursor-pointer"
                >
                  <Download size={20} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(46,46,54,0.46),rgba(0,0,0,0.98)_64%)] p-0">
                <div
                  ref={storyOverlayStageRef}
                  className="relative h-full w-full overflow-hidden bg-[#121214] md:h-full md:max-h-[820px] md:rounded-[28px] md:shadow-[0_18px_60px_rgba(0,0,0,0.48)]"
                  style={{ backgroundColor: clampStoryMediaTransform(storyDraft.overlay.media).bgColor ?? "#151515" }}
                  onPointerMove={onStoryTextPointerMove}
                  onPointerUp={onStoryTextPointerUp}
                  onPointerCancel={onStoryTextPointerUp}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-36 bg-gradient-to-b from-black/58 via-black/16 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-t from-black/68 via-black/18 to-transparent" />
                  {/* Background Media */}
                  {storyDraft.mediaType === "video" ? (
                    <video
                      src={storyDraft.previewUrl}
                      className="h-full w-full object-contain will-change-transform pointer-events-none"
                      style={buildStoryMediaTransformStyle(storyDraft.overlay.media)}
                      playsInline
                      preload="metadata"
                      controls={false}
                      controlsList="nodownload nofullscreen noplaybackrate noremoteplayback"
                      disablePictureInPicture
                      disableRemotePlayback
                      muted
                      autoPlay
                      loop
                    />
                  ) : (
                    <img
                      src={storyDraft.previewUrl}
                      alt={t("Предпросмотр истории")}
                      className="h-full w-full object-contain will-change-transform pointer-events-none"
                      style={buildStoryMediaTransformStyle(storyDraft.overlay.media)}
                    />
                  )}

                  {/* Full-Screen Media Gesture Area */}
                  <div
                    className="absolute inset-0 z-[2] cursor-move"
                    onPointerDown={onStoryMediaPointerDown}
                    onPointerMove={onStoryMediaPointerMove}
                    onPointerUp={onStoryMediaPointerUp}
                    onPointerCancel={onStoryMediaPointerUp}
                    onWheel={onStoryMediaWheel}
                    onDoubleClick={resetStoryMediaTransform}
                    onClick={() => {
                      if (editorMode === "text") {
                        activateEditorMode("none");
                        setStoryOverlaySelectedTextId(null);
                      }
                    }}
                  />

                  {/* Photo Bounding Box Guide */}
                  {storyMediaDragActive && (
                    <div
                      className="pointer-events-none absolute inset-0 z-10 border border-dashed border-white/40 rounded-sm"
                      style={buildStoryMediaTransformStyle(storyDraft.overlay.media)}
                    />
                  )}

                  {storyDraft.overlay.texts.map((layer) => {
                    if (storyTextEditorOpen && layer.id === storyTextEditingId) {
                      return null;
                    }
                    const isSelected = editorMode === "text" && storyOverlaySelectedTextId === layer.id;
                    const bgStyle = layer.bgStyle ?? "none";
                    const align = layer.align ?? "center";
                    return (
                      <div
                        key={layer.id}
                        role="button"
                        tabIndex={0}
                        onDoubleClick={() => {
                          if (editorMode === "draw") return;
                          activateEditorMode("text");
                          updateStoryTextLayer(layer.id);
                        }}
                        onPointerDown={(event) => onStoryTextPointerDown(layer, event)}
                        onClick={(event) => {
                          if (editorMode === "draw" || gestureMovedRef.current) return;
                          event.stopPropagation();
                          setStoryOverlaySelectedTextId(layer.id);
                          setStoryTextColor(layer.color || "#ffffff");
                          setStoryTextSize(
                            Number.isFinite(layer.size)
                              ? Math.max(STORY_TEXT_MIN_SIZE, Math.min(STORY_TEXT_MAX_SIZE, Number(layer.size)))
                              : STORY_TEXT_DEFAULT_SIZE,
                          );
                          activateEditorMode("text");
                          setStoryTtlPickerOpen(false);
                        }}
                        className={cn(
                          "absolute z-[5] max-w-[86%] select-none whitespace-pre-wrap font-semibold touch-none will-change-transform",
                          storyTextDragActive && isSelected
                            ? "transition-none cursor-grabbing z-20 rounded-lg"
                            : "transition-[box-shadow,opacity] duration-150 cursor-grab",
                          align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center",
                          bgStyle === "badge"
                            ? "bg-black/65 backdrop-blur-md rounded-2xl px-3.5 py-1.5 shadow-lg"
                            : bgStyle === "inverted"
                            ? "rounded-2xl px-3.5 py-1.5 shadow-lg font-bold"
                            : "px-2 py-1 [text-shadow:0_2px_14px_rgba(0,0,0,0.85)]",
                          isSelected && !storyTextDragActive
                            ? "rounded-lg"
                            : !storyTextDragActive ? "" : "",
                        )}
                        style={{
                          left: `${layer.x * 100}%`,
                          top: `${layer.y * 100}%`,
                          transform: "translate(-50%, -50%)",
                          backgroundColor: bgStyle === "inverted" ? layer.color : undefined,
                          color:
                            bgStyle === "inverted"
                              ? (layer.color?.toLowerCase() === "#ffffff" ? "#000000" : "#ffffff")
                              : layer.color,
                          fontSize: `${layer.size}px`,
                          ...(layer.kind !== "emoji" ? storyFontStyle(layer.font) : {}),
                          lineHeight: 1.25,
                        }}
                      >
                        {isSelected && <svg aria-hidden="true" className="pointer-events-none absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] overflow-visible transition-opacity duration-150">
                          <rect width="100%" height="100%" rx="12" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1" strokeDasharray="8 7" vectorEffect="non-scaling-stroke" />
                        </svg>}
                        <StoryLayerContent layer={layer} />
                      </div>
                    );
                  })}
                  {storyTextDragActive && <div className="pointer-events-none absolute inset-0 z-[6]">
                    <svg className="h-full w-full" aria-hidden="true">
                      {alignmentGuides.x && <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(255,255,255,0.6)" strokeDasharray="8 7" />}
                      {alignmentGuides.y && <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.6)" strokeDasharray="8 7" />}
                    </svg>
                  </div>}
                  <canvas
                    ref={storyOverlayCanvasRef}
                    className={cn(
                      "absolute inset-0 h-full w-full",
                      editorMode === "draw" ? "z-[10] cursor-crosshair touch-none" : "z-[4] pointer-events-none",
                    )}
                    onPointerDown={onStoryDrawPointerDown}
                    onPointerMove={onStoryDrawPointerMove}
                    onPointerUp={onStoryDrawPointerUp}
                    onPointerCancel={onStoryDrawPointerUp}
                  />

                  <AnimatePresence>
                    {storyTextDragActive ? (
                      <motion.div
                        className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex justify-center"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                      >
                        <button
                          ref={storyTextDeleteTargetRef}
                          type="button"
                          className={cn(
                            "pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900/86 text-white shadow-[0_14px_34px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-all",
                            storyTextDragDeleteHover ? "scale-110 bg-red-500/92" : "",
                          )}
                          aria-label={t("Удалить текст")}
                        >
                          <MdDelete size={22} />
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <AnimatePresence>
                    {storyTextEditorOpen ? (
                      <motion.div
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/20 px-5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        onClick={(event) => {
                          if (event.target === event.currentTarget) {
                            submitStoryTextEditor();
                          }
                        }}
                      >
                        <div className="w-full max-w-[400px] px-2">
                          <textarea
                            ref={storyTextInputRef}
                            value={storyTextDraft}
                            onChange={(event) => setStoryTextDraft(event.target.value.slice(0, 140))}
                            placeholder={t("Введите текст...")}
                            autoFocus
                            rows={1}
                            maxLength={140}
                            aria-label={t("Текст истории")}
                            className="no-scrollbar block max-h-[280px] min-h-[48px] w-full resize-none border-0 bg-transparent px-0 py-1 text-center font-semibold outline-none [text-shadow:0_2px_10px_rgba(0,0,0,0.5)] placeholder:text-white/50 placeholder:text-[28px] placeholder:font-semibold focus:ring-0"
                            style={{ color: storyTextColor, fontSize: Math.min(24, storyTextSize), lineHeight: 1.25, caretColor: "white", ...storyFontStyle(storyTextFont) }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                submitStoryTextEditor();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelStoryAction();
                              }
                            }}
                          />
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>

              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),16px)] transition-opacity duration-150 md:left-1/2 md:right-auto md:w-[min(430px,calc(100vw-72px))] md:-translate-x-1/2 md:px-0 md:pb-6 flex flex-col gap-2.5",
                  storyTextDragActive ? "pointer-events-none opacity-0" : "opacity-100",
                )}
                style={{
                  transform: storyDraftKeyboardInset > 0 ? `translateY(-${storyDraftKeyboardInset}px)` : undefined,
                  transition: "transform 160ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                {storyTextEditorOpen && <div role="group" aria-label={t("Шрифт текста")} className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#181818]/72 p-1.5 backdrop-blur-[16px]">
                  {STORY_FONTS.map(font => <button key={font.id} type="button" aria-pressed={storyTextFont === font.id}
                    onPointerDown={event => event.preventDefault()}
                    onClick={() => setStoryTextFont(font.id)}
                    style={storyFontStyle(font.id)}
                    className={cn("shrink-0 rounded-xl px-3 py-2 text-sm transition-colors", storyTextFont === font.id ? "bg-white/15 text-white" : "text-zinc-300 hover:bg-white/10")}>{font.label}</button>)}
                </div>}
                {/* 1. Liquid Glass Caption Bar <-> Draw Color Bar <-> Text Color Bar */}
                <div className={cn("relative w-full", editorMode === "text" && hideTextColors ? "h-0" : "h-12")}>
                  <AnimatePresence mode="wait" initial={false}>
                    {editorMode === "none" ? (
                      <motion.div
                        key="caption-bar"
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="flex h-12 w-full items-center rounded-full border border-white/[0.08] bg-[#181818]/72 px-4 py-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px]"
                      >
                        <input
                          type="text"
                          value={storyDraft.caption}
                          onChange={(event) =>
                            setStoryDraft((prev) => (prev ? { ...prev, caption: event.target.value.slice(0, 280) } : prev))
                          }
                          placeholder={t("Добавить подпись...")}
                          className="h-full min-w-0 w-full bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-400"
                          maxLength={280}
                        />
                      </motion.div>
                    ) : editorMode === "draw" ? (
                      <motion.div
                        key="draw-color-bar"
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="w-full"
                      >
                        {renderDrawColorPickerBar()}
                      </motion.div>
                    ) : !hideTextColors ? (
                      <motion.div
                        key="text-color-bar"
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="w-full"
                      >
                        {renderTextColorPickerBar()}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                {/* 2. Liquid Glass Bottom Controls Row matching reference */}
                <div className="flex w-full items-center justify-between gap-2.5">
                  {/* Left: Time To Live picker (24ч / 48ч) or Cancel mode button */}
                  <div className="relative shrink-0">
                    <AnimatePresence mode="wait" initial={false}>
                      {editorMode === "none" && !storyTextEditorOpen ? (
                        <motion.div
                          key="ttl-btn"
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.15 }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setStoryTtlPickerOpen((prev) => !prev);
                            }}
                            aria-label={t("Выбрать время показа истории")}
                            title={t("Время показа: {0}ч", { 0: storyDraft.ttlHours })}
                            className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-[#181818]/72 text-white font-bold text-[13px] shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px] hover:bg-[#222224]/80 active:scale-95 transition-all cursor-pointer"
                          >
                            {storyDraft.ttlHours}{t("ч")}</button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="cancel-btn"
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.15 }}
                        >
                          <button
                            type="button"
                            onClick={cancelStoryAction}
                            aria-label={t("Отменить режим")}
                            title={t("Отменить")}
                            className="grid h-11 w-11 place-items-center text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                          >
                            <X size={23} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {editorMode === "none" && storyTtlPickerOpen ? (
                        <motion.div
                          className="absolute bottom-[calc(100%+10px)] left-0 flex min-w-[84px] flex-col rounded-xl border border-white/[0.08] bg-[#181818]/90 p-1 shadow-[0_14px_34px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px] z-40"
                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.97 }}
                          transition={{ duration: 0.16, ease: "easeOut" }}
                        >
                          {[6, 12, 24, 48].map((hours) => (
                            <button
                              key={`story-ttl-${hours}`}
                              type="button"
                              onClick={() => {
                                setStoryDraft((prev) => (prev ? { ...prev, ttlHours: hours as 6 | 12 | 24 | 48 } : prev));
                                setStoryTtlPickerOpen(false);
                              }}
                              className={cn(
                                "rounded-lg px-2.5 py-1.5 text-center text-xs font-bold transition-colors cursor-pointer",
                                storyDraft.ttlHours === hours
                                  ? "bg-white text-zinc-950 shadow-sm"
                                  : "text-zinc-200 hover:bg-white/10",
                              )}
                            >
                              {hours}{t("ч")}</button>
                          ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  {/* Center: Tools Capsule (in normal mode) or Mode Pill (in draw/text mode) */}
                  <AnimatePresence mode="wait" initial={false}>
                    {editorMode === "none" && !storyTextEditorOpen ? (
                      <motion.div
                        key="tools-capsule"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-1 items-center justify-around h-11 rounded-full border border-white/[0.08] bg-[#181818]/72 px-4 shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px]"
                      >
                        {/* Pen/Draw */}
                        <button
                          type="button"
                          onClick={() => {
                            setStoryTtlPickerOpen(false);
                            activateEditorMode("draw");
                            setStoryOverlayTool("draw");
                            setStoryOverlaySelectedTextId(null);
                          }}
                          aria-label={t("Рисование")}
                          className="grid h-10 w-10 place-items-center text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                        >
                          <Pencil size={22} />
                        </button>

                        {/* Text */}
                        <button
                          type="button"
                          onClick={() => {
                            setStoryTtlPickerOpen(false);
                            addStoryTextLayer();
                          }}
                          aria-label={t("Текст")}
                          className="grid h-10 w-10 place-items-center text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                        >
                          <Type size={22} />
                        </button>

                        {/* Stickers */}
                        <button
                          type="button"
                          onClick={() => {
                            setStoryTtlPickerOpen(false);
                            setEmojiEditingId(null);
                            setEmojiDraft("");
                            setEmojiPickerOpen(true);
                          }}
                          aria-label={t("Эмодзи")}
                          className="grid h-10 w-10 place-items-center text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                        >
                          <Smile size={22} />
                        </button>
                      </motion.div>
                    ) : editorMode === "draw" ? (
                      <motion.div
                        key="draw-tools-capsule"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-1 items-center justify-around h-11 rounded-full border border-white/[0.08] bg-[#181818]/72 px-2 shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px]"
                      >
                        <div className="relative">
                          <button type="button" onClick={() => setBrushWidthPickerOpen(open => !open)}
                            title={t("Толщина кисти: {0}px", { 0: storyOverlayStrokeWidth })} aria-label={t("Выбрать толщину кисти")}
                            aria-expanded={brushWidthPickerOpen}
                            className="grid h-10 w-10 place-items-center text-zinc-300 hover:text-white active:scale-95 transition-transform">
                            <PencilSparkles size={22} />
                          </button>
                          <AnimatePresence>
                            {brushWidthPickerOpen && <motion.div
                              initial={{ opacity: 0, y: 8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .96 }}
                              transition={{ duration: .16 }} role="group" aria-label={t("Толщина кисти")}
                              className="absolute bottom-full left-0 z-40 mb-[72px] flex gap-1 rounded-2xl border border-white/10 bg-[#181818]/75 p-2 shadow-xl backdrop-blur-[24px]">
                              {[3, 6, 12, 20].map(width => <button key={width} type="button" aria-label={t("Кисть {0} px", { 0: width })}
                                aria-pressed={storyOverlayStrokeWidth === width}
                                onClick={() => { setStoryOverlayStrokeWidth(width); setStoryOverlayEraserMode(false); setBrushWidthPickerOpen(false); }}
                                className={cn("flex h-16 w-14 flex-col items-center justify-center gap-1 rounded-xl text-white transition-colors", storyOverlayStrokeWidth === width ? "bg-white/15" : "hover:bg-white/10")}>
                                <svg viewBox="0 0 48 32" className="h-8 w-12" aria-hidden="true"><path d="M8 23 C16 3 28 29 40 9" fill="none" stroke="currentColor" strokeWidth={width * .65} strokeLinecap="round" /></svg>
                                <span className="text-[11px] text-zinc-300">{width} px</span>
                              </button>)}
                            </motion.div>}
                          </AnimatePresence>
                        </div>

                        {/* Eraser toggle */}
                        <button
                          type="button"
                          onClick={() => setStoryOverlayEraserMode((prev) => !prev)}
                          title={storyOverlayEraserMode ? t("Ластик включен (нажмите для выключения)") : t("Включить ластик")}
                          aria-label={t("Ластик")}
                          className={cn(
                            "flex h-10 w-10 items-center justify-center transition-all active:scale-95 cursor-pointer",
                            storyOverlayEraserMode
                              ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]"
                              : "text-zinc-300 hover:text-white",
                          )}
                        >
                          <Eraser size={22} />
                        </button>

                        {/* Undo button */}
                        <button
                          type="button"
                          onClick={undoLastDrawingStroke}
                          disabled={!storyDraft || storyDraft.overlay.strokes.length === 0}
                          title={t("Отменить последний штрих")}
                          aria-label={t("Отменить последний штрих")}
                          className="flex h-10 w-10 items-center justify-center text-zinc-300 hover:text-white active:scale-95 transition-all disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                        >
                          <Undo2 size={22} />
                        </button>

                        {/* Clear all drawings */}
                        <button
                          type="button"
                          onClick={clearStoryOverlayDrawings}
                          disabled={!storyDraft || storyDraft.overlay.strokes.length === 0}
                          title={t("Очистить всё")}
                          aria-label={t("Очистить всё")}
                          className="flex h-10 w-10 items-center justify-center text-zinc-300 hover:text-red-400 active:scale-95 transition-all disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                        >
                          <MdDelete size={22} />
                        </button>
                      </motion.div>
                    ) : storyTextEditorOpen ? (
                      <motion.div
                        key="text-typing-tools"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-1 items-center justify-center gap-3 h-11 rounded-full border border-white/[0.08] bg-[#181818]/72 px-4 shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px]"
                      >
                        <StorySizeButton delta={-4} onStep={adjustSelectedStoryTextSize} />
                        <span className="text-xs font-semibold text-zinc-400 min-w-[34px] text-center">{storyTextSize}px</span>
                        <StorySizeButton delta={4} onStep={adjustSelectedStoryTextSize} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="text-mode-tools"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-1 items-center justify-around h-11 rounded-full border border-white/[0.08] bg-[#181818]/72 px-2 shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px]"
                      >
                        {/* 1. Size smaller */}
                        <StorySizeButton delta={-4} onStep={adjustSelectedStoryTextSize} />

                        {/* 2. Size bigger */}
                        <StorySizeButton delta={4} onStep={adjustSelectedStoryTextSize} />

                        {/* 3. Edit text content */}
                        <button
                          type="button"
                          onClick={() => {
                            const targetId = storyOverlaySelectedTextId || storyDraft?.overlay.texts.slice(-1)[0]?.id;
                            if (targetId) updateStoryTextLayer(targetId);
                          }}
                          title={t("Редактировать текст")}
                          aria-label={t("Редактировать текст")}
                          className="grid h-10 w-10 place-items-center text-zinc-200 hover:text-white active:scale-95 transition-transform cursor-pointer"
                        >
                          <MdEdit size={24} />
                        </button>

                        {/* 4. Delete selected text */}
                        <button
                          type="button"
                          onClick={deleteSelectedStoryText}
                          title={t("Удалить этот текст")}
                          aria-label={t("Удалить текст")}
                          className="flex h-10 w-10 items-center justify-center text-zinc-300 hover:text-red-400 active:scale-95 transition-all cursor-pointer"
                        >
                          <MdDelete size={22} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Right: Round White Upload / Check Button */}
                  <div className="relative shrink-0">
                    <AnimatePresence mode="wait" initial={false}>
                      {editorMode === "none" && !storyTextEditorOpen ? (
                        <motion.button
                          key="btn-upload"
                          type="button"
                          disabled={storyUploading}
                          onClick={() => {
                            flushStoryMediaTransform();
                            submitStoryDraft(storyDraftRef.current ?? storyDraft);
                          }}
                          aria-label={t("Опубликовать")}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.15 }}
                          className="grid h-11 w-11 place-items-center rounded-full bg-white hover:bg-zinc-200 text-zinc-950 shadow-[0_10px_28px_rgba(255,255,255,0.25)] active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                        >
                          {storyUploading ? (
                            <Spinner className="h-4 w-4 text-zinc-950 animate-spin" />
                          ) : (
                            <Upload size={20} />
                          )}
                        </motion.button>
                      ) : (
                        <motion.button
                          key="btn-done"
                          type="button"
                          onClick={() => {
                            if (storyTextEditorOpen) {
                              submitStoryTextEditor();
                              editSnapshotRef.current = null;
                              return;
                            }
                            if (editorMode === "draw") {
                              activateEditorMode("none");
                              setStoryOverlayTool("none");
                              setStoryOverlayEraserMode(false);
                            } else {
                              activateEditorMode("none");
                              setStoryOverlaySelectedTextId(null);
                            }
                          }}
                          aria-label={t("Готово")}
                          title={t("Готово")}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.15 }}
                          className="grid h-11 w-11 place-items-center rounded-full bg-white hover:bg-zinc-200 text-zinc-950 shadow-[0_10px_28px_rgba(255,255,255,0.25)] active:scale-95 transition-all cursor-pointer"
                        >
                          <Check size={21} strokeWidth={2.6} />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <AnimatePresence>
                {emojiPickerOpen && <motion.div className="absolute inset-0 z-40 flex items-end bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={event => { if (event.target === event.currentTarget) setEmojiPickerOpen(false); }}>
                  <motion.div role="dialog" aria-label={t("Выбрать эмодзи")} initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }} transition={{ duration: .2, ease: "easeOut" }} className="flex max-h-[65%] w-full flex-col rounded-t-[28px] border-t border-white/10 bg-[#242424]/95 p-4 pb-[max(env(safe-area-inset-bottom),20px)] backdrop-blur-[16px]">
                    <div className="mb-4 text-[16px] font-semibold text-white">{t("Эмодзи")}</div>
                    <div className="mb-3 flex items-center gap-3"><div className="no-scrollbar flex h-10 min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full border border-white/[0.08] bg-[#181818]/72 px-3 shadow-[0_8px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-[16px]">{emojiDraft ? storyEmojiGraphemes(emojiDraft).map((emoji, index) => <StoryEmojiGlyph key={`${index}:${emoji}`} emoji={emoji} size={26} animated={storyEmojiGraphemes(emojiDraft).length === 1} />) : <span className="text-sm text-zinc-400">{t("Выберите эмодзи")}</span>}</div><button type="button" aria-label={t("Убрать последний эмодзи")} onClick={() => setEmojiDraft(prev => storyEmojiGraphemes(prev).slice(0, -1).join(""))} className="grid h-10 w-10 place-items-center text-zinc-300"><Undo2 size={20} /></button><button type="button" aria-label={t("Добавить эмодзи на историю")} disabled={!emojiDraft} onClick={addEmojiLayer} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black disabled:opacity-40"><Check size={20} /></button></div>
                    <div className="no-scrollbar grid min-h-0 grid-cols-8 gap-1 overflow-y-auto">{storyPickerEmojis.map(emoji => <button key={emoji} type="button" aria-label={emoji} onClick={() => setEmojiDraft(prev => storyEmojiGraphemes(prev).length < 12 ? prev + emoji : prev)} className="grid h-11 place-items-center rounded-xl text-2xl transition-colors hover:bg-white/10 active:bg-white/15"><StoryEmojiGlyph emoji={emoji} size={28} animated lazyAnimation /></button>)}</div>
                  </motion.div>
                </motion.div>}
              </AnimatePresence>
            </motion.div>
          </motion.div>
  );
}
