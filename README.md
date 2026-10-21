<p align="center">
  <a href="https://eclpse.ru"><img src="docs/assets/eclipse-cover.svg" alt="Eclipse — A new generation of messaging" width="100%" /></a>
</p>

<p align="center">Conversations, communities and the details that make a messenger feel like yours.</p>

<p align="center">
  <a href="https://eclpse.ru"><strong>Open Eclipse ↗</strong></a>
  &nbsp; · &nbsp; <a href="#run-locally">Self-host</a>
  &nbsp; · &nbsp; <a href="CONTRIBUTING.md">Contribute</a>
  &nbsp; · &nbsp; <a href="docs/README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-59616f?style=flat-square" alt="AGPL-3.0 license" /></a>
  <a href="https://github.com/unfortunately1337/Eclipse-Messenger/actions/workflows/ci.yml"><img src="https://github.com/unfortunately1337/Eclipse-Messenger/actions/workflows/ci.yml/badge.svg" alt="Checks" /></a>
  <img src="https://img.shields.io/badge/built_with-TypeScript-59616f?style=flat-square" alt="Built with TypeScript" />
</p>

---

## Meet Eclipse

Eclipse is a web messenger for personal conversations, groups and channels. It
brings messaging, music, community tools and profile customization into one
responsive interface, with a choice of a solid appearance or Liquid Glass.

This repository contains the application source, server routes, database migrations,
tests and bot SDK. Inspect the implementation, contribute improvements or run
an independent instance with your own infrastructure.

| Stay connected | Make it yours | Build your community |
| --- | --- | --- |
| Direct chats, groups and channels | Color themes and custom backgrounds | Invite links and administrator roles |
| Replies, forwards and pinned messages | Profile banners, including animated media | Configurable reactions and polls |
| Photos, videos, voice and video messages | Emoji statuses and custom-emoji rendering | Bot platform and JavaScript SDK |
| Music playback, mini-player and sharing | Responsive mobile and desktop layouts | English and Russian interfaces |

Accounts support email-based sign-in, QR login, session management and optional
two-factor authentication. Secret chats have a separate invitation and expiry
lifecycle. Encryption and recovery properties differ by mode; read the
[security notes](SECURITY.md) before relying on a particular guarantee.

> **Artwork:** the source edition uses local system-emoji fallbacks for production
> illustrations whose redistribution rights are not established. Original Telegram
> emoji/sticker binaries are not included. Messaging and rendering code is included;
> the visual assets differ. See [artwork](docs/ARTWORK.md) and
> [third-party notices](THIRD_PARTY_NOTICES.md).

## Run locally

You need **Node.js 22.13+**, npm and Docker Compose, or your own PostgreSQL, Redis
and S3-compatible services. Use a supported Node LTS release.

```sh
git clone https://github.com/unfortunately1337/Eclipse-Messenger.git
cd Eclipse-Messenger
npm ci
npm run setup:local
docker compose up -d
```

`setup:local` creates a gitignored `.env` and generates an independent random value
for each application secret. It refuses to overwrite an existing `.env`. Its
service credentials are for the local Compose stack only.

Before signing in or sending media:

| Service | Configuration |
| --- | --- |
| PostgreSQL | Compose starts `app` on `127.0.0.1:5432` |
| Redis | Compose starts Redis on `127.0.0.1:6379` |
| Media storage | Open MinIO at `http://localhost:9001`, use the local Compose credentials and create the `eclipse-media` bucket |
| Email | Configure working `SMTP_*` values in `.env`; registration and login codes need delivery |
| Realtime | Set your own Pusher Channels credentials and matching `NEXT_PUBLIC_PUSHER_*` values |
| Push notifications | Optionally configure your own Pusher Beams credentials |

```sh
npm run db:migrate
npm run dev
```

Open **http://localhost:3000**. Production accounts, databases, uploads and service
credentials are not included. This is the application source, not an offline demo.

## Production

```sh
npm run build
npm start
```

`npm start` applies pending Prisma migrations before starting the server. Use your
own production configuration, HTTPS, private media storage and restricted database/
Redis access. Never deploy local Compose credentials. Back up database, media and
long-lived encryption keys together; changing encryption keys requires a migration.

If a reverse proxy replaces `Host`, set `ALLOWED_ORIGINS` to your trusted external
HTTPS origins. Preserve the intended host and protocol information. Changes to
`NEXT_PUBLIC_*` values require rebuilding the frontend.

A [Dockerfile](Dockerfile) is included: `docker build -t eclipse .`. Supply your own
runtime environment. Public frontend configuration must also be provided at build
time with `--build-arg NEXT_PUBLIC_PUSHER_KEY=...`,
`--build-arg NEXT_PUBLIC_PUSHER_CLUSTER=...` and, if needed,
`--build-arg NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID=...`. Never pass private secrets
as build arguments. The default image contains no Pusher credentials.

## For developers

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · PostgreSQL / Prisma ·
Redis · S3-compatible storage · Pusher · Lottie.

| Directory | Contents |
| --- | --- |
| `app/` | UI, auth pages, API routes and local artwork fallback routes |
| `components/`, `hooks/`, `lib/` | Shared UI, client behavior and server services |
| `prisma/` | Database schema and versioned migrations |
| `sdk/eclipse-bot/` | Bot SDK, examples and SDK tests |
| `scripts/` | Build tools and documented maintenance commands |
| `docs/` | Localization, artwork and maintenance documentation |

```sh
npm test
node --test sdk/eclipse-bot/index.test.mjs
npm run build
```

Five binary artwork checks skip when their optional original assets are absent;
the local fallbacks have their own tests. Run ESLint on changed files. See
[contributing](CONTRIBUTING.md) for existing lint limitations and the review process.

- [Bot platform](BOT_PLATFORM.md)
- [Maintenance tools](docs/MAINTENANCE.md)
- [Localization](docs/localization.md)
- [Security and responsible disclosure](SECURITY.md)

## License

Eclipse-owned source is available under **GNU AGPL v3.0**. If you modify it and
provide the modified application over a network, the license requires offering
the corresponding source to its users. Read the [full license](LICENSE).

Dependencies and third-party resources retain their own licenses. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

<p align="center"><a href="https://eclpse.ru"><strong>eclpse.ru</strong></a></p>
