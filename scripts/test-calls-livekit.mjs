// Explicit, short Cloud integration test. Uses synthetic devices, not real users.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const url = process.env.LIVEKIT_URL?.trim();
const key = process.env.LIVEKIT_API_KEY?.trim();
const secret = process.env.LIVEKIT_API_SECRET?.trim();
if (!url || !key || !secret) throw new Error("Configure LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET first.");
const endpoint = new URL(url);
assert.equal(endpoint.protocol, "wss:");
const client = new RoomServiceClient(endpoint.origin.replace("wss:", "https:"), key, secret, { requestTimeout: 12 });
const roomName = `eclipse-smoke-${randomUUID()}`;
const gate = randomUUID();
const sdk = readFileSync(require.resolve("livekit-client"));
const tokens = {};
for (const identity of ["synthetic-a", "synthetic-b"]) {
  const access = new AccessToken(key, secret, { identity, ttl: "60s" });
  access.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false,
    canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] });
  tokens[identity] = await access.toJwt();
}
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === `/${gate}/sdk.js`) { response.setHeader("Content-Type", "text/javascript"); response.end(sdk); return; }
  const identity = request.url === `/${gate}/a` ? "synthetic-a" : request.url === `/${gate}/b` ? "synthetic-b" : null;
  if (!identity) { response.writeHead(404).end(); return; }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html><body><script src="/${gate}/sdk.js"></script><script>
    window.testState = { ready: false, error: false };
    const options = { adaptiveStream: true, dynacast: true };
    window.room = new LivekitClient.Room(options);
    const url = ${JSON.stringify(endpoint.origin)};
    const token = ${JSON.stringify(tokens[identity])};
    room.on(LivekitClient.RoomEvent.TrackSubscribed, track => {
      const element = track.attach();
      element.autoplay = true;
      if (element instanceof HTMLVideoElement) { element.playsInline = true; element.style.width = '320px'; element.style.height = '180px'; }
      document.body.appendChild(element);
    });
    window.retryRevokedToken = async () => {
      const retry = new LivekitClient.Room();
      try { await retry.connect(url, token); await retry.disconnect(); return false; }
      catch { return true; }
    };
    (async () => {
      try {
        await room.connect(url, token);
        await room.startAudio();
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);
        testState.ready = true;
      } catch { testState.error = true; }
    })();
  </script></body></html>`);
});
let browser;
let created = false;
let step = "create temporary room";
try {
  await client.createRoom({ name: roomName, maxParticipants: 2, emptyTimeout: 30, departureTimeout: 10 });
  created = true;
  console.log("Temporary Cloud room created.");
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}/${gate}`;
  const candidates = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
  const executablePath = candidates.find(existsSync);
  if (!executablePath) throw new Error("Set CHROME_PATH to an installed Chrome executable.");
  step = "launch synthetic browser participants";
  browser = await chromium.launch({ executablePath, headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required", "--enable-usermedia-screen-capturing", "--auto-select-desktop-capture-source=Entire screen"] });
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  await Promise.all(pages.map((page, index) => page.goto(`${base}/${index ? "b" : "a"}`)));
  step = "connect and publish audio/video";
  await Promise.all(pages.map(page => page.waitForFunction(() => testState.ready || testState.error, null, { timeout: 40_000 })));
  for (const page of pages) assert.equal(await page.evaluate(() => testState.error), false, "Participant connection failed");
  console.log("Two isolated participants connected and published synthetic microphone and camera.");
  step = "verify received media";
  await Promise.all(pages.map(page => page.waitForFunction(() => {
    const peer = [...room.remoteParticipants.values()][0];
    return peer && [...peer.trackPublications.values()].filter(publication => publication.isSubscribed).length >= 2;
  }, null, { timeout: 25_000 })));
  await Promise.all(pages.map(page => page.waitForFunction(async () => {
    let bytes = 0;
    for (const peer of room.remoteParticipants.values()) {
      for (const publication of peer.trackPublications.values()) {
        const receiver = publication.track?.receiver;
        if (!receiver) continue;
        const stats = await receiver.getStats();
        stats.forEach(report => { if (report.type === 'inbound-rtp') bytes += report.bytesReceived ?? 0; });
      }
    }
    return bytes > 1000;
  }, null, { timeout: 25_000 })));
  console.log("Both participants receive actual WebRTC media bytes.");
  step = "disable and re-enable camera during an audio call";
  await pages[0].evaluate(() => room.localParticipant.setCameraEnabled(false));
  await pages[1].waitForFunction(() => [...room.remoteParticipants.values()][0]?.getTrackPublication(LivekitClient.Track.Source.Camera)?.isMuted, null, { timeout: 10_000 });
  await pages[0].evaluate(() => room.localParticipant.setCameraEnabled(true));
  await pages[1].waitForFunction(async () => {
    const publication = [...room.remoteParticipants.values()][0]?.getTrackPublication(LivekitClient.Track.Source.Camera);
    if (!publication?.track?.receiver || publication.isMuted) return false;
    const stats = await publication.track.receiver.getStats();
    return [...stats.values()].some(report => report.type === "inbound-rtp" && report.framesDecoded > 2);
  }, null, { timeout: 15_000 });
  console.log("Camera disable and re-enable propagate without ending the call.");
  step = "share a synthetic screen while keeping the camera";
  await pages[0].evaluate(() => room.localParticipant.setScreenShareEnabled(true, {
    audio: true, contentHint: "detail", selfBrowserSurface: "exclude", surfaceSwitching: "include",
  }, { screenShareEncoding: { maxBitrate: 3_000_000, maxFramerate: 15 } }));
  await pages[1].waitForFunction(async () => {
    const peer = [...room.remoteParticipants.values()][0];
    const screen = peer?.getTrackPublication(LivekitClient.Track.Source.ScreenShare)?.track;
    const camera = peer?.getTrackPublication(LivekitClient.Track.Source.Camera)?.track;
    if (!screen?.receiver || !camera) return false;
    const stats = await screen.receiver.getStats();
    return [...stats.values()].some(report => report.type === "inbound-rtp" && report.framesDecoded > 2);
  }, null, { timeout: 25_000 });
  console.log("Screen frames received while camera and microphone remain published.");
  step = "stop screen from browser capture controls";
  // Ending the capture track follows the same SDK path as the browser Stop sharing control.
  await pages[0].evaluate(() => {
    const track = room.localParticipant.getTrackPublication(LivekitClient.Track.Source.ScreenShare).track;
    track.mediaStreamTrack.stop();
    track.mediaStreamTrack.dispatchEvent(new Event("ended"));
  });
  await pages[1].waitForFunction(() => ![...room.remoteParticipants.values()][0]?.getTrackPublication(LivekitClient.Track.Source.ScreenShare), null, { timeout: 10_000 });
  assert.equal(await pages[0].evaluate(() => room.localParticipant.isScreenShareEnabled), false);
  step = "restart and explicitly stop screen sharing";
  await pages[0].evaluate(() => room.localParticipant.setScreenShareEnabled(true, { audio: true }));
  await pages[1].waitForFunction(() => [...room.remoteParticipants.values()][0]?.getTrackPublication(LivekitClient.Track.Source.ScreenShare)?.track, null, { timeout: 15_000 });
  await pages[0].evaluate(() => room.localParticipant.setScreenShareEnabled(false));
  await pages[1].waitForFunction(() => ![...room.remoteParticipants.values()][0]?.getTrackPublication(LivekitClient.Track.Source.ScreenShare), null, { timeout: 10_000 });
  assert.equal(await pages[0].evaluate(() => room.localParticipant.isCameraEnabled && room.localParticipant.isMicrophoneEnabled), true);
  console.log("Screen sharing can stop via browser controls, restart and stop without ending the call.");
  step = "mute propagation";
  await pages[0].evaluate(() => room.localParticipant.setMicrophoneEnabled(false));
  await pages[1].waitForFunction(() => [...room.remoteParticipants.values()][0]?.getTrackPublication(LivekitClient.Track.Source.Microphone)?.isMuted, null, { timeout: 10_000 });
  await pages[0].evaluate(() => room.localParticipant.setMicrophoneEnabled(true));
  console.log("Microphone mute reaches the other participant.");
  step = "revoke removed participant";
  await client.removeParticipant(roomName, "synthetic-b", { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 2) });
  await pages[1].waitForFunction(() => room.state === "disconnected", null, { timeout: 12_000 });
  assert.equal(await pages[1].evaluate(() => retryRevokedToken()), true, "Removed participant reused an old token");
  console.log("Cloud removal disconnects the participant and rejects their previous token.");
  console.log("PASS: Cloud media transport, publication, reception, mute and token revocation.");
} catch {
  console.error(`FAIL during: ${step}. Credentials and tokens have been withheld.`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  if (server.listening) await new Promise(resolve => server.close(resolve));
  if (created) {
    try { await client.deleteRoom(roomName); console.log("Temporary room deleted."); }
    catch { console.error("Temporary room cleanup failed; check Cloud rooms for an eclipse-smoke room."); process.exitCode = 1; }
  }
}
