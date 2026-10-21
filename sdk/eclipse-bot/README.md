# Eclipse Bot SDK

Оформление чата задаётся программой:

```js
await bot.setMyChatSettings({
  empty_text: 'Этот бот помогает находить музыку.',
  input_placeholder: 'Пришлите название песни',
  menu: { type: 'keyboard', keyboard: [[
    { text: 'Помощь', message: '/help' },
    { text: 'О боте', callback_data: 'about' },
  ]] },
});
bot.callback('about', ({ reply }) => reply('Описание вашего бота'));
// Меню отдельного начатого диалога:
await bot.setChatSettings(chatId, { menu: { type: 'none' } });
// Возврат к общим настройкам:
await bot.setChatSettings(chatId, null);
```

`menu.type` — `keyboard`, `commands` (команды из `setCommands`) или `none`.
`answerCallback(id)` подтверждает нажатие без уведомления. Боты не могут показывать
toast приложения со своим текстом; используйте `reply` или `editMessage` для ответа.
Кнопка без действия отправляет свой `text`; `message` отправляет заданный текст,
`callback_data` создаёт событие без сообщения, `url` открывает HTTPS-ссылку.
Надпись пустого чата — `empty_text` (пустая строка скрывает плашку),
подсказка ввода — `input_placeholder`. Для меню доступны `button_text` и
`open_by_default`. Команды обрабатываются вашей программой, в том числе `/start`.
HTTP API доступен из Python и любого другого языка; методы перечислены в `/bot-api`.

Серверный SDK без внешних зависимостей, Node.js 22.13+.

SDK и пример также скачиваются со страницы `/bot-api` вашего сервера. Сохраните eclipse-bot.mjs и assistant.mjs рядом и запустите node assistant.mjs с указанными ниже переменными окружения. При обновлении index.mjs обновляйте public/bot-api/eclipse-bot.mjs: тест проверяет их совпадение.

```js
import { EclipseBot } from './sdk/eclipse-bot/index.mjs';
const bot = new EclipseBot({
  baseUrl: process.env.ECLIPSE_URL,
  token: process.env.ECLIPSE_BOT_TOKEN,
  offsetFile: './.eclipse-bot/offset',
});
bot.command('start', ({ reply, requestId }) =>
  reply('Здравствуйте!', { request_id: requestId('greeting') }));
await bot.start();
```

Создайте бота в системном чате Eclipse → Боты. Запустите пример в PowerShell:

```powershell
$env:ECLIPSE_URL = 'http://localhost:3000'
$env:ECLIPSE_BOT_TOKEN = 'ВАШ_ТОКЕН'
C:\eclipse\node\node.exe C:\eclipse\sdk\eclipse-bot\examples\assistant.mjs
```

Откройте чат бота и нажмите **Старт**. Пример отвечает на `/start`, `/help`, текст, вложения и inline-кнопку. Программу можно заменить своей логикой, CRM, сервисом или нейросетью. Она работает отдельным процессом на компьютере или сервере; Eclipse доставляет события и принимает ответы.

`command(name, handler)`, `callback(data, handler)`, `on(filter, handler)` выполняются в порядке регистрации. Контекст: `update`, `message`, `chatId`, `reply(text, options)` и `requestId(action)` — стабильный UUID для ответа на событие. Разным ответам нужны разные action. Все совпавшие обработчики выполняются; общий обработчик должен исключать уже обработанные команды.

`call(method, parameters, {signal})` поддерживает все методы. Есть обёртки sendMessage, sendMedia, sendMediaGroup, editMessage, deleteMessage, answerCallback, setCommands, uploadFile, downloadFile. `sendMedia('sendPhoto', chatId, fileId, options)` отправляет загруженный файл. downloadFile возвращает Response для потокового чтения. Спецификация: `/bot-api` и `/api/bot/v1/openapi.json`.

Один polling-процесс на бота. Offset сохраняется после успешного обработчика. Ошибочное событие повторяется. Для ответов используйте requestId(action), для внешних операций — свою идемпотентность: после сбоя между действием и checkpoint обработчик может повториться. Checkpoint храните на постоянном диске, отдельный файл для каждого бота. Не скрывайте ошибку обработчика, если событие нельзя подтверждать.

SDK повторяет чтение и отправку с request_id при временных ошибках, соблюдает Retry-After. Операции без request_id при сетевом сбое проверяйте вручную. `start({signal,onError})` останавливается по AbortSignal, неверному токену или активному webhook. Ctrl+C завершает пример.

Webhook: проверяйте `verifyWebhookSecret(request.headers['x-eclipse-bot-secret-token'], expectedSecret)` до обработки, ограничивайте размер тела, сохраняйте событие в свою очередь до ответа 2xx, обрабатывайте повторения по update_id. `bot.handleUpdate(update)` запускает те же обработчики. Webhooks и polling одновременно не используются.

Токен нельзя встраивать в браузер, git или URL. При утечке отзовите его в Eclipse. Переписка доступна программе бота: облачный транспорт, без E2EE. Эта версия работает с личными чатами, не с группами/каналами.
