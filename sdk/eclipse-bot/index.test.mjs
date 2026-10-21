import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EclipseBot, EclipseApiError, verifyWebhookSecret } from './index.mjs';
test('downloadable SDK matches the maintained source', async () => {
  assert.equal(await readFile(new URL('../../public/bot-api/eclipse-bot.mjs',import.meta.url),'utf8'), await readFile(new URL('./index.mjs',import.meta.url),'utf8'));
});
test('SDK preserves request_id when retrying an interrupted send', async () => {
  const ids=[]; const bot=new EclipseBot({baseUrl:'http://localhost:3000',token:'test',fetch:async(_url,options)=>{ids.push(JSON.parse(options.body).request_id); if(ids.length===1) throw new TypeError('connection interrupted'); return Response.json({ok:true,data:{message_id:'reply'}});}});
  assert.equal((await bot.sendMessage('chat','hello')).message_id,'reply'); assert.equal(ids.length,2); assert.equal(ids[0],ids[1]);
});
test('polling retries failed handler without acknowledging, then saves offset', async () => {
  const directory=await mkdtemp(join(tmpdir(),'eclipse-sdk-')),offsetFile=join(directory,'offset'),abort=new AbortController(),offsets=[];let attempts=0;
  const bot=new EclipseBot({baseUrl:'http://localhost:3000',token:'test',offsetFile,fetch:async(_url,options)=>{const {offset}=JSON.parse(options.body);offsets.push(offset);if(offset===8){abort.abort();return Response.json({ok:true,data:[]});}return Response.json({ok:true,data:[{update_id:7,message:{message_id:'input',chat:{id:'chat'},text:'/start'}}]});}});
  const stable=[];bot.command('start',({requestId})=>{stable.push(requestId('greet'));if(++attempts===1)throw new Error('handler interrupted');});
  try{await bot.start({signal:abort.signal,onError:()=>{}});assert.deepEqual(offsets,[0,0,8]);assert.equal(await readFile(offsetFile,'utf8'),'8');assert.equal(stable[0],stable[1]);assert.notEqual(stable[0],'input');}finally{await rm(directory,{recursive:true,force:true});}
});
test('revoked tokens stop polling; webhook verification is exact',async()=>{
  const bot=new EclipseBot({baseUrl:'http://localhost:3000',token:'test',fetch:async()=>Response.json({ok:false,error:'revoked'},{status:401})});await assert.rejects(bot.start(),error=>error instanceof EclipseApiError&&error.status===401);
  assert.equal(verifyWebhookSecret('a_secret_of_16_chars','a_secret_of_16_chars'),true);assert.equal(verifyWebhookSecret('a_secret_of_16_charX','a_secret_of_16_chars'),false);assert.equal(verifyWebhookSecret(undefined,'a_secret_of_16_chars'),false);assert.equal(verifyWebhookSecret('short','short'),false);
});
test('menu callbacks can reply without a source message and retain per-chat identity', async () => {
  const sent = [];
  const bot = new EclipseBot({ baseUrl: 'http://localhost:3000', token: 'test', fetch: async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    return Response.json({ ok: true, data: true });
  } });
  const ids = [];
  bot.callback('about', async ({ chatId, reply, requestId }) => {
    assert.equal(chatId, 'chat-one');
    ids.push(requestId('about'));
    await reply('About this bot', { request_id: requestId('about') });
  });
  const update = { update_id: 7, callback_query: { id: 'event', source: 'menu', data: 'about', chat: { id: 'chat-one', type: 'private' } } };
  await bot.handleUpdate(update); await bot.handleUpdate(update);
  assert.equal(ids[0], ids[1]);
  assert.equal(sent[0].body.chat_id, 'chat-one');
  assert.equal(sent[0].body.text, 'About this bot');
  await bot.setMyChatSettings({ menu: { type: 'none' } });
  await bot.setChatSettings('chat-one', null);
  assert.ok(sent[2].url.endsWith('/setMyChatSettings'));
  assert.deepEqual(sent[3].body, { chat_id: 'chat-one', settings: null });
});

test('callback acknowledgement never sends bot text to application notifications', async () => {
  let sent;
  const bot = new EclipseBot({ baseUrl: 'http://localhost:3000', token: 'test', fetch: async (_, options) => {
    sent = JSON.parse(options.body);
    return Response.json({ ok: true, data: true });
  } });
  await bot.answerCallback('callback-id', 'Custom toast text');
  assert.deepEqual(sent, { callback_query_id: 'callback-id' });
});
