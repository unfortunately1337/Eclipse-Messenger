# Contributing to Eclipse

Thanks for helping improve Eclipse. Small fixes, accessibility improvements,
translations, tests and clear bug reports are welcome.

## Before making a change

1. Search existing issues. Open an issue before starting a substantial feature.
2. Read the [setup guide](README.md#run-locally) and use your own local services.
3. Keep changes focused. Include a reproduction for a bug and relevant validation.
4. Never submit real messages, account data, credentials or production `.env` files.

## Validation

```sh
npm test
node --test sdk/eclipse-bot/index.test.mjs
npm run build
```

Run ESLint on files you changed. The existing codebase has lint debt, so do not
reformat unrelated files to make a contribution. When changing Next.js code, read
the bundled framework documentation in `node_modules/next/dist/docs/`.

Do not remove Prisma migrations. Add a migration when changing persistent schema.
Use synthetic data in tests. Changes to encryption, authentication, membership and
moderation must include appropriate permission checks.

## Licensing and resources

Contributions are submitted under the project's AGPL-3.0 license. Only contribute
code you may license this way. Retain third-party notices; do not add emoji packs,
images, audio or fonts without a documented redistribution license.

For suspected security issues, follow [SECURITY.md](SECURITY.md) rather than
publishing exploit details in an issue.
