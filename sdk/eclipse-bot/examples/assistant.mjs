import { EclipseBot } from '../index.mjs';

const bot = new EclipseBot({ baseUrl: process.env.ECLIPSE_URL, token: process.env.ECLIPSE_BOT_TOKEN, offsetFile: './.eclipse-bot/offset' });
const abort = new AbortController();
process.once('SIGINT', () => abort.abort()); process.once('SIGTERM', () => abort.abort());
await bot.setCommands([{ command: 'start', description: 'Открыть меню' }, { command: 'help', description: 'Помощь' }]);
await bot.setMyChatSettings({
  empty_text: 'Этот бот показывает, как подключить вашу программу к Eclipse. Нажмите «Старт», чтобы попробовать.',
  input_placeholder: 'Напишите боту',
  menu: { type: 'keyboard', button_text: 'Меню бота', keyboard: [
    [{ text: 'Помощь', message: '/help' }, { text: 'О боте', callback_data: 'help' }],
    [{ text: 'Сначала', message: '/start' }],
  ] },
});
bot.command('start', async ({ reply, requestId }) => {
  await reply('Привет! Выберите действие.', {
    request_id: requestId('start'),
    reply_markup: { inline_keyboard: [[{ text: 'Помощь', callback_data: 'help' }]] },
  });
});
bot.command('help', ({ reply, requestId }) => reply('Я отвечаю через Eclipse Bot API. Отправьте сообщение или файл.', { request_id: requestId('help') }));
bot.callback('help', async ({ update, reply, requestId }) => {
  await bot.answerCallback(update.callback_query.id);
  await reply('Здесь можно подключить вашу программу, сервис или нейросеть.', { request_id: requestId('callback-help') });
});
bot.on(update => Boolean(update.message && !update.message.text?.startsWith('/')), async ({ update, reply, requestId }) => {
  await reply(update.message.text ? `Вы написали: ${update.message.text.slice(0,16000)}` : 'Вложение получено.', { request_id: requestId('echo') });
});
await bot.start({ signal: abort.signal });
