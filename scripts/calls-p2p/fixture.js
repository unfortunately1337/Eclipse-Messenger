import { P2PCallSession } from '@/lib/client/call-p2p-session';
const w = window;
w.stops = [];
const nativeStop = MediaStreamTrack.prototype.stop;
MediaStreamTrack.prototype.stop = function () {
    w.stops.push({ id: this.id, stack: new Error().stack });
    return nativeStop.call(this);
};
w.boot = async (config) => {
    const epoch = crypto.randomUUID();
    const signaling = {
        send: (payload) => w.sendSignal({ id: crypto.randomUUID(), clientId: config.clientId, epoch, fromUserId: config.selfId, payload, sentAt: Date.now() }),
        refresh: async () => ({ ...config, turnExpiresAt: Date.now() + 1800000 }),
        start(receive) { w.receive = receive; void w.markReady(); }, close() { w.receive = null; },
    };
    const session = new P2PCallSession(signaling);
    w.peer = session;
    const attached = new Map();
    session.on('update', () => {
        for (const person of session.remoteParticipants.values()) {
            for (const source of ['microphone', 'camera', 'screen_share', 'screen_share_audio']) {
                const track = person.getTrackPublication(source)?.track;
                if (track && !attached.has(track)) {
                    const el = track.attach();
                    el.style.width = '320px';
                    el.dataset.source = source;
                    document.querySelector('#media').append(el);
                    attached.set(track, el);
                }
            }
        }
    });
    session.on('reconnecting', () => w.recoveries = (w.recoveries || 0) + 1);
    await session.connect(config);
    await session.localParticipant.setMicrophoneEnabled(true);
    await session.startAudio();
    w.captureScreen = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        let active = true;
        const draw = () => { if (!active)
            return; ctx.fillStyle = '#303846'; ctx.fillRect(0, 0, 1920, 1080); ctx.fillStyle = 'white'; ctx.font = '42px Arial'; ctx.fillText('Eclipse screen clarity test ' + Math.floor(performance.now()), 80, 120); requestAnimationFrame(draw); };
        draw();
        const stream = canvas.captureStream(45);
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const destination = audio.createMediaStreamDestination();
        oscillator.frequency.value = 440;
        gain.gain.value = 0.05;
        oscillator.connect(gain); gain.connect(destination); oscillator.start();
        await audio.resume();
        stream.addTrack(destination.stream.getAudioTracks()[0]);
        stream.getVideoTracks()[0].addEventListener('ended', () => active = false);
        return stream;
    };
    navigator.mediaDevices.getDisplayMedia = () => w.captureScreen();
};
w.available = true;
