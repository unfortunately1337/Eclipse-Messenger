# Боты Eclipse

Создайте бота в системном чате **Eclipse → Боты → Создать бота** и скопируйте токен. Уникальное имя должно содержать 4–32 символа и оканчиваться на `bot`. Имя, аватар и токен можно изменить в **Мои боты**.

Программа бота запускается у вас: на компьютере или хостинге. Разворачивать собственный мессенджер и применять миграции для этого не нужно.

## Подключение

API: `https://eclpse.ru/api/bot/v1/МЕТОД`. Отправляйте POST-запросы с JSON и заголовком `Authorization: Bearer ТОКЕН`. Ответ: `{ "ok": true, "data": ... }`. Пользовательские cookie и CSRF не требуются.

Храните токен в переменных окружения и не публикуйте его. При утечке отзовите токен в меню бота.

- [Справочник методов](https://eclpse.ru/bot-api)
- [OpenAPI](https://eclpse.ru/api/bot/v1/openapi.json)
- [Node.js SDK и примеры](sdk/eclipse-bot/README.md)

Минимальный бот на Node.js 22.13+ из корня репозитория:

```js
import { EclipseBot } from './sdk/eclipse-bot/index.mjs';

const bot = new EclipseBot({
  baseUrl: 'https://eclpse.ru',
  token: process.env.ECLIPSE_BOT_TOKEN,
  offsetFile: './.eclipse-bot/offset',
});

bot.command('start', ({ reply, requestId }) =>
  reply('Здравствуйте!', { request_id: requestId('greeting') }));

await bot.start();
```

Откройте чат бота в Eclipse и нажмите **Старт**. Бот получает сообщения только после того, как пользователь начал переписку. Обработку `/start` и остальных команд задаёт ваша программа.

## Сообщения и кнопки

| Задача | Методы |
| --- | --- |
| Информация о боте и чате | `getMe`, `getChat` |
| Текст и редактирование | `sendMessage`, `editMessageText`, `deleteMessage` |
| Загрузка и скачивание файлов | `uploadFile`, `getFile` |
| Медиа | `sendPhoto`, `sendVideo`, `sendVoice`, `sendAudio`, `sendDocument`, `sendVideoNote`, `sendSticker`, `sendMediaGroup` |
| Команды и оформление чата | `setMyCommands`, `getMyCommands`, `setMyChatSettings`, `getMyChatSettings`, `setChatSettings`, `getChatSettings` |
| Нажатия и статус ввода | `answerCallbackQuery`, `sendChatAction` |

Inline-кнопки передавайте в `reply_markup.inline_keyboard`: HTTPS-ссылка открывается в браузере, `callback_data` поступает программе как `callback_query`. В `editMessageText` передавайте клавиатуру повторно, если хотите сохранить её: отсутствие `reply_markup` удаляет кнопки. Текст отправляется без HTML/Markdown-разметки.

Оформление бота задаёт `setMyChatSettings`: `empty_text` — текст пустого чата, `input_placeholder` — подсказка ввода, `menu` — команды, клавиатура или скрытое меню. `setChatSettings` переопределяет настройки отдельной переписки; `settings: null` возвращает общие настройки. Callback нижнего меню приходит с `source: "menu"` и `chat.id`, без отдельного сообщения.

Медиа сначала загружайте через `uploadFile(chat_id)`, затем передавайте полученный `file_id` в метод отправки. Файлы доступны только в соответствующем чате. Для скачивания используйте `getFile`, затем `download_path` с Bearer-токеном.

## Получение событий

Доступны `message`, `edited_message`, `callback_query`. Выберите один способ доставки:

- **Polling:** `getUpdates` с `timeout` до 25 секунд, `limit` от 1 до 100. После успешной обработки передавайте `offset = update_id + 1`. Запускайте один polling-процесс на бота. События хранятся 7 дней.
- **Webhook:** `setWebhook` указывает ваш публичный HTTPS-адрес на порту 443, без редиректов. Проверяйте заголовок `X-Eclipse-Bot-Secret-Token`. Для проверки и отключения используйте `getWebhookInfo` и `deleteWebhook`. При включённом webhook `getUpdates` возвращает 409.

События могут приходить повторно: учитывайте `update_id`. Для повторов отправки используйте тот же UUID `request_id`: одинаковый запрос вернёт прежнее сообщение, изменённое содержимое с тем же ID — ошибку 409.

## Ограничения

- 120 запросов в минуту на бота. При 429 соблюдайте `Retry-After`.
- Текст — до 16 384 символов, подпись — до 4096, файл — до 20 МиБ.
- Клавиатура — до 8 строк по 4 кнопки; `callback_data` — до 64 байт. Альбом — от 2 до 6 элементов.
- API v1 поддерживает личные переписки с ботом. События групп, каналов и секретных чатов не поддерживаются.
- Бот не получает доступ к чужим чатам, контактам или ключам шифрования. Его переписка доступна программе бота и серверу Eclipse; применяется TLS и шифрование хранения, без пользовательского E2EE.
