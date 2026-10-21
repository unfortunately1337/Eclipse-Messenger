export type SharedMusicTrack = {
  url: string;
  title: string;
  author?: string;
  coverUrl?: string;
  durationMs?: number;
};

export const MUSIC_SHARE_EVENT = "eclipse:music-share";
let pendingTrack: SharedMusicTrack | null = null;

export function requestMusicShare(track: SharedMusicTrack) {
  pendingTrack = { ...track };
  window.dispatchEvent(new Event(MUSIC_SHARE_EVENT));
}

export function takePendingMusicShare() {
  const track = pendingTrack;
  pendingTrack = null;
  return track;
}
