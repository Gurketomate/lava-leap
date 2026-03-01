/**
 * SoundManager – Web Audio API, iPad-compatible.
 * Channels: Music (30-40%), Lava (10-15% bursts), SFX (25-50%).
 * No constant drones on lava — random bubble bursts instead.
 */

let ctx: AudioContext | null = null;
let unlocked = false;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let lavaGain: GainNode | null = null;

let musicSource: AudioBufferSourceNode | null = null;
let musicBuffer: AudioBuffer | null = null;
let musicPlaying = false;

// Lava: no looping drone — instead, random bubble bursts
let lavaActive = false;
let lavaBubbleTimer: ReturnType<typeof setTimeout> | null = null;

let activeSfxCount = 0;
const MAX_CONCURRENT_SFX = 4;

let duckTimeout: ReturnType<typeof setTimeout> | null = null;
let baseMusicVol = 0.35;
let baseSfxVol = 0.5;
let baseLavaVol = 0.12;
let currentLavaProximity = 0;

const ensureContext = (): AudioContext => {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = baseMusicVol;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = baseSfxVol;
    sfxGain.connect(masterGain);

    lavaGain = ctx.createGain();
    lavaGain.gain.value = baseLavaVol;
    lavaGain.connect(masterGain);

    musicBuffer = generateCaveAmbience();
  }
  return ctx;
};

export const unlockAudio = () => {
  const c = ensureContext();
  if (unlocked) return;
  if (c.state === 'suspended') c.resume();
  const buf = c.createBuffer(1, 1, 44100);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
  unlocked = true;
};

// ─── Ducking ───

const duckMusic = () => {
  if (!musicGain || !musicPlaying) return;
  const c = ensureContext();
  const now = c.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(baseMusicVol * 0.85, now + 0.015);
  if (duckTimeout) clearTimeout(duckTimeout);
  duckTimeout = setTimeout(() => {
    if (!musicGain || !ctx) return;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(baseMusicVol, t + 0.08);
  }, 200);
};

// ─── Core tone player with smooth envelope ───

const playTone = (
  freq: number, duration: number, type: OscillatorType = 'sine',
  volume = 0.3, pitchEnd = 0, delayTime = 0, dest?: GainNode
) => {
  const c = ensureContext();
  if (c.state === 'suspended' || activeSfxCount >= MAX_CONCURRENT_SFX) return;
  activeSfxCount++;
  if (dest !== lavaGain) duckMusic();

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  const t0 = c.currentTime + delayTime;
  osc.frequency.setValueAtTime(freq, t0);
  if (pitchEnd) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + pitchEnd), t0 + duration);
  }
  // Smooth attack/release — no clicks
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.003);
  gain.gain.setValueAtTime(volume, t0 + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.connect(gain);
  gain.connect(dest || sfxGain!);
  osc.start(t0);
  osc.stop(t0 + duration);
  osc.onended = () => { activeSfxCount = Math.max(0, activeSfxCount - 1); };
};

// ─── Event Sounds ───

let lastJumpTime = 0;
let lastCoinTime = 0;

/** Soft plop jump — gentle, short, ±5% pitch variation, 25% vol */
export const playJump = (velocityRatio = 0.5) => {
  const now = performance.now();
  if (now - lastJumpTime < 80) return;
  lastJumpTime = now;
  const pv = 0.95 + Math.random() * 0.1;
  const f = (200 + velocityRatio * 60) * pv;
  // Single soft sine tap
  playTone(f, 0.08, 'sine', 0.08, 80);
};

/** Coin — crisp bright bling, 40-50% effective vol, no dull frequencies */
export const playCoin = () => {
  const now = performance.now();
  if (now - lastCoinTime < 50) return;
  lastCoinTime = now;
  const pv = 0.97 + Math.random() * 0.06;
  // High, crisp sine pair
  playTone(1300 * pv, 0.06, 'sine', 0.22);
  playTone(1800 * pv, 0.09, 'sine', 0.16, 0, 0.04);
};

/** Death */
export const playDeath = () => {
  playTone(160, 0.5, 'sawtooth', 0.18, -120);
  playTone(90, 0.6, 'sine', 0.12, -50, 0.06);
};

/** Power-up — rising arpeggio, 40-50% */
export const playPowerUp = () => {
  playTone(400, 0.10, 'sine', 0.16);
  playTone(550, 0.10, 'sine', 0.16, 0, 0.07);
  playTone(700, 0.10, 'sine', 0.16, 0, 0.14);
  playTone(900, 0.18, 'sine', 0.12, 120, 0.21);
};

/** Level complete */
export const playLevelComplete = () => {
  playTone(523, 0.16, 'sine', 0.18);
  playTone(659, 0.16, 'sine', 0.18, 0, 0.11);
  playTone(784, 0.16, 'sine', 0.18, 0, 0.22);
  playTone(1047, 0.30, 'sine', 0.20, 0, 0.33);
};

/** Button click — short, direct, 20-30% */
export const playButtonClick = () => {
  playTone(650, 0.03, 'sine', 0.08);
};

// ─── Lava: random bubble bursts (no constant drone) ───

let lastLavaWarnTime = 0;

const playLavaBubble = () => {
  const c = ensureContext();
  if (c.state === 'suspended') return;
  // Short bubble pop: quick pitch-down sine
  const freq = 80 + Math.random() * 60;
  const dur = 0.06 + Math.random() * 0.08;
  const vol = (0.06 + Math.random() * 0.06) * currentLavaProximity;
  if (vol < 0.005) return;
  playTone(freq, dur, 'sine', vol, -40, 0, lavaGain!);
};

