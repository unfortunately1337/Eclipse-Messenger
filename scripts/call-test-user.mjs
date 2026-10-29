// Local development helper. Uses real call authorization and LiveKit transport.
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import argon2 from "argon2";
import { chromium } from "playwright-core";
import { loadCallTestIdentity, isCallCommand } from "./call-test-commands.mjs";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const origin = new URL(process.env.CALL_TEST_ORIGIN || "http://localhost:3000");
const local = hostname => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
if (process.env.NODE_ENV === "production" || !local(origin.hostname) ||
    !local(new URL(process.env.DATABASE_URL).hostname) || !process.env.REDIS_URL || !local(new URL(process.env.REDIS_URL).hostname)) {
  throw new Error("This helper requires a local app, local database and local Redis.");
}
const db = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
const link = "call_test";
const description = "Локальный тест звонков: автоматический ответ через 4 секунды. Тестовый звуковой сигнал, без записи.";
const sessionId = randomUUID(), csrf = randomUUID();
const cookie = `${process.env.SESSION_COOKIE_NAME || "eclipse.sid"}=${sessionId}; ${process.env.CSRF_COOKIE_NAME || "eclipse.csrf"}=${csrf}`;
let user, browser, page, currentId, mediaReady = false, stopped = false, lock = false, failures = 0;
const lockKey = "calls:local-test-helper";
async function restoreTestSession() {
  if (!user) throw new Error("Local test user is not ready.");
  const owned = await db.user.findUnique({ where: { id: user.id }, select: { description: true, link: true } });
  if (owned?.description !== description || owned.link !== link) throw new Error("Local test account ownership changed; stopping.");
  await redis.set(`session:${sessionId}`, JSON.stringify({ userId: user.id, createdAt: new Date().toISOString(), userAgent: "Eclipse local call test" }), "EX", 7200);
  await redis.sadd(`user:sessions:${user.id}`, sessionId);
}
async function api(body, path = "/api/calls", retrySession = true) {
  const response = await fetch(new URL(path, origin), {
    method: body ? "POST" : "GET", signal: AbortSignal.timeout(15000),
    headers: { cookie, origin: origin.origin, "content-type": "application/json", "x-csrf-token": csrf },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 401 && retrySession && user && !stopped) {
    await restoreTestSession();
    console.log("Local test session restored; retrying request.");
    return api(body, path, false);
  }
  const result = await response.json().catch(() => null);
  if (!result) throw new Error(`Local app is rebuilding or unavailable (${response.status}); retrying.`);
  if (!response.ok || !result.ok) throw new Error(`Call helper request failed (${response.status})`);
  return result.data;
}
async function disconnect() {
  await page?.evaluate(async () => {
    await window.testRoom?.disconnect(); window.testRoom = null;
    await window.testAudio?.close(); window.testAudio = null;
  }).catch(() => {});
  currentId = null;
  mediaReady = false;
}
let heartbeatAt = 0;
async function connectMedia(id) {
          const connection = await api({ action: "token", id });
          const speechFile = ".cache/call-test-voice.wav";
          const speech = existsSync(speechFile) ? readFileSync(speechFile).toString("base64") : null;
          await page.evaluate(async ({ connection, speech }) => {
            const room = new window.LivekitClient.Room({ adaptiveStream: true, dynacast: true });
            window.testRoom = room;
            await room.connect(connection.url, connection.token);
            // Synthetic test speech only. Never capture a device microphone.
            const audio = new AudioContext(); window.testAudio = audio;
            const destination = audio.createMediaStreamDestination();
            const master = audio.createGain(); master.gain.value = 1; master.connect(destination); window.testGain = master;
            await audio.resume();
            if (speech) {
              const bytes = Uint8Array.from(atob(speech), char => char.charCodeAt(0));
              const decoded = await audio.decodeAudioData(bytes.buffer);
              const buffer = audio.createBuffer(1, decoded.length + Math.round(decoded.sampleRate * 0.3), decoded.sampleRate);
              const output = buffer.getChannelData(0);
              for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
                const input = decoded.getChannelData(channel);
                for (let i = 0; i < input.length; i++) output[i] += input[i] / decoded.numberOfChannels;
              }
              let peak = 0; for (const value of output) peak = Math.max(peak, Math.abs(value));
              const gain = peak > 0 ? 0.8 / peak : 1;
              for (let i = 0; i < decoded.length; i++) output[i] *= gain;
              const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
              source.connect(master); source.start();
            } else {
              const source = audio.createOscillator(), gain = audio.createGain();
              source.frequency.value = 440; gain.gain.value = 0;
              source.connect(gain).connect(master); source.start();
              const phrase = [{ at: 0, length: 0.35, pitch: 440 }, { at: 0.52, length: 0.35, pitch: 554 }, { at: 1.05, length: 0.65, pitch: 494 }];
              for (let offset = 0; offset < 7200; offset += 2.2) for (const syllable of phrase) {
                const time = audio.currentTime + offset + syllable.at, end = time + syllable.length;
                source.frequency.setValueAtTime(syllable.pitch, time);
                gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.24, time + 0.04);
                gain.gain.setValueAtTime(0.24, end - 0.06); gain.gain.linearRampToValueAtTime(0, end);
              }
            }
            const track = new window.LivekitClient.LocalAudioTrack(destination.stream.getAudioTracks()[0]);
            await room.localParticipant.publishTrack(track, { source: window.LivekitClient.Track.Source.Microphone });
          }, { connection, speech });
          mediaReady = true;

  heartbeatAt = Date.now();
}
process.on("SIGINT", () => { stopped = true; });
process.on("SIGTERM", () => { stopped = true; });
try {
  lock = await redis.set(lockKey, sessionId, "EX", 90, "NX") === "OK";
  if (!lock) throw new Error("The local call test helper is already running.");
  const existing = await db.user.findUnique({ where: { link } });
  if (existing && existing.description !== description) throw new Error("The test username is occupied by another account.");
  user = existing ? await db.user.update({ where: { id: existing.id }, data: { email: "call-test@eclipse.invalid", verified: true } }) : await db.user.create({ data: {
    link, displayName: "Звонок", description, verified: true, email: "call-test@eclipse.invalid",
    passwordHash: await argon2.hash(randomBytes(48).toString("hex")),
  } });
  // Add the local project owner's test conversation without touching other chats.
  const owner = await db.user.findUnique({ where: { link: "crypto" }, select: { id: true } });
  if (owner) {
    const conversation = await db.conversation.findFirst({ where: { type: "direct", AND: [
      { participants: { some: { userId: owner.id } } }, { participants: { some: { userId: user.id } } },
    ] } });
    if (!conversation) await db.conversation.create({ data: { type: "direct", participants: { create: [{ userId: owner.id }, { userId: user.id }] } } });
    await db.contact.upsert({ where: { ownerId_peerId: { ownerId: owner.id, peerId: user.id } }, create: { ownerId: owner.id, peerId: user.id, alias: "Звонок" }, update: {} });
  }
  await redis.set(`session:${sessionId}`, JSON.stringify({ userId: user.id, createdAt: new Date().toISOString(), userAgent: "Eclipse local call test" }), "EX", 7200);
  await redis.sadd(`user:sessions:${user.id}`, sessionId);
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  page = await browser.newPage();
  await page.setContent("<html><body>Local Eclipse call test</body></html>");
  await page.addScriptTag({ content: readFileSync(require.resolve("livekit-client"), "utf8") });
  const snapshot = await api();
  if (!snapshot.enabled) throw new Error("Calls are not configured in the local app.");
  const identity = await loadCallTestIdentity();
  await api({ publicKey: identity.publicKey }, "/api/settings/e2e-key");
  const commandSince = new Date();
  const seenCommands = new Set();
  async function checkCommands(busy) {
    const messages = await db.message.findMany({ where: { createdAt: { gte: commandSince }, isSystemMessage: false, senderId: { not: user.id }, conversation: { type: "direct", participants: { some: { userId: user.id } } } }, select: { id: true, sender: { select: { link: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 });
    for (const message of messages.reverse()) {
      if (seenCommands.has(message.id)) continue;
      if (busy) { seenCommands.add(message.id); continue; }
      const data = await api(null, "/api/chats/" + encodeURIComponent(message.sender.link) + "?messageId=" + encodeURIComponent(message.id));
      const command = await isCallCommand(data.messages?.find(item => item.id === message.id), identity);
      seenCommands.add(message.id);
      if (command) {
        const result = await api({ action: "start", kind: "direct", mode: "audio", link: message.sender.link });
        currentId = result.call.id;
        await connectMedia(currentId);
        console.log("Command 1 received; outgoing test call started.");
        break;
      }
    }
    if (seenCommands.size > 1000) { const keep = [...seenCommands].slice(-100); seenCommands.clear(); keep.forEach(id => seenCommands.add(id)); }
  }
  console.log("READY: Звонок @call_test. Auto-answer: about 4 seconds. Send 1 for an incoming call. Audible synthetic speech with pauses (chime fallback); no microphone or recording.");
  while (!stopped) {
    try {
      const holder = await redis.get(lockKey);
      if (holder !== sessionId) {
        if (holder || await redis.set(lockKey, sessionId, "EX", 90, "NX") !== "OK") { stopped = true; break; }
        await restoreTestSession();
        console.log("Local Redis state recovered; test helper resumed.");
      }
      if (await redis.get(lockKey + ":stop") === sessionId) { stopped = true; break; }
      await redis.expire(lockKey, 90);
      await redis.expire(`session:${sessionId}`, 7200);
      const { current: call } = await api();
      if (currentId && (!call || call.id !== currentId || !call.onThisSession)) await disconnect();
      if (!call || call.status === "ended") { if (currentId) await disconnect(); }
      else if (call.kind === "direct" && call.incoming && !currentId) {
        await delay(Math.max(0, call.createdAt + 4000 - Date.now()));
        const latest = (await api()).current;
        if (!stopped && latest?.id === call.id && latest.incoming) {
          await api({ action: "join", id: call.id });
          currentId = call.id;
          await connectMedia(call.id);
          heartbeatAt = Date.now(); console.log("Call accepted; test media connected.");
        }
      } else if (currentId && call.id === currentId && Date.now() - heartbeatAt > 15000) {
        await api({ action: "heartbeat", id: currentId }); heartbeatAt = Date.now();
      }
      await checkCommands(Boolean(call || currentId));
      failures = 0;
    } catch (error) {
      if (++failures === 1) console.error(error.message);
      // A dev-server rebuild must not stop the receiver or cut a healthy media connection.
      if (currentId && !mediaReady) { await api({ action: "leave", id: currentId }).catch(() => {}); await disconnect(); }
    }
    await delay(failures ? Math.min(10000, failures * 1000) : 1000);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  if (currentId) await api({ action: "leave", id: currentId }).catch(() => {});
  await disconnect(); await browser?.close();
  await redis.del(`session:${sessionId}`).catch(() => {});
  if (user) await redis.srem(`user:sessions:${user.id}`, sessionId).catch(() => {});
  if (lock) await redis.del(lockKey + ":stop").catch(() => {});
  if (lock) await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0", 1, lockKey, sessionId).catch(() => {});
  await redis.quit().catch(() => {}); await db.$disconnect();
}
