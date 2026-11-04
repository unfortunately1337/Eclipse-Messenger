# Personal calls: P2P migration and coturn rollout

The existing personal-call UI now has interchangeable P2P and LiveKit media
adapters. No database migration is needed. **The default remains LiveKit until
coturn is installed and production relay tests pass.** The deployment record at
the end distinguishes the application's defaults from the production setting.

## Transport and compatibility

- `CALLS_DIRECT_TRANSPORT=p2p` selects P2P for new personal calls between updated
  clients. Production requires a valid TURN configuration before selecting it.
- `CALLS_DIRECT_TRANSPORT=livekit` rolls new calls back to LiveKit. Keep its three
  server credentials and both SDK dependencies during the transition.
- A call retains its transport throughout its lifetime. An old cached recipient
  without `p2p-v1` support causes the invitation to downgrade to LiveKit before
  acceptance; the updated caller reconnects using the selected adapter. Existing
  local `@call_test` helpers still use this compatibility path.
- Groups continue through the existing LiveKit adapter. P2P is strictly 1:1.
- Privacy rules, exceptions, abuse limits, history, notification deduplication,
  camera flip, simultaneous camera/screen, volume preferences and UI remain.

The Node API authenticates both the account and the session that accepted the
call. `/api/calls/[id]/signal` additionally requires the current browser lease;
writes require CSRF. SDP and ICE candidates stay in short-lived Redis inboxes,
bounded by count, bytes and time. An atomic Redis operation allocates each
sequence and publishes its event together. Pusher carries only a call-ID wake-up
hint. Polling recovers missed hints; a gap triggers renegotiation.

Clients negotiate four bundled sources: microphone, camera, screen video and
optional screen audio. Perfect negotiation handles simultaneous offers. A fresh
page epoch rejects stale SDP after reload. ICE restarts refresh temporary TURN
credentials and retry interrupted connections.

## Encryption and quality

Direct WebRTC media uses browser DTLS-SRTP. Coturn forwards those encrypted
packets and does not receive media decryption keys. Signaling uses the existing
authenticated HTTPS API. This does not add independently verified caller
fingerprints or protect against a compromised signaling server/client. Direct
peers can learn each other's network addresses; `relay` avoids direct candidates
at the cost of server traffic.

Audio prefers Opus, 48 kHz mono, browser echo cancellation/noise suppression/AGC
and up to 96 kbit/s. Camera capture requests 1280×720 at 30 FPS. Screen capture
requests 1920×1080 at up to 45 FPS with a detail hint and separate optional audio.
Actual capture FPS/resolution depends on device/browser. Network loss, RTT and
available bandwidth adjust video encoding with hysteresis; screen detail is
preserved before reducing resolution. Audio-only calls do not need video-level
bandwidth. Mobile browsers without `getDisplayMedia` can view a remote screen
but cannot start a web screen capture.

## Ports to open after review

| Port | Protocol | Purpose |
| --- | --- | --- |
| 3478 | UDP | STUN and preferred TURN client connection |
| 3478 | TCP | TURN fallback when client UDP is blocked |
| 5349 | TCP | TURN over TLS, same `eclpse.ru` certificate |
| 49160–49959 | UDP | Coturn relay allocations |

No additional hostname is required. DNS must resolve `eclpse.ru` to this VPS,
without an HTTP/CDN proxy on TURN ports. Keep SSH, HTTP and HTTPS rules. Do not
reset or blindly enable a firewall. Match the provider's firewall as well as
the host firewall; UFW cannot open a provider-level rule.

Commands for a reviewed Ubuntu/Debian installation:

```sh
sudo apt-get update
sudo apt-get install --yes coturn openssl
sudo systemctl stop coturn
sudo ufw status verbose
# If UFW is the active host firewall:
sudo ufw allow 3478/udp comment 'Eclipse STUN TURN'
sudo ufw allow 3478/tcp comment 'Eclipse TURN TCP'
sudo ufw allow 5349/tcp comment 'Eclipse TURN TLS'
sudo ufw allow 49160:49959/udp comment 'Eclipse TURN relay'
```

For nftables/iptables-managed hosts, add equivalent rules to the existing
persistent ruleset instead of starting a second firewall manager. These ports
do not collide with the existing web service on 443. Networks allowing only
outbound 443 may still require a separate TURN endpoint on 443; 5349 is not a
universal bypass of corporate firewalls.

## Secret and server environment

Generate one shared secret, keep it root-readable, and use the **same value** in
coturn `static-auth-secret` and backend `WEBRTC_TURN_SECRET`. Do not send it to
the browser or Git. Never change the session/E2EE keys while doing this.

```sh
sudo install -d -o root -g turnserver -m 0750 /etc/coturn
sudo sh -c 'umask 077; openssl rand -hex 48 > /etc/coturn/shared-secret'
```

Add these variables to the existing **server** environment (outside source):