const scheduleLavaBubble = () => {
  if (!lavaActive) return;
  // Random interval: closer = more frequent (200-800ms far, 80-250ms close)
  const minInterval = 80 + (1 - currentLavaProximity) * 300;
  const maxInterval = 250 + (1 - currentLavaProximity) * 600;
  const interval = minInterval + Math.random() * (maxInterval - minInterval);
  lavaBubbleTimer = setTimeout(() => {
    if (!lavaActive) return;
    playLavaBubble();
    scheduleLavaBubble();
  }, interval);
};

export const updateLavaProximity = (proximity: number) => {
  currentLavaProximity = proximity;
  // Lava warning at high proximity
  if (proximity > 0.7) {
    const now = performance.now();
    if (now - lastLavaWarnTime > 2500) {
      lastLavaWarnTime = now;
      playTone(140, 0.2, 'sine', 0.08, -30);
    }
  }
};

export const startLavaSound = () => {
  if (lavaActive) return;
  lavaActive = true;
  scheduleLavaBubble();
};

export const stopLavaSound = () => {
  lavaActive = false;
  if (lavaBubbleTimer) { clearTimeout(lavaBubbleTimer); lavaBubbleTimer = null; }
};

// ─── Background Music ───

function generateCaveAmbience(): AudioBuffer {
  const c = ensureContext();
  const sampleRate = Math.max(44100, c.sampleRate);
  const duration = 10;
  const length = sampleRate * duration;
  const buffer = c.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const f1 = Math.round(55 * duration) / duration;
  const f2 = Math.round(82.41 * duration) / duration;
  const f3 = Math.round(110 * duration) / duration;
  const modF = Math.round(0.4 * duration) / duration;
  const swellF = Math.round(0.15 * duration) / duration;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const drone = Math.sin(t * 2 * Math.PI * f1) * 0.10 +
                  Math.sin(t * 2 * Math.PI * f2) * 0.06 +
                  Math.sin(t * 2 * Math.PI * f1 * 2) * 0.02;
    const mod = Math.sin(t * 2 * Math.PI * modF) * 1.5;
    const pad = Math.sin(t * 2 * Math.PI * f3 + mod) * 0.04 *
                (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * swellF));
    const highF = Math.round(220 * duration) / duration;
    const ethereal = Math.sin(t * 2 * Math.PI * highF + Math.sin(t * 2 * Math.PI * 0.2) * 0.3) * 0.012 *
                     (0.3 + 0.7 * Math.pow(Math.sin(t * 2 * Math.PI * swellF * 0.7), 2));
    const dp1 = t % 4.0;
    const drip = Math.sin(t * 2 * Math.PI * 1800 * Math.exp(-dp1 * 10)) * 0.015 *
                 Math.min(1, dp1 * 500) * Math.max(0, 1 - dp1 * 12);
    const dp2 = t % 6.3;
    const drip2 = Math.sin(t * 2 * Math.PI * 1400 * Math.exp(-dp2 * 7)) * 0.010 *
                  Math.min(1, dp2 * 500) * Math.max(0, 1 - dp2 * 8);

    left[i] = drone + pad + ethereal + drip;
    right[i] = drone + pad * 0.85 + ethereal * 1.1 + drip2;
  }
  const cf = 2048;
  for (let i = 0; i < cf; i++) {
    const f = i / cf;
    left[length - cf + i] = left[length - cf + i] * (1 - f) + left[i] * f;
    right[length - cf + i] = right[length - cf + i] * (1 - f) + right[i] * f;
  }
  return buffer;
}

export const startMusic = () => {
  const c = ensureContext();
  if (musicPlaying || !musicBuffer || c.state === 'suspended') return;
  musicSource = c.createBufferSource();
  musicSource.buffer = musicBuffer;
  musicSource.loop = true;
  musicSource.connect(musicGain!);
  musicGain!.gain.setValueAtTime(0, c.currentTime);
  musicGain!.gain.linearRampToValueAtTime(baseMusicVol, c.currentTime + 0.8);
  musicSource.start();
  musicPlaying = true;
};

export const stopMusic = () => {
  if (musicSource && musicPlaying) {
    if (musicGain && ctx) {
      const now = ctx.currentTime;
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(musicGain.gain.value, now);
      musicGain.gain.linearRampToValueAtTime(0, now + 0.4);
    }
    setTimeout(() => {
      try { musicSource?.stop(); } catch { /* */ }
      musicSource = null;
      musicPlaying = false;
      if (musicGain && ctx) musicGain.gain.setValueAtTime(baseMusicVol, ctx.currentTime);
    }, 450);
  }
};

export const pauseMusic = () => {
  if (musicGain && ctx) {
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(0, now + 0.3);
  }
};

export const resumeMusic = () => {
  if (musicGain && ctx) {
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(0, now);
    musicGain.gain.linearRampToValueAtTime(baseMusicVol, now + 0.3);
  }
};

export const setMusicVolume = (v: number) => { baseMusicVol = v; if (musicGain) musicGain.gain.value = v; };
export const setSfxVolume = (v: number) => { baseSfxVol = v; if (sfxGain) sfxGain.gain.value = v; };
export const setLavaVolume = (v: number) => { baseLavaVol = v; if (lavaGain) lavaGain.gain.value = v; };
