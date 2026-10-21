import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export class EclipseApiError extends Error {
  constructor(status, message, details) { super(message); this.name = 'EclipseApiError'; this.status = status; this.details = details; }
}
const delay = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const done = () => { signal?.removeEventListener('abort', abort); resolve(); };
  const timer = setTimeout(done, ms);
  const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason); };
  signal?.addEventListener('abort', abort, { once: true });
});
const safeRetries = new Set(['getMe', 'getUpdates', 'getChat', 'getFile', 'getMyCommands', 'getWebhookInfo', 'getMyChatSettings', 'getChatSettings']);

/** Server-side client. Keep its token out of browsers, URLs and logs. */
export class EclipseBot {
  constructor({ baseUrl, token, fetch: fetchImpl = globalThis.fetch, offsetFile } = {}) {
    if (!token || !baseUrl) throw new TypeError('baseUrl and token are required');
    const url = new URL(baseUrl);
    if (url.username || url.password || url.search || url.hash) throw new TypeError('Use the Eclipse origin without credentials or query parameters');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new TypeError('HTTPS is required outside localhost');
    this.baseUrl = url.href.replace(/\/$/, '') + '/api/bot/v1';
    this.token = token; this.fetch = fetchImpl; this.offsetFile = offsetFile; this.handlers = []; this.running = false;
  }
  async call(method, parameters = {}, { signal } = {}) {
    const canRetry = safeRetries.has(method) || Boolean(parameters.request_id);
    for (let attempt = 0; ; attempt++) {
      let response, payload;
      try {
        response = await this.fetch(`${this.baseUrl}/${method}`, {
          method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(parameters), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000), redirect: 'error',
        });
        payload = await response.json();
      } catch (error) {
        if (!canRetry || attempt >= 3 || signal?.aborted) throw error;
        await delay(500 * 2 ** attempt, signal); continue;
      }
      if (response.ok && payload.ok) return payload.data;
      if (attempt < 3 && (response.status === 429 || (canRetry && response.status >= 500))) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await delay(Math.min(60000, retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt), signal); continue;
      }
      throw new EclipseApiError(response.status, payload.error ?? 'Bot API request failed', payload.details);
    }
  }
  sendMessage(chatId, text, options = {}) { return this.call('sendMessage', { chat_id: chatId, text, ...options, request_id: options.request_id ?? randomUUID() }); }
  sendMedia(method, chatId, fileId, options = {}) { return this.call(method, { chat_id: chatId, file_id: fileId, ...options, request_id: options.request_id ?? randomUUID() }); }
  sendMediaGroup(chatId, media, options = {}) { return this.call('sendMediaGroup', { chat_id: chatId, media, ...options, request_id: options.request_id ?? randomUUID() }); }
  editMessage(chatId, messageId, text, options = {}) { return this.call('editMessageText', { chat_id: chatId, message_id: messageId, text, ...options }); }
  deleteMessage(chatId, messageId) { return this.call('deleteMessage', { chat_id: chatId, message_id: messageId }); }
  answerCallback(id) { return this.call('answerCallbackQuery', { callback_query_id: id }); }
  setCommands(commands) { return this.call('setMyCommands', { commands }); }
  setMyChatSettings(settings) { return this.call('setMyChatSettings', settings); }
  getMyChatSettings() { return this.call('getMyChatSettings'); }
  setChatSettings(chatId, settings) { return this.call('setChatSettings', { chat_id: chatId, settings }); }
  getChatSettings(chatId) { return this.call('getChatSettings', { chat_id: chatId }); }
  async uploadFile(chatId, file, { kind = 'file', name = 'document', durationMs = 0, signal } = {}) {
    const form = new FormData(); form.set('chat_id', chatId); form.set('kind', kind); form.set('duration_ms', String(durationMs));
    form.set('file', file instanceof Blob ? file : new Blob([file]), name);
    const response = await this.fetch(`${this.baseUrl}/uploadFile`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}` }, body: form, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000), redirect: 'error' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new EclipseApiError(response.status, payload.error ?? 'Upload failed');
    return payload.data;
  }
  async downloadFile(fileId, { signal } = {}) {
    const file = await this.call('getFile', { file_id: fileId }, { signal });
    const response = await this.fetch(`${this.baseUrl}/files/${encodeURIComponent(file.file_id)}`, { headers: { Authorization: `Bearer ${this.token}` }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000), redirect: 'error' });
    if (!response.ok) throw new EclipseApiError(response.status, 'File download failed');
    return response; // Stream response.body rather than buffering large files.
  }
  on(filter, handler) { this.handlers.push({ filter, handler }); return this; }
  command(name, handler) { return this.on(update => update.message?.text?.split(/\s/, 1)[0] === `/${name}`, handler); }
  callback(data, handler) { return this.on(update => update.callback_query?.data === data, handler); }
  async handleUpdate(update) {
    const message = update.message ?? update.edited_message ?? update.callback_query?.message;
    const chatId = message?.chat?.id ?? update.callback_query?.chat?.id;
    const requestId = action => {
      // Stable across polling/webhook retries, independent of token rotation.
      const hex = createHash('sha256').update(`${this.baseUrl}:${chatId}:${update.update_id}:${action}`).digest('hex');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
    };
    const context = { update, message, requestId, chatId, reply: (text, options) => this.sendMessage(chatId, text, options) };
    for (const { filter, handler } of this.handlers) if (await filter(update)) await handler(context);
  }
  async start({ signal, onError = error => console.error(error instanceof EclipseApiError ? `Bot API error ${error.status}` : 'Bot handler failed; update will be retried') } = {}) {
    if (this.running) throw new Error('Polling already started');
    this.running = true;
    let offset = 0;
    try {
      if (this.offsetFile) {
        try { offset = Number(await readFile(this.offsetFile, 'utf8')); if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid offset checkpoint'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      while (!signal?.aborted) {
        try {
          const updates = await this.call('getUpdates', { offset, timeout: 25, limit: 100 }, { signal });
          for (const update of updates) {
            if (signal?.aborted) break;
            await this.handleUpdate(update);
            const next = update.update_id + 1;
            if (this.offsetFile) {
              await mkdir(dirname(this.offsetFile), { recursive: true });
              const temporary = `${this.offsetFile}.${randomUUID()}.tmp`;
              await writeFile(temporary, String(next), { mode: 0o600 }); await rename(temporary, this.offsetFile);
            }
            offset = next; // Acknowledge only after successful handler and durable checkpoint.
          }
        } catch (error) {
          if (signal?.aborted) break;
          if (error instanceof EclipseApiError && [401, 403, 409].includes(error.status)) throw error;
          await onError(error); await delay(2000, signal).catch(() => {});
        }
      }
    } finally { this.running = false; }
  }
}

export function verifyWebhookSecret(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || expected.length < 16) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