```dotenv
CALLS_DIRECT_TRANSPORT=livekit
WEBRTC_STUN_URLS="stun:eclpse.ru:3478"
WEBRTC_TURN_URLS="turn:eclpse.ru:3478?transport=udp,turn:eclpse.ru:3478?transport=tcp,turns:eclpse.ru:5349?transport=tcp"
WEBRTC_TURN_SECRET="<value from /etc/coturn/shared-secret>"
WEBRTC_TURN_TTL_SECONDS=1800
WEBRTC_ICE_TRANSPORT_POLICY=all
```

The backend returns per-call/per-user HMAC credentials valid for 30 minutes,
refreshing them before expiry. Quotas cap relay allocations and signaling abuse;
temporary credentials are not immediately revocable per call at coturn, so keep
the shared secret private and retain the short expiry.

## Coturn configuration and existing TLS certificate

Copy `deploy/coturn/turnserver.conf.template` to `/etc/turnserver.conf` after
substituting `__PUBLIC_IP__`, `__BIND_IP__` and `__TURN_SECRET__`. Check the assigned
IPv4 with `ip -4 addr` first. For this VPS the known public IP is
`144.31.15.181`; use it as bind IP only if assigned locally. Behind NAT, use the
local bind/relay IP and `external-ip=PUBLIC_IP/LOCAL_IP`.

The template disables admin interfaces, TCP peer relays, multicast, loopback and
private-network peer destinations (including Docker and cloud metadata). It
keeps TURN clients over TCP/TLS enabled. It uses one relay worker, a 600-allocation
quota, 12 allocations per temporary username and a 16-Mbit/s per-allocation cap.
It does not enable verbose logs or allocate storage for recordings.

This template binds IPv4 only. Ubuntu 22.04's coturn 4.5.2 incorrectly treats an
IPv6 unspecified-address deny entry as an IPv4 wildcard; no IPv6 ACL entries or
IPv6 relay addresses are used. Upgrade and validate family-specific ACLs before
enabling IPv6 relay interfaces.

On coturn 4.5/4.6, keep `no-cli`, `no-tlsv1`, `no-tlsv1_1`. On versions whose `turnserver
-h` explicitly documents CLI off and TLS 1.2 minimum as defaults (such as 4.10),
remove these deprecated directives; never add `cli`, `tlsv1` or `tlsv1_1`.
On newer container-aware versions, `cpus=1` can also constrain detected CPU count.

Reuse the **existing site's full certificate chain and private key**, without
requesting another certificate on port 80/443. For Caddy, inspect its data mount
and locate the `eclpse.ru.crt` / `.key` files; do not assume an ACME issuer path:

```sh
docker ps --format '{{.Names}}'
docker inspect <caddy-container> --format '{{range .Mounts}}{{println .Source .Destination}}{{end}}'
# Under the source mounted at /data:
sudo find <caddy-data-source>/caddy/certificates -type f -name 'eclpse.ru.crt'
```

Put the two absolute source paths in a root-owned 0600 file
`/etc/coturn/certificate-source.env`:

```dotenv
COTURN_CERT_SOURCE=/actual/caddy/path/eclpse.ru.crt
COTURN_KEY_SOURCE=/actual/caddy/path/eclpse.ru.key
```

Install the provided certificate-copy helper and timer:

```sh
sudo install -m 0750 deploy/coturn/sync-certificate.sh /usr/local/sbin/eclipse-turn-certificate
sudo install -m 0644 deploy/coturn/eclipse-turn-certificate.service /etc/systemd/system/
sudo install -m 0644 deploy/coturn/eclipse-turn-certificate.timer /etc/systemd/system/
sudo chmod 0600 /etc/coturn/certificate-source.env
sudo chown root:turnserver /etc/turnserver.conf
sudo chmod 0640 /etc/turnserver.conf
sudo systemctl daemon-reload
sudo systemctl start eclipse-turn-certificate.service
sudo systemctl enable --now eclipse-turn-certificate.timer
# Debian installations using this legacy toggle also need TURNSERVER_ENABLED=1
# in /etc/default/coturn. Check the installed unit before changing it.
sudo systemctl enable --now coturn
sudo systemctl status coturn --no-pager
sudo journalctl -u coturn -n 40 --no-pager
sudo ss -lntup
openssl s_client -connect eclpse.ru:5349 -servername eclpse.ru -verify_return_error </dev/null
```

The helper validates certificate expiry and key pairing, copies keys with 0640
permissions and restarts coturn **only when certificate contents change**.
Renewal restarts relay allocations; schedule this during a quiet period. Direct
calls are unaffected, relayed calls may need an ICE restart.

## Verification before enabling production

```sh
npm test -- lib/server/calls.test.ts lib/server/call-p2p.test.ts lib/server/call-ice.test.ts
npm run calls:p2p:test
```

