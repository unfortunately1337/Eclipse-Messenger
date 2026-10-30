# Calls

Eclipse uses LiveKit Cloud for media transport. No extra media process, TURN
installation or DNS records are required on the Eclipse host. The existing
application server authorizes users and issues room-scoped tokens; media goes
between the clients and LiveKit Cloud.

## Configuration

Create a project at https://cloud.livekit.io and set these server variables:

```dotenv
LIVEKIT_URL="wss://your-project.livekit.cloud"
LIVEKIT_API_KEY="your-project-key"
LIVEKIT_API_SECRET="your-project-secret"
```

Keep secrets out of Git, browser bundles and screenshots. Never prefix the key
or secret with `NEXT_PUBLIC_`. Restart the application after changing the server
environment. Redis and the existing application database must be available.
Calls are hidden when the optional variables are not configured.

## Initial release

- Voice calls in existing personal conversations, accept/decline/cancel.
- Personal calls occupy the chat area on desktop, keeping the chat list visible,
  and use a full-screen mobile view.
  The peer avatar, viewer's contact alias and animated connection status are
  shown together. Minimizing keeps an avatar/name/timer tray available in both
  the chat and chat list. Call-audio mute affects playback, not microphone capture.
- The backend supports group calls; their UI entry point is not currently exposed.
  Group rooms allow up to 24 connected participants; this is an application limit,
  not a performance guarantee or a promised Cloud plan allowance.
- Microphone, camera and browser-supported screen sharing, adaptive video,
  echo cancellation, browser noise suppression and reconnect handling.
- A minimized call keeps remote audio attached while navigating between chats.
- A call is owned by the session that started/accepted it. Other sessions can
  see that it exists but cannot obtain its participant token. Use one browser
  tab per active calling session; duplicate tabs are not separate participants.
- No calls to bots, yourself, Saved Messages or secret-chat entries. Channels
  and stage/listener broadcasts are not part of this initial release.
- Group membership and posting permission are checked at entry, token issuance
  and heartbeat. Personal calls respect the recipient's call privacy setting
  (Everyone, Contacts or Nobody) and its applicable exception list.
- Ringing expires after 45 seconds. Clients renew a 90-second presence lease;
  room state is reconciled by subsequent call requests. Calls have an eight-hour
  application lifetime. A server recovery loop reconciles expired calls even
  when the clients are closed, as described below.
- Ongoing call state is temporary Redis data. Personal call history is stored as
  one regular system message per call in PostgreSQL, updated on acceptance and
  completion. It distinguishes cancellation, decline, missed and completed calls,
  and preserves completed duration. Group calls do not create history messages.
  No schema migration is required. A Redis data loss does not preserve ongoing calls.

Call events use Pusher as hints and authenticated polling as a recovery path.
Access tokens are not sent over Pusher. Tokens permit only media publication and
subscription in one opaque room; clients cannot administer rooms or record calls
through the server API. Leave/end removes participants and requests Cloud token
revocation before deleting empty/ended rooms. External service failures can
delay disconnection; a browser display alone is not an access-control boundary.

The initial release uses encrypted WebRTC transport to the media service. It
does **not** enable application-managed end-to-end media encryption. Do not
describe it as zero-access calling. There is no recording or transcription.

## Verification

Run unit tests and the optional short Cloud transport smoke test:

```sh
npm test -- lib/server/calls.test.ts app/api/calls/route.test.ts lib/server/livekit.test.ts lib/server/redis-adapter.test.ts
npm run calls:smoke
```

The smoke test creates an isolated temporary room with two synthetic browser
participants and deletes it afterward. It uses the configured Cloud project,
consumes a small amount of its usage, and needs Chrome plus network access.
It never calls a real user or sends chat messages. It tests media transport,
not the complete signed-in Eclipse interface.

For an end-to-end check, open two **different accounts** in separate browser
profiles (or a phone and computer), open their personal chat and press the phone
button. Check accept, decline, cancel, microphone mute, camera, minimize, leave,
refresh and loss/recovery of the network. Group calling remains a backend
capability and has no public UI entry point in this release.

Use headphones to avoid feedback. Verify Chrome, Safari, Bluetooth, mobile
networks and embedded browsers before public rollout. Beams pushes can notify
through the service worker where the browser/OS permits it; background ringing
and native OS call UI are not guaranteed. Device selection, ringtone preferences
and very large rooms need further implementation/testing.

## Local auto-answer account

Run `npm run calls:test-user` while the local app, PostgreSQL and Redis are
running. The helper creates `@call_test` (display name «Звонок») and accepts
incoming personal calls about four seconds after creation. It joins the real
LiveKit room and publishes a quiet intermittent synthetic tone, without opening
a microphone, playing incoming audio or recording anything. It supports repeated
calls until stopped. It does not automatically call anyone.

The helper refuses production mode or non-local app/database/Redis addresses.
Its temporary session is removed on shutdown; the test account remains available
for the next run. No password or provider credentials are printed. Only one
helper can run at a time. Chrome is required (`CHROME_PATH` can override its path).

Send a new text message containing exactly `1` to `@call_test` to request an
incoming audio call. Commands are read only from this test account's own direct
messages and decrypted with its own local identity in ignored
`.cache/call-test-identity.json`. No real user's private key is accessed. Old
messages are not replayed on restart, and commands received while busy are ignored.
Refresh the test chat once if it was opened before the helper published its key.

