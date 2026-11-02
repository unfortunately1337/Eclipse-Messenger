# Custom emoji status assets

**Source-edition notice:** original production pack binaries are not included.
See `docs/ARTWORK.md`. Account-imported packs are retrieved at runtime with the
operator’s own Telegram bot and media storage configuration; see `docs/EMOJI_IMPORTER.md`.

Original Telegram custom emoji artwork belongs to the respective pack authors.
The active catalog contains 593 entries, grouped as follows:

- Games: https://t.me/addemoji/GameEmoji — 100 animations, and https://t.me/addemoji/GameIcons — 100 animations rendered white.
- Masks: https://t.me/addemoji/MasksEmoji — 30 animations rendered white.
- Ducks: https://t.me/addemoji/DuckEmoji — 104 animations.
- News: https://t.me/addemoji/NewsEmoji — 99 animations; Telegram logo 042 excluded.
- Finance: https://t.me/addemoji/FinanceEmoji — 60 animations.
- CursedMoji: https://t.me/addemoji/CreepyEmoji — 100 animations.

Status, Neon and Adaptive packs are excluded.
Original files were exported through https://boosts.tg/en/tools/telegram-emoji-pack-downloader.
Russian search descriptions, where matched by pack position and Unicode fallback,
come from https://github.com/Zulut30/premium-telegram-emoji.

Content hashes provide stable IDs. All files are served locally; the running app
needs no Telegram login, bot token or external service. Generate static thumbnails
and animated WebP previews with `node scripts/build-emoji-status-previews.cjs`
(Chrome required). Previews are 96 px, sampled up to 12 fps and 72 frames while
preserving source duration. The virtualized picker uses native image decoding;
offscreen cells, hidden tabs and active scrolling use static thumbnails. The
selected profile status uses SVG. Reduced-motion preferences disable autoplay.

This attribution does not change the artwork's rights or apply Eclipse's
source-code license to the artwork.
