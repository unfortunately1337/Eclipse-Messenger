"use client";

import dynamic from "next/dynamic";

export const SettingsDrawer = dynamic(() => import("../components/common/SettingsDrawer").then(module => module.SettingsDrawer), {
  ssr: false,
  loading: () => null,
});

export const CallRoomPanel = dynamic(() => import("../components/common/CallRoomPanel").then(module => module.CallRoomPanel), { ssr: false });

export const loadStoryViewerModule = () => import("../components/story/StoryViewer");

export const StoryViewer = dynamic(() => loadStoryViewerModule().then(module => module.StoryViewer), { ssr: false });

export const StoryEditor = dynamic(() => import("../components/story/StoryEditor").then(module => module.StoryEditor), { ssr: false });

export const StoryCamera = dynamic(() => import("../components/story/StoryCamera").then(module => module.StoryCamera), { ssr: false });
