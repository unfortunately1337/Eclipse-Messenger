# Artwork in the source edition

All messaging, moderation, bot, encryption and account code is included. Some
production illustrations are third-party artwork with no redistribution grant
recorded in this project, so their binaries are intentionally absent.

The source edition uses local **system-emoji fallbacks** for these illustrations.
The appearance depends on the user's operating system and is not identical to the
production Telegram artwork. Static emoji do not send message text to an image CDN.
Lightweight native-font Lottie fallbacks keep animation-based UI components usable.

## How it works

- `lib/server/artwork-fallback-catalog.json` maps known optional paths to Unicode.
- Five narrowly scoped route handlers serve SVG, JSON or gzipped Lottie fallbacks
  for known paths under `/gifs`, `/emoji-picker`, `/custom-emoji`, `/stickers`, `/tgs`.
- The GIF API also uses the local fallback when a bundled GIF is absent.
- Unknown paths return 404; paths cannot select arbitrary files or remote URLs.
- Original catalog IDs are preserved so stored custom-emoji tokens remain readable.
- The source edition does not include private chats, uploaded media or user profiles.

The fallback files are generated from code and the user's installed fonts. They
are not converted or redrawn copies of the omitted artwork.

The bundled `public/chat-bg-*.svg` wallpapers are original geometric source-edition
patterns, not the production doodle artwork. Theme colors and custom uploaded
backgrounds still use the same application settings. The inactive third-party
gradient renderer has been removed; the already-active CSS gradients are retained.

## Supplying your own artwork

You may install assets you created or have permission to redistribute under the
paths used by the existing manifests. Local files in `public/` take precedence over
the fallback routes. Keep licenses and attribution alongside the assets. Review
`.gitignore` before intentionally publishing any newly licensed resources.

The existing `scripts/build-*.cjs` tools generate WebP previews from GIF/TGS source
files. See [maintenance](MAINTENANCE.md). They are optional and do not run during
normal installation or builds.

## Tests

The default suite tests the fallback responses, path validation and coverage of
all custom/default emoji manifests. Five binary integration checks for the omitted
original files are skipped when those files are absent. They run automatically if
the corresponding original asset sets are installed; all other tests still run.
