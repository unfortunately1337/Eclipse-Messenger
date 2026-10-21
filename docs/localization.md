# Interface languages

English is the default. The selected language is stored in the `eclipse.locale`
cookie for server rendering and in `eclipse:language:v1` for cross-tab updates.
The language setting is the last category in Settings; authentication has a
separate picker.

Use `useTranslation()` from `components/LocaleProvider.tsx` in client components.
Use `await getServerTranslation()` from `lib/i18n/server.ts` in server components.
The canonical Russian label is the translation key; add its English equivalent
to `lib/i18n/en.json`. Interpolate values with numbered placeholders:

```tsx
t("Открыть профиль {0}", { 0: displayName })
```

Do not translate user messages, names, custom bot responses, stored commands,
or transport/parser tokens. `localizeSystemText()` is for application-generated
Eclipse notices, including notices already stored before localization existed.
It translates each line independently and preserves inserted values.

Run `node scripts/i18n-audit.cjs` to inspect remaining Russian literals; parser
tokens, comparisons and native language names are expected exceptions. Run the
localization and email tests with Vitest. The dictionary test verifies that
every English entry preserves interpolation slots.

The code-confirmation illustration uses a local animated WebP converted from
`chat-bubble.gif` in the existing telegram-emoji-gifs asset set. It is resized
for the authentication screen, preloaded, and has a local still-image fallback.
