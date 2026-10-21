# Галочки верификации

`User.isVerified`, `Group.isVerified`, `Channel.isVerified` — булевы поля, по умолчанию `false`. Боты используют поле своего профиля в `User`. `User.verified` подтверждает почту и не выдаёт галочку. У секретного чата собственного флага нет, рядом с его именем галочка не показывается.

Выдача и отзыв доступны через доверенный доступ к БД, не через настройки пользователя или API бота. В корне проекта:

```powershell
C:/eclipse/node/node.exe scripts/set-verification.mjs user username true
C:/eclipse/node/node.exe scripts/set-verification.mjs bot example_bot true
C:/eclipse/node/node.exe scripts/set-verification.mjs group group_name true
C:/eclipse/node/node.exe scripts/set-verification.mjs channel channel_name false
```

Последний аргумент `true` выдаёт галочку, `false` отзывает. Скрипт не изменяет подтверждение почты, пароль или роль владельца. После изменения обновите открытую страницу приложения.

По нажатию на галочку открывается небольшая подсказка рядом с ней. Для неподтверждённых сущностей значок отсутствует. Endpoint `/api/verification` только читает признаки; для приватных групп и каналов проверяется доступ текущего пользователя. Статусы запрашиваются пакетно, без данных почты и входа.
