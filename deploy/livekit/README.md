# Eclipse SFU

Single-node LiveKit for group calls. Personal calls keep `CALLS_DIRECT_TRANSPORT=p2p`.
The installer reuses Eclipse's Caddy certificate and coturn authentication; it does
not need another domain, database or Redis instance. Room state is ephemeral.

For `localhost:3000`, with Docker Desktop running:

```sh
npm run calls:sfu:dev
```

This starts a separate `eclipse-sfu-dev` container with API port 7880 on loopback
and media ports 7881–7882 bound to the computer's LAN adapter for Docker Desktop,
generates local credentials under ignored `.data/livekit-dev/`, and writes only
the three `LIVEKIT_*` settings in `.env.local`. Reload the messenger tab after
Next dev reloads the environment. Camera starts disabled. This setup is for
the local browser; production continues to require WSS and its authorization proxy.
Stop it with `npm run calls:sfu:dev -- --stop`. If adapter detection needs an
override, set `ECLIPSE_SFU_DEV_MEDIA_IP` to this computer's private IPv4 address.

On the existing Ubuntu deployment, with Docker Compose, UFW and coturn configured:

```sh
python3 /opt/messenger/app/deploy/livekit/install.py --public-ip YOUR_SERVER_IPV4
```

The installer validates the existing Caddy site, starts and authenticates against
the SFU, adds only `/rtc`, `/rtc/*` and `/twirp/livekit.RoomService/*` proxy routes,
then adds server-only `LIVEKIT_*` variables to `/opt/messenger/.env`. Deploy/recreate
the app with both `compose.yaml` and `compose.app.yaml` to load those variables.
Generated configuration and secrets stay in `/opt/messenger/livekit`, outside Git.

Media uses UDP 7882 and TCP 7881; the private HTTP API binds only to loopback and
the Docker gateway. Existing coturn provides UDP/TCP/TLS relay fallbacks. SFU runs
with 768 MiB memory and 0.65 CPU to leave resources for the messenger, with no
fixed room participant cap. This is not a capacity guarantee on a 1-vCPU VPS.

```sh
docker compose -p eclipse-sfu -f /opt/messenger/livekit/compose.yaml ps
docker logs --tail 40 eclipse-sfu
```

The `/rtc` proxy uses `/api/calls/sfu-authorize` to recheck signed room tokens,
active call membership, session validity and group membership on each connection.
This blocks removed participants even though OSS LiveKit does not revoke their
JWTs itself. Deploy this application route before enabling the public RTC proxy.
Test via an Eclipse group with separate test accounts; arbitrary SDK-created
rooms are deliberately rejected by this authorization check.

Reference: [LiveKit deployment](https://docs.livekit.io/transport/self-hosting/deployment/)
and [ports](https://docs.livekit.io/transport/self-hosting/ports-firewall/).
