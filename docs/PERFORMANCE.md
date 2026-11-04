# Interface performance

The chat keeps measured, virtualized message rows. Scroll position is committed
in 96 px steps, with an additional 320 px buffer on each side and the existing
row overscan. Exact navigation, bottom following and history anchoring still use
the DOM scroll position. The mobile list no longer updates an unused header state
on every scroll frame.

Parsed message elements are reused within the current chat and search query.
The cache is reset on chat/account/query changes and is bounded to 200 entries
and 100,000 text characters. It is never persisted. Ordinary text skips Unicode
grapheme segmentation; joined emoji and custom emoji keep their animated renderer.
These changes do not lower asset resolution or remove visual effects.

Music, voice and call mini players share one filtered slot observer, without
periodic DOM polling. Ordinary message mutations do not notify player components.
Call waves continue sampling audio every frame, but stop rebuilding invisible SVG
paths in silence. Their attack, decay, colors and audio source remain unchanged.

## Verification on 2026-10-27

- Production build passed with `npm run build -- --webpack`.
- TypeScript passed. The automated suite passed 495 tests, with one skipped.
- An isolated local chat used 220 encrypted messages, including animated emoji,
  and disposable users. Decryption was asserted before measurement; all fixtures
  were removed afterward. At 1280 px and 393 px browser viewports, the 95th
  percentile frame interval during a 5.5-second scroll was about 17 ms, with no
  JavaScript errors or horizontal overflow. Occasional long tasks still occurred.
- A focused plain-text parser benchmark took about 20 ms instead of 283 ms for
  2,000 iterations. This is a parser result, not a whole-app speedup claim.
- Player slots survived delayed mounting, removal/replacement, and route changes.
  Fifty batches of unrelated message mutations produced no slot notifications.
- Silent call waves produced no path mutations. Existing audio-track analysis
  drove the remote wave in about 39 ms; independent local voice, mute and avatar
  halo checks passed. Real incoming/outgoing LiveKit audio checks also passed.

These are local Chrome measurements, including mobile viewport emulation, not
certification for every phone, browser, network or large group call. Use a
production build and `npm start` on the deployed server. React development
diagnostics were the dominant cost in the development scroll profile and should
not be used to judge release performance. The default Turbopack build hit an
internal CSS worker startup failure on this Windows environment; Webpack completed.

Targeted lint passed for the new optimization helpers and call visuals. A full
lint of the large chat page exhausted the local Node heap; existing global player
lint findings remain outside this optimization. This is not a claim of a clean
repository-wide lint run.

## Panel transitions

Settings, profile and community screen navigation uses Framer Motion. Desktop
chat/profile column changes also use Motion, so opening and closing remain
animated without a competing CSS transition. The responsive CSS fallback preserves
the desktop layout before hydration. Shared Motion configuration and menu timings
keep entrances and exits consistent and respect reduced-motion preferences.

The profile header updates only when crossing its collapsed-header threshold,
rather than updating the whole chat at every scroll pixel. Navigation direction
is resolved before committing a screen, avoiding a second correction after its
entrance starts. Closed settings ignore unrelated chat updates; the settings
bundle is warmed during idle time. Optional security animation preloads wait
until after the panel entrance and are cancelled when leaving that screen.

Browser checks exercise real Motion width interpolation during opening and
closing, forward/back screen navigation and exit cleanup at 1280, 900 and 393 px.

## Further work on 2026-10-28

Animation visibility now pauses only descendants of the scrolling pane. A scroll
in the chat no longer swaps emoji previews or pauses animated avatars in settings
and profiles. Nested scrolling, page hiding, newly mounted media, moved elements
and observer/timer cleanup are covered by tests. MediaAvatar and MediaBanner reuse
unchanged renders, while their own playback and visibility state remain live.

Open settings now use shallow prop comparison and stable event bindings that read
the latest committed state. An instrumented browser test of the actual drawer
recorded zero redraws for 12 unrelated parent updates; changed profile props and
the current close handler still worked. The image gallery skips non-image messages
before contact lookup, author metadata and date formatting.

The production build and isolated browser checks passed. The full app replay in
this run could not connect to local PostgreSQL and Redis because neither service
was listening. No new full-app frame-time improvement is claimed for this run.

## Call work on 2026-10-29

CallRoomPanel and attached media elements now skip unchanged parent renders.
Connection/track event bursts schedule one React update per animation frame;
personal-call speaker events no longer redraw the whole window, because the
voice visualizations read the existing tracks directly. The scheduler cancels
pending work during teardown. The media SDK starts loading when a call action
begins, overlapping permission and API waits.

