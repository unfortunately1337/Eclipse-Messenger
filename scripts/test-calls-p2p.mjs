// Synthetic browser transport test. No application accounts or real devices.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const relay = process.argv.includes('--relay');
const ice = process.env.P2P_TEST_ICE_JSON ? JSON.parse(await fs.readFile(process.env.P2P_TEST_ICE_JSON, 'utf8')) : [];
assert(!relay || ice.some(server => server.urls?.length), 'TURN-only requires P2P_TEST_ICE_JSON with temporary relay credentials');
const executablePath = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const server = await createServer({ configFile: false, root: path.join(root, 'scripts/calls-p2p'), resolve: { alias: { '@': root } },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] }, watch: null }, esbuild: { jsx: 'automatic' } });
await server.listen();
let browser;
const pages = [], errors = [], queues = [[], []], ready = [false, false], sequences = [0, 0];
const output = path.join(root, '.cache/p2p-verification');
await fs.mkdir(output, { recursive: true });

async function mediaStats(page) {
  return page.evaluate(async () => {
    const stats = await window.peer.pc.getStats();
    return { diagnostics: window.peer.diagnostics(), signaling: window.peer.pc.signalingState,
      outbound: [...stats.values()].filter(s => s.type === 'outbound-rtp').map(s => ({ kind: s.kind, frames: s.framesEncoded, width: s.frameWidth, height: s.frameHeight, bytes: s.bytesSent })),
      inbound: [...stats.values()].filter(s => s.type === 'inbound-rtp').map(s => ({ kind: s.kind, frames: s.framesDecoded, bytes: s.bytesReceived })),
      codecs: [...stats.values()].filter(s => s.type === 'codec').map(s => s.mimeType) };
  });
}
async function waitVideo(page, count) {
  await until(async () => (await mediaStats(page)).inbound.filter(s => s.kind === 'video' && s.frames >= 3).length >= count);
}
async function until(check, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (!await check()) {
    assert(Date.now() < deadline, 'Timed out waiting for media packets');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
try {
  browser = await chromium.launch({ executablePath, headless: true, args: ['--use-fake-device-for-media-stream=fps=30',
    '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  for (let i = 0; i < 2; i++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); pages.push(page);
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('sendSignal', async message => {
      const other = 1 - i; message.sequence = ++sequences[other];
      if (!ready[other]) queues[other].push(message);
      // Trickle ICE can arrive before SDP; exercise that race deliberately.
      else setTimeout(() => void pages[other].evaluate(m => window.receive?.(m), message).catch(error => errors.push(error.message)), Math.floor(Math.random() * 15));
    });
    await page.exposeFunction('markReady', async () => {
      ready[i] = true;
      for (const message of queues[i].splice(0)) void page.evaluate(m => window.receive?.(m), message).catch(error => errors.push(error.message));
    });
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
    await page.waitForFunction(() => window.available);
  }
  const callId = crypto.randomUUID();
  const configs = [0, 1].map(i => ({ transport: 'p2p', callId, clientId: crypto.randomUUID(), selfId: i ? 'bob' : 'alice', peerId: i ? 'alice' : 'bob',
    identity: i ? 'bob' : 'alice', peerIdentity: i ? 'alice' : 'bob', polite: Boolean(i), iceServers: ice,
    iceTransportPolicy: relay ? 'relay' : 'all', turnExpiresAt: Date.now() + 1800_000, relayConfigured: ice.length > 0 }));
  await Promise.all(pages.map((page, i) => page.evaluate(config => window.boot(config), configs[i])));
  await Promise.all(pages.map(page => page.waitForFunction(() => window.peer?.state === 'connected', null, { timeout: 25_000 })));
  await Promise.all(pages.map(page => page.evaluate(() => window.peer.localParticipant.setCameraEnabled(true))));
  await Promise.all(pages.map(page => waitVideo(page, 1)));
  await pages[0].evaluate(() => window.peer.localParticipant.setScreenShareEnabled(true));
  await waitVideo(pages[1], 2);
  await until(async () => (await mediaStats(pages[1])).inbound.filter(s => s.kind === 'audio' && s.bytes > 100).length === 2);
  await until(async () => (await mediaStats(pages[0])).outbound.filter(s => s.kind === 'video' && s.frames > 0).length === 2);
  await Promise.all(pages.map(page => page.evaluate(() => window.peer.readStats())));
  const tracks = await Promise.all(pages.map(mediaStats));
  await fs.writeFile(path.join(output, 'last-media.json'), JSON.stringify(tracks, null, 2));
  for (const stats of tracks) {
    assert(stats.inbound.some(s => s.kind === 'audio' && s.bytes > 0));
    assert(stats.codecs.includes('audio/opus'));
    if (relay) assert.equal(stats.diagnostics.candidateType, 'relay');
  }
  assert.equal(tracks[0].outbound.filter(s => s.kind === 'video' && s.frames > 0).length, 2);
  console.log('PASS Opus, two cameras, simultaneous screen and screen audio; TURN-only:', relay);

  await pages[0].evaluate(() => window.peer.requestRestart());
  await pages[0].waitForFunction(() => window.peer.state === 'connected', null, { timeout: 20_000 });
  console.log('PASS recovery status returns to connected');

  const rounds = await Promise.all(pages.map(page => page.evaluate(() => window.peer.localRound)));
  await pages[0].evaluate(() => window.peer.localParticipant.setMicrophoneEnabled(false));
  await Promise.all(pages.map(page => page.evaluate(() => window.peer.restart())));
  await Promise.all(pages.map((page, i) => page.waitForFunction(round => window.peer.localRound !== round && window.peer.pc.signalingState === 'stable'
    && window.peer.pc.connectionState === 'connected', rounds[i], { timeout: 25_000 })));
  await pages[0].evaluate(() => window.peer.localParticipant.setMicrophoneEnabled(true));
  await pages[1].waitForFunction(() => [...window.peer.remoteParticipants.values()][0]?.isMicrophoneEnabled);
  await pages[0].evaluate(() => window.peer.localParticipant.setScreenShareEnabled(false));
  await pages[1].waitForFunction(() => ![...window.peer.remoteParticipants.values()][0]?.isScreenShareEnabled);
  await Promise.all(pages.map(page => waitVideo(page, 1)));
  console.log('PASS simultaneous ICE restart, mute/unmute and independent screen stop');

  // A peer page reload has a new signaling epoch and must recover without stale SDP.
  ready[1] = false;
  await pages[1].evaluate(() => window.peer.disconnect());
  await pages[1].reload(); await pages[1].waitForFunction(() => window.available);
  await pages[1].evaluate(config => window.boot(config), configs[1]);
  await Promise.all(pages.map(page => page.waitForFunction(() => window.peer?.pc.connectionState === 'connected', null, { timeout: 25_000 })));
  await pages[1].evaluate(() => window.peer.localParticipant.setCameraEnabled(true));
  await Promise.all(pages.map(page => waitVideo(page, 1)));
  console.log('PASS peer page reload and new signaling epoch');

  await Promise.all(pages.map(page => page.evaluate(() => window.peer.disconnect())));
  const stopped = await Promise.all(pages.map(page => page.evaluate(() => ({ state: window.peer.state, ready: window.peer.ready, tracks: window.peer.localTracks.size }))));
  assert(stopped.every(s => s.state === 'disconnected' && !s.ready && !s.tracks));
  assert.equal(errors.length, 0, errors.join('\n'));
  await fs.writeFile(path.join(output, relay ? 'relay.json' : 'direct.json'), JSON.stringify({ tracks, stopped }, null, 2));
  console.log('PASS capture cleanup, no browser errors');
} catch (error) {
  const debug = await Promise.all(pages.map(page => page.evaluate(async () => {
    if (!window.peer?.pc) return {};
    return { state: window.peer.state, ice: window.peer.pc.iceConnectionState, signaling: window.peer.pc.signalingState, stops: window.stops,
      local: [...window.peer.localTracks].map(([source, track]) => ({ source, id: track.mediaStreamTrack.id, state: track.mediaStreamTrack.readyState, settings: track.mediaStreamTrack.getSettings() })),
      transceivers: window.peer.pc.getTransceivers().map(t => ({ mid: t.mid, direction: t.currentDirection, track: t.sender.track?.id, parameters: t.sender.getParameters() })),
      stats: [...(await window.peer.pc.getStats()).values()] };
  }).catch(() => ({}))));
  await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), debug }, null, 2));
  throw error;
} finally {
  await browser?.close(); await server.close();
}
