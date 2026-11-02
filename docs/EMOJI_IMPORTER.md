# Stickers & Emoji Importer

Eclipse's built-in `@importbot` imports public Telegram sticker and custom emoji
packs into an authenticated user's account. A separate Telegram bot credential
is used by the server to retrieve pack metadata and original files.

## Configuration

- Set `TELEGRAM_IMPORT_BOT_TOKEN` in the server environment. Never expose it with
  a `NEXT_PUBLIC_` prefix, commit it, or include upstream request URLs in logs.
- Apply `20261031010000_imported_sticker_emoji_packs` using the normal Prisma
  migration deployment procedure.
- Restart the application after changing the token. Telegram file identifiers
  are bot-specific; incomplete imports renew identifiers before resuming.
- Pack files use the existing encrypted media storage configuration.

## Current flow

1. Open `@importbot` in Eclipse and press Start.
2. Send a `t.me/addemoji/...` or `t.me/addstickers/...` link directly; the bot
   detects its type automatically. The menu contains **Import via Telegram**
   and **Help**, with one guide covering the Telegram connection and import flow.
3. Review the pack's title and count, then confirm Import.
4. The same message displays progress. The worker resumes interrupted jobs.
5. When finished, the pack belongs to that Eclipse account across devices.
   Reimporting it does not duplicate its assets or account membership.

Send the Telegram link again to check for updates, or forward another sticker
from the same set through the Telegram bridge. Owned packs with additions show
an **Import updates** action and the number of new items. The existing pack is
extended; archived/removed Telegram items are retained for existing messages.
When nothing new exists, the bot reports that the owned pack is up to date.

Apply `20261101010000_incremental_pack_import` before running this version.
Every job stores its own immutable target snapshot. New files remain staged
until the full target succeeds, then publication, title/count and membership
changes commit together. Existing published items stay available during updates
and failures. Only missing files are downloaded on retry. Leased workers are
serialized per pack across application processes. Shared pack updates become
available to all accounts that already have the pack.

The importer has a Help menu action and `/help` instructions in Russian and
English. Links and Telegram forwarding both check account membership before
offering another import, including when an old confirmation button is pressed.
Completion notices include the pack title; progress cards have no timestamp.
Two independent packs can import concurrently per server process, with three
files per pack. Static previews are generated from the original image; animated
originals and previews download concurrently. Progress notifications are
coalesced to avoid refreshing the chat on every fast three-file batch.
Update cards count only additions in their progress indicator. Library cache
revisions ensure the updated contents replace previous metadata and previews.

Pack previews sit above search in a transparent horizontal strip. Message emoji
and sticker pickers include up to 48 recently selected items per kind, scoped to
the active account in this browser. Emoji statuses do not read or update that
history. Sticker grids use four columns. Pack metadata requests share in-flight
loads, ready packs reuse imported files, and imports process at most three files
concurrently without changing artwork quality.

Click an imported sticker or emoji to open the pack. Removing a pack removes
only account membership; already sent messages retain their artwork. Recipients
can view and add a pack without importing it again from Telegram.

Only visible picker rows are rendered. Animation stops outside the viewport;
the original animation is retained for normal display. Default animated Unicode
emoji remain available independently of imported custom packs.

## Boundaries

Only official Telegram API endpoints are fetched. Pack URLs, asset identifiers,
file sizes and animation properties are validated. Imported TGS expressions are
stripped; imported JavaScript is never executed. Files and pack changes require
authentication; modifying account membership also requires CSRF verification.

Limits: 512 items per pack, 64 MiB declared pack size, 8 MiB per original,
512 KiB per incoming thumbnail, 200 account packs, three active imports per
account. Temporary network and Telegram 5xx failures receive one automatic retry.

## Second method: sending a sticker or emoji to Telegram

The mobile flow uses an Eclipse inline button opening the service Telegram bot
with a short-lived random `start` parameter. A one-time exchange identifies the
destination Eclipse account without using its password. The user then sends a
sticker or a message containing custom emoji to that Telegram bot.

The receiver extracts a sticker's `set_name`, or resolves a message's
`custom_emoji_id` through `getCustomEmojiStickers`. Since `set_name` is optional,
items with no discoverable set return an explanation rather than guessing a
pack. Detected packs create confirmation cards in Eclipse; no account membership
is added until the user confirms there. Choose **Import via Telegram** from the
Eclipse importer's menu. The same card supports disconnecting the link.
The Telegram confirmation identifies the linked Eclipse account by its username.
Detected pack replies include the pack title and direct the user back to Eclipse
to confirm importing. Opening `/start` again shows the current linked account.

Linking tokens expire after five minutes, are stored as hashes, and can only be
redeemed once. A Telegram account cannot silently replace a different Eclipse
user's link. Disconnecting also invalidates outstanding tokens. Only private
Telegram messages are accepted, and only supported message fields are stored.
Queued payloads are encrypted, erased after completion, and retried after worker
restarts. Update IDs prevent duplicate confirmation cards. Completed queue rows
and expired tokens are pruned after 24 hours. Up to five unique packs can be
detected in one message. Normal Eclipse conversations are never sent to Telegram.

### Deployment

1. Apply `20261031020000_telegram_import_receiver`.
2. Set the existing bot credential and a random server-only
   `TELEGRAM_IMPORT_WEBHOOK_SECRET` (32–256 URL-safe characters).
3. Restart Eclipse, then run on the server:
   `node scripts/configure-telegram-importer.cjs https://eclpse.ru`.

The script first checks the deployed receiver, then registers the same-domain
HTTPS webhook with Telegram. It does not discard pending updates. No subdomain,
separate service, or additional hosting is needed.

For local development, set `TELEGRAM_IMPORT_RECEIVER_MODE=polling` in the ignored
`.env.local`, then restart the dev server. The developer instance retrieves bot
updates itself, with a shared Redis lease and durable offset. It refuses to poll
when Telegram already has an active webhook, and never removes or replaces that
webhook. This mode is disabled in production, regardless of the environment flag.

### Optional channel invitation

On the first private interaction, the Telegram bot sends a quiet, localized
invitation with an inline Subscribe link to `https://t.me/eclipsemessenger`.
The suggestion never requires membership or changes import permissions. An
atomic Redis claim prevents duplicates across updates and worker processes.
It can appear again only on a later user interaction after a random 30–60 day
cooldown; there are no scheduled messages or broadcasts. Delivery/cache failures
do not interrupt importing, and Telegram timeouts do not reset the cooldown.
