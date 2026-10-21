"use client";

export const SELF_PROFILE_UPDATED_EVENT = "eclipse:self-profile-updated";
export const PROFILE_UPDATED_EVENT = "eclipse:profile-updated";

export type SelfProfileUpdatedPayload = {
  emojiStatusId?: string | null;
  id?: string | null;
  link: string;
  previousLink?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  musicUrl?: string | null;
  musicTitle?: string | null;
  musicAuthor?: string | null;
  musicCoverUrl?: string | null;
  email?: string | null;
  description?: string | null;
  usernameHidden?: boolean | null;
  secondaryLinks?: string[] | null;
};

export function broadcastSelfProfileUpdated(profile: SelfProfileUpdatedPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SelfProfileUpdatedPayload>(SELF_PROFILE_UPDATED_EVENT, { detail: profile }));
  window.dispatchEvent(new CustomEvent<SelfProfileUpdatedPayload>(PROFILE_UPDATED_EVENT, { detail: profile }));
}

export function subscribeSelfProfileUpdated(listener: (payload: SelfProfileUpdatedPayload) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<SelfProfileUpdatedPayload>).detail);
  };
  window.addEventListener(SELF_PROFILE_UPDATED_EVENT, handler);
  return () => window.removeEventListener(SELF_PROFILE_UPDATED_EVENT, handler);
}

export function broadcastProfileUpdated(profile: SelfProfileUpdatedPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SelfProfileUpdatedPayload>(PROFILE_UPDATED_EVENT, { detail: profile }));
}

export function subscribeProfileUpdated(listener: (payload: SelfProfileUpdatedPayload) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<SelfProfileUpdatedPayload>).detail);
  };
  window.addEventListener(PROFILE_UPDATED_EVENT, handler);
  return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handler);
}
