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