## Privacy and abuse protection

Call privacy is independent of the first-message policy. Settings are saved in Redis alongside existing privacy settings, without a database migration. Everyone and Contacts offer a Never allow list; Nobody offers an Always allow list. Contact membership is checked from the recipient's own contacts. Hidden exception lists are retained when the audience changes.

After two declined calls to the same recipient, that caller must wait 60 seconds. Five unanswered calls across recipients pause new personal calls for that caller for 10 minutes. A completed call resets the unanswered streak and the decline streak for that peer; cancelled calls do not count. Counts are deduplicated with the call outcome in one atomic Redis CAS record; idle counters expire after 24 hours. The existing five start attempts per minute and one ongoing call per account limits still apply.

The Node server starts a call recovery loop through instrumentation.ts. Redis retains pending call IDs across process restarts. The loop reconciles ringing timeouts and disconnected participants even when clients are closed, retries realtime/push delivery, and removes delivered ended calls from the pending set. This assumes a continuously running Node deployment, as used by the messenger.

Realtime events are hints, not authoritative call state. Clients fetch an authenticated snapshot immediately, coalesce overlapping hints, refresh after subscription/reconnection and network recovery, and keep five-second polling as fallback. LiveKit retains its own media reconnect and adaptive stream handling. Local incoming/outgoing tones require a browser audio-unlock gesture.

Beams call pushes carry only a call ID and state, with a short ringing TTL. The service worker validates current state and the signed-in recipient through /api/calls/notification before displaying a notification. A stable call notification tag updates the same card for missed calls; server deduplication plus a persistent browser cache prevent repeat notifications. Accepted/ended calls close the card. A visible app uses its incoming call UI instead of an OS notification. Browser and mobile OS notification/autoplay restrictions still apply.

## Local auto-answer test account

Set CALL_TEST_HELPER_ENABLED=1 in the ignored .env.local only for local development. The dev server supervises scripts/call-test-user.mjs and restarts an exited helper; production and non-local database/Redis origins are rejected. The helper accepts after about four seconds and starts a call when it receives an encrypted message containing exactly 1. It renews its own local session after expiry and discards stale media state before handling a new call.

The helper publishes only synthetic audio. If .cache/call-test-voice.wav exists, its normalized speech is looped with pauses; otherwise an audible three-note chime is used. No microphone is captured or recorded. Disable the local opt-in when the test account is no longer needed.

Personal calls read existing microphone tracks through a single local Web Audio context for immediate voice visualization. The miniature call player draws green remote and more transparent orange local waves, and the full personal call shows a remote-voice halo around the avatar. Meter nodes never connect to speakers and never stop the original media tracks; they are disconnected when the call ends. LiveKit participant levels remain the fallback if track analysis is unavailable.

## Screen sharing

Personal calls support browser screen capture with optional shared audio. The browser selects the tab, window or screen; shared audio availability depends on the selected source and browser. The share button remains visible in narrow layouts. Devices without getDisplayMedia show an explanatory toast instead of silently hiding it; those browsers can still receive a shared screen.

Screen content takes priority over cameras. Remote screen sharing takes the main stage when both people share; cameras remain in small previews. Local screen video is visible to the sender, with a top overlay identifying the outgoing screen share; when both participants share, the local screen remains visible in a small preview. Muted or removed screen tracks fall back to camera video. Incoming and local screen video remain inside the call window, with an opaque black background and no native full-screen button. Sharing the monitor or window that contains the preview can naturally show a recursive mirror. Capture uses detail content hints and a 3 Mbps / 15 fps screen encoding budget, independently of camera settings. Cancelling the picker is silent; capture failures appear as toasts. A synchronous guard prevents duplicate capture requests, and capture chosen after the call has ended is immediately stopped.

The Cloud smoke test in scripts/test-calls-livekit.mjs now verifies decoded screen frames with the camera still published, browser capture-ended handling, restart and explicit stop. It uses synthetic media and deletes its temporary room afterward. UI checks additionally cover 1280, 393 and 320 pixel widths.

## Personal camera presentation

The selected camera fills the complete call window, with controls and connection
quality above it. The large avatar/name are hidden while camera video is visible.
The small preview switches between the local and remote view; if only the local
camera is available, it becomes the default main view. Screen shares keep their
separate contain-fit presentation. Camera transitions use opacity/transform.

When the local camera is enabled, a switch-camera control animates into the row
immediately to the right of the camera button. It restarts the published video track using
the other phone lens (or the next desktop webcam) without replacing the room or
microphone. Rear-camera previews are not mirrored. If switching fails, the
previous camera is restored and an error toast explains the failure. A camera
acquired after hangup is stopped. The peer-avatar fallback fills the complete
preview tile, including generated initials, with only the tile's outer rounding.

On camera-off, the camera layer finishes its exit before the avatar returns. On
call completion, green retraction waits for that avatar. Dismissal waits for the
return effect if it takes longer than the normal result-label delay; parent
presentation retention includes a margin for the exit animation.

Connection fill takes about 1.1 seconds, with a smooth accelerating/decelerating
curve rather than an immediate burst. Failure fill takes 0.85 seconds; a completed
call retracts green into the avatar over 1.05 seconds. Short calls finish their
entrance before reversing it. The result label remains visible before dismissal,
and the presentation retention budget covers both effects and the window exit.
