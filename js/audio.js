let ctx = null;
let master = null;
let enabled = true;
let noiseBuf = null;

export function initAudio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 1.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    return ctx;
}

export function resumeAudio() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setVolume(v) {
    if (master) master.gain.value = v;
}

export function setAudioEnabled(v) {
    enabled = v;
    if (master) master.gain.value = v ? 0.5 : 0;
}

function noise(dur, freq, q, gain, type = 'bandpass') {
    if (!ctx || !enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
}

function tone(freq, dur, gain, type = 'square', slide = 0) {
    if (!ctx || !enabled) return;
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
}

export const sfx = {
    dig(block) {
        const wood = block.group === 'wood';
        noise(wood ? 0.14 : 0.11, wood ? 900 : 1700, wood ? 1.2 : 2.4, 0.28);
    },
    place(block) {
        const wood = block.group === 'wood';
        noise(0.1, wood ? 700 : 1400, wood ? 1 : 2, 0.3);
        tone(wood ? 200 : 320, 0.06, 0.06, 'triangle');
    },
    break(block) {
        const wood = block.group === 'wood';
        noise(0.24, wood ? 600 : 1200, wood ? 0.9 : 1.6, 0.34);
        if (wood) tone(160, 0.16, 0.08, 'sawtooth', -60);
    },
    step(block) {
        if (!block) return;
        const wood = block.group === 'wood';
        noise(0.07, wood ? 700 : 1500, wood ? 1 : 2.2, 0.14);
    },
    splash() {
        noise(0.4, 1200, 0.7, 0.3, 'lowpass');
    },
    pop() {
        tone(880, 0.07, 0.1, 'square', 400);
    },
    click() {
        tone(1200, 0.03, 0.05, 'square');
    },
    hurt() {
        tone(220, 0.2, 0.12, 'sawtooth', -120);
    },
};
