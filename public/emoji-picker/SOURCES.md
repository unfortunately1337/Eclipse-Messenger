# Default emoji previews

**Source-edition notice:** the original previews described below are not included.
Known paths use local system-emoji fallbacks. See `docs/ARTWORK.md`.

These previews are derived from the existing Telegram GIF mapping in
`lib/client/telegram-emoji-gifs.ts`, originally sourced from
https://github.com/goforbg/telegram-emoji-gifs. Artwork retains its original rights.

Run `node scripts/build-inline-emoji.cjs` with source GIFs available in
`public/gifs` or `.cache/emoji-gifs`. The script builds local 96 px animated WebP
previews and separate 320 px message animations (at most 72 frames), transparent
letterboxing and static fallback frames. The `hq-v1` filenames invalidate older,
lower-resolution previews in browser caches.
The generated manifest is `lib/client/inline-emoji-assets.json`.

Custom packs used in messages are attributed in `public/custom-emoji/SOURCES.md`.
Their stable IDs are serialized by `lib/custom-emoji.ts`; messages cannot supply
an arbitrary image URL. Animated rendering is limited to visible content and
pauses while scrolling, while the page is hidden, or with reduced motion enabled.
