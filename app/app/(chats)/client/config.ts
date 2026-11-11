"use client";

import { PANEL_SUBVIEW_VARIANTS } from "@/lib/client/panel-motion";
import { ALL_STICKER_SRCS } from "@/lib/client/stickers";

export const telegramSubViewVariants = PANEL_SUBVIEW_VARIANTS;

export const VOICE_PLAY_EVENT = "eclipse:voice-play";

export const VOICE_STATE_EVENT = "eclipse:voice-state";

export const PRESENCE_STATUS_TICK_MS = 15_000;

export const CHAT_ITEM_ESTIMATED_HEIGHT = 72;

export const CHAT_PAGE_SIZE = 60;

export const CHAT_LIST_SCROLL_STATE_STEP = CHAT_ITEM_ESTIMATED_HEIGHT;

export const MESSAGE_ITEM_ESTIMATED_HEIGHT = 96;

export const MESSAGE_ROW_GAP = 0;

export const MESSAGE_SCROLL_STATE_STEP = 96;

export const CHAT_PREVIEW_DECRYPT_LIMIT = 16;

export const CHAT_PREVIEW_SHARED_KEY_WARMUP_LIMIT = 6;

export const SHARED_KEY_WARMUP_COOLDOWN_MS = 45_000;

export const SHARED_KEY_FETCH_SUCCESS_TTL_MS = 120_000;

export const SHARED_KEY_FETCH_MISS_TTL_MS = 20_000;

export const DIRECT_MESSAGES_LIMIT_DESKTOP = 24;

export const DIRECT_MESSAGES_LIMIT_MOBILE = 18;

export const HISTORY_PAGE_SIZE_DESKTOP = 36;

export const HISTORY_PAGE_SIZE_MOBILE = 24;

export const MESSAGE_HISTORY_LOAD_THRESHOLD = 180;

export const SCROLL_TO_BOTTOM_BUTTON_THRESHOLD = 280;

export const DIRECT_PEER_KEY_POLL_INTERVAL_MS = 2_500;

export const DIRECT_PEER_KEY_POLL_MAX_ATTEMPTS = 24;

export const CONVERSATION_CACHE_MAX_TEXT_CHARS = 500_000;

export const PARSED_MESSAGE_CACHE_MAX = 1200;

export const NORMALIZED_PREVIEW_CACHE_MAX = 1400;

export const CHAT_LIST_PREVIEW_META_CACHE_MAX = 1400;

export const MESSAGE_TIME_LABEL_CACHE_MAX = 6000;

export const DAY_KEY_CACHE_MAX = 9000;

export const MESSAGE_DAY_LABEL_CACHE_MAX = 5000;

export const DECRYPTED_PAYLOAD_TEXT_CACHE_MAX = 2200;

export const RECORD_START_SWIPE_UP_PX = 22;

export const VOICE_CANCEL_THRESHOLD_PX = 72;

export const VOICE_LOCK_THRESHOLD_PX = 72;

export const VOICE_MAX_DURATION_MS = 600_000;

export const VOICE_MAX_BYTES = 30_000_000;

export const VIDEO_MAX_DURATION_MS = 60_000;

export const VIDEO_MAX_BYTES = 30_000_000;

export const IMAGE_MAX_BYTES = 100 * 1024 * 1024;

export const CHAT_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export const MOBILE_CHAT_HEADER_HIDE_DISTANCE = 148;

export const MESSAGE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const STICKER_CATALOG = ALL_STICKER_SRCS;

export const CHAT_LIST_CACHE_STALE_MAX_MS = 24 * 60 * 60 * 1000;

export const STORY_FEED_CACHE_TTL_MS = 45 * 1000;

export const STORY_FEED_CACHE_STALE_MAX_MS = 10 * 60 * 1000;

export const STORY_FEED_POLL_INTERVAL_MS = 15_000;

export const CONVERSATION_CACHE_TTL_MS = 15 * 60 * 1000;

export const CONVERSATION_CACHE_STALE_MAX_MS = 24 * 60 * 60 * 1000;

export const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;

export const GROUP_MODAL_CACHE_TTL_MS = 10 * 60 * 1000;

export const CHANNEL_MODAL_CACHE_TTL_MS = 10 * 60 * 1000;

export const CONTACTS_FOR_ADD_CACHE_TTL_MS = 60 * 1000;

export const SELF_PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;

export const SESSION_CHAT_LIST_KEY_PREFIX = "eclipse:cache:chat-list:v3:";

export const PERSISTENT_CHAT_LIST_KEY_PREFIX = "eclipse:cache:chat-list:persistent:v3:";

export const SESSION_STORY_FEED_KEY_PREFIX = "eclipse:cache:story-feed:v1:";

export const PERSISTENT_STORY_FEED_KEY_PREFIX = "eclipse:cache:story-feed:persistent:v1:";

export const PERSISTENT_SELF_PROFILE_KEY_PREFIX = "eclipse:cache:self-profile:persistent:v2:";

export const PERSISTENT_LAST_SELF_PROFILE_KEY = "eclipse:cache:self-profile:last:v2";

export const PERSISTENT_PROFILE_KEY_PREFIX = "eclipse:cache:profile:persistent:v2:";

export const PERSISTENT_CONV_KEY_PREFIX = "eclipse:cache:conv:persistent:v2:";

export const SESSION_CONV_KEY_PREFIX = "eclipse:cache:conv:v2:";

export const SESSION_CONV_MAX_CHARS = 800_000;

export const SESSION_READ_MARKERS_KEY_PREFIX = "eclipse:cache:read-markers:v2:";

export const SESSION_READ_RECEIPTS_KEY_PREFIX = "eclipse:cache:read-receipts:v2:";

export const CHAT_UI_SETTINGS_KEY_PREFIX = "eclipse:chat:ui-settings:v1:";

export const MAX_PINNED_CHATS = 3;
