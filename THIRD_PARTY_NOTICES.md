# Third-party notices

The AGPL-3.0 license at the repository root applies to Eclipse-owned source code.
It does not relicense dependencies, fonts, icons, or artwork from other authors.
Keep their original license and copyright notices when redistributing them.

## Included resources

| Resource | Location | License / notice |
| --- | --- | --- |
| TikTok Sans | `public/fonts/story/` | SIL Open Font License 1.1; full text in `OFL-TikTokSans.txt` |
| React Icons and its source icon collections | `components/icon-subsets/` | Collection-specific terms listed in the adjacent `LICENSE` |
| npm dependencies | Installed by `npm ci` | Each package retains its own license in `node_modules`; pinned versions and declared licenses are recorded in `package-lock.json` |
| Eclipse native artwork fallbacks | `lib/server/artwork-fallback.ts` | Eclipse-owned code, AGPL-3.0; uses the viewer's installed emoji fonts |
| Eclipse source-edition wallpapers and README cover | `public/chat-bg-*.svg`, `docs/assets/eclipse-cover.svg` | Original code-native SVG artwork, AGPL-3.0 |

The React Icons generator extracts only the SVG functions actually imported by
the application. The full upstream notices are retained alongside the generator's
output. The dependency source code itself is obtained from npm during installation.

## Artwork deliberately omitted

This source release does **not** redistribute the production Telegram custom emoji
packs, Telegram-derived GIF/WebP previews, sticker illustrations or Lottie artwork.
Their source references are retained for provenance in:

- `public/custom-emoji/SOURCES.md`
- `public/emoji-picker/SOURCES.md`
- `public/tgs/telegram-security-animations.SOURCE.md`

Those references are not a permission grant. Asset filenames, Unicode fallback
labels and catalog IDs remain in source to keep message serialization compatible.
The local fallback handlers render system emoji instead. They do not fetch the
omitted packs from Telegram or a CDN. See [Artwork](docs/ARTWORK.md).

The Eclipse code license does not grant any rights in third-party trademarks.
Do not imply that an independently hosted instance is the official Eclipse service.

The source edition uses the existing static CSS gradients and does not depend on
`@firecms/neat`, whose upstream package declares `MIT AND Commons-Clause`.