Audio metering keeps one AudioContext while local/remote tracks arrive or are
replaced, reconnecting just the affected source. A browser comparison with three
remote-track changes counted four analysis contexts before and one after. The
original capture track remained live. Synthetic-track voice response checks
measured 23–38 ms in this run. The avatar halo avoids repeated opacity writes
in silence; its visible movement and the tray waves remain animated.

Browser regression checks cover camera swaps at 1280/393/320 px, green retraction
into the avatar after audio and video calls, persistent red failure fills, and
no waiting background after hangup. These are isolated desktop-browser checks,
including mobile viewport emulation, rather than physical-phone measurements.
## Performance and notification fixes — 2026-11-03

- Pack pickers commit scroll state in 32 px bands with a full-row overscan,
  share one scheduled resize/scroll measurement, and reuse pack filtering and row
  descriptions. Full pack grids use the same viewport observer.
- Vector sticker creation uses a cancellable shared 4 ms/frame queue instead of
  initializing all visible renderers in one Promise burst. Existing playback,
  visibility pause/resume and image resolution remain enabled.
- Chat viewport width transitions commit after settling. Height changes remain
  frame-coalesced for keyboard/viewport changes. Resize anchoring no longer
  restarts a smooth bottom scroll on every intermediate layout.
- Header and call-tray entrances keep Motion opacity/transform animation without
  simultaneously animating a raster blur. Glass material remains unchanged.
- Optional fonts no longer use a render-blocking CSS import. Auth no longer
  preloads an unused 2.15 MB lock GIF and 157 kB code illustration at module load.
  The lock illustration uses an appropriately sized animated WebP when needed:
  135 frames and 3.002 s versus the original 135 frames and 3 s.
- Browser and service-worker notifications share a generated plain-text formatter.
  Sticker previews are `😻 Стикер` / `😻 Sticker`; custom emoji tokens resolve to
  their Unicode label when available. Unknown objects/internal envelopes never
  reach the notification API. No plaintext message content was added to Beams.
  Activity labels no longer have trailing ellipses.

Verification: production Webpack build and TypeScript passed. An isolated Chrome
comparison of the actual picker with 2,000 entries at 393 px and 4x CPU slowdown
recorded 119 versus 6 renders over the same 120 px fine-scroll sequence; p95 frame
interval was 40 versus 34.5 ms. Both versions retained 70 mounted cells; selection
worked. This is a relative picker result, not a claim that every phone runs at
60 fps. Call animation checks passed at 1280/393 px. Notification and worker tests,
queue cancellation, viewport resize/scroll and the existing suite passed.

The supplied PageSpeed report resolves to `/login`; desktop performance was 96.
Its render-blocking stylesheet and unused image preloads informed the auth fixes.
It does not measure authenticated-chat scrolling. Local PostgreSQL/Redis/Docker
were unavailable in this run, so no new complete encrypted-chat end-to-end
benchmark or physical-device call performance result is claimed.

## Mobile authentication follow-up — 2026-11-03

The user's new mobile PageSpeed report (`6dikn464py`) scored 69 on `/login`:
LCP 4.7 s, TBT 350 ms and CLS 0.122. The earlier desktop score did not establish
that this mobile entry screen was fast.

- Initial auth content now stays visible in server HTML. Motion still animates
  subsequent steps, without a second nested card entrance.
- The initial login step uses request device hints, with a one-time viewport
  correction. The previous mobile hook returned `false` before measurement and
  incorrectly started QR login/polling on phones. Responsive QR-link visibility
  is handled by CSS instead of changing card height after hydration.
- The typing subtitle reserves its complete line layout. Story font loading
  only mounts inside the authenticated app, preventing a delayed font swap on
  the entry screens.
- QR generation and key-transfer validation load on demand. The idle monkey
  keeps its original 69 frames in a 50,454-byte native clip and 7,054-byte poster,
  replacing a 501,350-byte initial animated image. Poster loading has high
  priority. Autoplay/decoder failure uses an animated WebP fallback; entering
  text still loads the vector gaze animation, and password poses are preserved.

Production compilation, TypeScript and the existing 658-test suite passed.
Browser checks covered SSR visibility without JavaScript, mobile email login,
desktop QR rendering, native playback, vector tracking after typing, and
password visibility. These are browser/emulated-device checks, not physical
iPhone measurements. Follow-up Lighthouse artifacts are kept outside Git.

## Self-hosted font fix — 2026-11-04

Inter now loads from the same origin in the initial stylesheet, with its Latin
subset preloaded and Cyrillic preloaded for Russian UI. Roboto, Outfit and
Nunito are also self-hosted for story typography. Unicode ranges keep unused
subsets from being downloaded. The delayed Google Fonts component was removed.
Font files use content-hashed names and immutable caching. Licenses and sources
are in `public/fonts/app/`. Browser verification loaded both Inter subsets with
Google Fonts requests blocked, avoiding a missing/default font when that service
is unreachable.