The browser test uses fake capture devices and two synthetic peers, never real
accounts. `CHROME_PATH` overrides the Chrome executable. It checks Opus, both
cameras, concurrent camera+screen, crossed ICE restarts, microphone restoration,
independent screen stop, peer reload/new epoch and capture cleanup.

For a **TURN-only** run, put a short-lived ICE-server array obtained from the
authenticated test call's token response in an ignored local `.cache/*.json`
file, not in Git. Do not export the shared coturn secret. Set:

```sh
P2P_TEST_ICE_JSON=.cache/turn-test.json npm run calls:p2p:test -- --relay
```

Run separately with only the UDP URL, only the TCP URL and only the TLS URL.
Passing means real incoming audio/video bytes and frames, selected candidate
type `relay`, and preserved media after reconnection. A successful TCP socket
or ICE candidate alone does not prove media delivery. Reports are written to
`.cache/p2p-verification/`. To exercise the actual application UI, switch its
test environment to `WEBRTC_ICE_TRANSPORT_POLICY=relay`; restore `all` afterward.

`P2P_TEST_REDIS_URL` can point `call-p2p.test.ts` to a **dedicated disposable Redis**
to run the atomic inbox implementation and 50 simultaneous call pairs against
real Lua. Never point it at production Redis. Unit tests otherwise use memory.
This checks signaling isolation/concurrency, not 50 fully relayed HD video calls.

Finally test two signed-in accounts on different networks: desktop Chrome,
Android mobile data and iPhone Safari. Check accept/cancel/decline/missed, the
minimized tray and voice waves, camera flipping, permissions, volume persistence,
simultaneous screen+camera, network changes and completion animations. Mobile
autoplay/background restrictions still apply. Only after these checks change
`CALLS_DIRECT_TRANSPORT=p2p` and restart the app using its existing deployment
procedure; do not interrupt active calls for rollout.

## 1 vCPU / 4 GB and 50 calls

Direct calls put no media bandwidth or encoding load on the VPS. Redis stores
bounded signaling and the app performs authorization. Coturn relays encrypted
packets when necessary; it does no video encoding/transcoding.

50 one-to-one calls mean 100 endpoints. At 2 Mbit/s sent by each endpoint, a
fully relayed workload is roughly 200 Mbit/s inbound **and** 200 Mbit/s outbound
before protocol overhead. Simultaneous HD screen and camera can require much
more. CPU, NIC speed, traffic allowance and relay percentage must be measured;
1 vCPU is not a guarantee of 50 worst-case relayed HD calls. Keep memory/CPU and
NIC monitoring, measure relay share and retain rollback. The 800 relay ports
leave room for bundled allocations, multiple transports and ICE restarts.

## Later removal of LiveKit

Do not remove either SDK in this migration. After production P2P and physical
device checks pass, stop admitting old clients without `p2p-v1`, drain existing
LiveKit calls, replace/disable the group backend and migrate `@call_test` plus
the Cloud smoke test. Then remove the LiveKit adapter/backend, Cloud variables,
SDK preload branches and both dependencies together. Search for `livekit` in
source, tests and scripts before removing packages. The media UI already uses
the independent `CallMediaSession` interface.

References: [coturn configuration](https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf),
[perfect negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation),
[ICE restart](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce).

## Local verification record — 2026-11-04

- Production build and TypeScript check passed; 684 unit/regression tests passed
  (7 existing tests skipped).
- Actual Chrome peers passed direct, coturn UDP-only and coturn TCP-only runs:
  Opus, camera at both endpoints, simultaneous screen and screen audio, crossed
  ICE restarts, mute/unmute, peer reload and capture cleanup. TCP was repeated
  with fresh temporary credentials. Test devices were synthetic.
- A disposable Redis 8.4 instance passed authorization, idempotency, bounded
  queues and the 50-call-pair test against the actual Lua adapter. This is a
  signaling test, not a 50-HD-call VPS capacity measurement.
- Local coturn was 4.10 in an isolated test directory. Physical iPhone/Android
  and mobile-network UI checks are separate from synthetic browser verification.

## Production deployment — 2026-11-04

The existing Ubuntu 22.04 VPS now runs its maintained coturn 4.5.2 package with
the IPv4 configuration above. UFW allows the listed TURN/listener/relay ports.
TLS reuses the validated `eclpse.ru` certificate; the certificate-copy timer is
enabled. Real Chrome media tests against the VPS passed separately over UDP,
TCP and TLS, including voice, both cameras, simultaneous screen/audio, ICE
restart and peer reload. These used synthetic devices, not real-user calls.

The production backend selects `CALLS_DIRECT_TRANSPORT=p2p` with ICE policy `all`
and three TURN endpoints. LiveKit credentials and adapters remain available for
rollback and legacy clients. The rollout waited for no active calls; existing
database migrations were already applied. Temporary build swap was removed.
