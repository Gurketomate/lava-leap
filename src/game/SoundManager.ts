/**
 * SoundManager – Web Audio API, iPad-compatible.
 * Channels: Music (30-40%), Lava (15-20%), SFX (25-50%).
 * Features: ducking, SFX limiter (max 4), seamless loops, lava proximity.
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

let lavaSource: AudioBufferSourceNode | null = null;
let lavaBuffer: AudioBuffer | null = null;
let lavaPlaying = false;

let activeSfxCount = 0;
const MAX_CONCURRENT_SFX = 4;

let duckTimeout: ReturnType<typeof setTimeout> | null = null;
const DUCK_AMOUNT = 0.85; // reduce music to 85% (10-15% duck)
const DUCK_DURATION = 200; // ms
let baseMusicVol = 0.35;
let baseSfxVol = 0.5;
let baseLavaVol = 0.17;

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
    lavaGain.gain.value = 0;
    lavaGain.connect(masterGain);

    musicBuffer = generateCaveAmbience();
    lavaBuffer = generateLavaLoop();
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
  musicGain.gain.linearRampToValueAtTime(baseMusicVol * DUCK_AMOUNT, now + 0.015);

  if (duckTimeout) clearTimeout(duckTimeout);
  duckTimeout = setTimeout(() => {
    if (!musicGain || !ctx) return;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(baseMusicVol, t + 0.08);
  }, DUCK_DURATION);
};

// ─── Core tone player ───

const playTone = (
  freq: number, duration: number, type: OscillatorType = 'sine',
  volume = 0.3, pitchDecay = 0, delayTime = 0
) => {
  const c = ensureContext();
  if (c.state === 'suspended' || activeSfxCount >= MAX_CONCURRENT_SFX) return;
  activeSfxCount++;
  duckMusic();

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  const startTime = c.currentTime + delayTime;
  osc.frequency.setValueAtTime(freq, startTime);
  if (pitchDecay) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, freq + pitchDecay), startTime + duration
    );
  }
  // Smooth envelope: attack 5ms, sustain, release
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.005);
  gain.gain.setValueAtTime(volume, startTime + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(sfxGain!);
  osc.start(startTime);
  osc.stop(startTime + duration);
  osc.onended = () => { activeSfxCount = Math.max(0, activeSfxCount - 1); };
};

// ─── Event Sounds ───

let lastJumpTime = 0;
let lastCoinTime = 0;
let lastLavaWarnTime = 0;

/** Soft plop/tap jump sound with ±5% random pitch */
export const playJump = (velocityRatio = 0.5) => {
  const now = performance.now();
  if (now - lastJumpTime < 80) return;
  lastJumpTime = now;

  const pitchVar = 0.95 + Math.random() * 0.1; // ±5%
  const baseFreq = (220 + velocityRatio * 80) * pitchVar;
  // Soft sine "plop" — short, gentle, 25-35% vol
  playTone(baseFreq, 0.1, 'sine', 0.10, 120);
  // Tiny harmonic tap
  playTone(baseFreq * 2.5, 0.04, 'sine', 0.04, 0, 0.01);
};

/** Coin pickup — bright bling, 40-50% */
export const playCoin = () => {
  const now = performance.now();
  if (now - lastCoinTime < 50) return;
  lastCoinTime = now;
  const pitchVar = 0.97 + Math.random() * 0.06;
  playTone(1100 * pitchVar, 0.07, 'sine', 0.18);
  playTone(1500 * pitchVar, 0.10, 'sine', 0.12, 0, 0.05);
};

/** Death — low rumble */
export const playDeath = () => {
  playTone(180, 0.5, 'sawtooth', 0.20, -140);
  playTone(100, 0.7, 'sine', 0.15, -60, 0.08);
};

/** Power-up — rising arpeggio, 40-50% */
export const playPowerUp = () => {
  playTone(400, 0.12, 'sine', 0.16);
  playTone(550, 0.12, 'sine', 0.16, 0, 0.08);
  playTone(700, 0.12, 'sine', 0.16, 0, 0.16);
  playTone(900, 0.20, 'sine', 0.12, 150, 0.24);
};

/** Level complete — victory fanfare */
export const playLevelComplete = () => {
  playTone(523, 0.18, 'sine', 0.18);
  playTone(659, 0.18, 'sine', 0.18, 0, 0.12);
  playTone(784, 0.18, 'sine', 0.18, 0, 0.24);
  playTone(1047, 0.35, 'sine', 0.20, 0, 0.36);
};

/** Button click — very short, 20-30% */
export const playButtonClick = () => {
  playTone(700, 0.035, 'sine', 0.07);
  playTone(500, 0.025, 'sine', 0.04, 0, 0.015);
};

/** Lava warning beep when proximity > 0.7 */
export const playLavaWarning = () => {
  const now = performance.now();
  if (now - lastLavaWarnTime < 2500) return;
  lastLavaWarnTime = now;
  playTone(160, 0.25, 'sine', 0.10, -40);
};

// ─── Lava Proximity (own channel, 15-20%) ───

export const updateLavaProximity = (proximity: number) => {
  if (!lavaGain || !ctx) return;
  const vol = proximity > 0.08
    ? baseLavaVol * Math.pow(Math.min(1, (proximity - 0.08) / 0.92), 1.5)
    : 0;
  lavaGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.15);
  if (proximity > 0.7) playLavaWarning();
};

function generateLavaLoop(): AudioBuffer {
  const c = ensureContext();
  const sampleRate = Math.max(44100, c.sampleRate);
  const duration = 6;
  const length = sampleRate * duration;
  const buffer = c.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Exact-cycle freqs for seamless loop
  const rumbleF = Math.round(35 * duration) / duration;
  const bubbleRate = Math.round(4 * duration) / duration;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Gentle deep rumble
    const rumble = Math.sin(t * 2 * Math.PI * rumbleF) * 0.10 +
                   Math.sin(t * 2 * Math.PI * rumbleF * 1.5) * 0.04;
    // Soft bubbling: amplitude-modulated with slow envelope
    const bubbleEnv = Math.pow(Math.sin(t * 2 * Math.PI * bubbleRate) * 0.5 + 0.5, 2);
    const bubble = (Math.random() * 2 - 1) * 0.02 * bubbleEnv;
    // Slow swell for variation
    const swell = Math.sin(t * 2 * Math.PI * 0.25) * 0.015;

    left[i] = (rumble + bubble + swell) * 0.8;
    right[i] = (rumble + bubble * 0.7 + swell * 1.2) * 0.8;
  }

  // Crossfade for seamless loop
  const cf = 2048;
  for (let i = 0; i < cf; i++) {
    const f = i / cf;
    left[length - cf + i] = left[length - cf + i] * (1 - f) + left[i] * f;
    right[length - cf + i] = right[length - cf + i] * (1 - f) + right[i] * f;
  }
  return buffer;
}

export const startLavaSound = () => {
  const c = ensureContext();
  if (lavaPlaying || !lavaBuffer || c.state === 'suspended') return;
  lavaSource = c.createBufferSource();
  lavaSource.buffer = lavaBuffer;
  lavaSource.loop = true;
  lavaSource.connect(lavaGain!);
  lavaSource.start();
  lavaPlaying = true;
};

export const stopLavaSound = () => {
  if (lavaSource && lavaPlaying) {
    if (lavaGain && ctx) lavaGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => {
      try { lavaSource?.stop(); } catch { /* */ }
      lavaSource = null;
      lavaPlaying = false;
    }, 120);
  }
};

// ─── Background Music (Cave Ambience — clean, musical, no noise) ───

function generateCaveAmbience(): AudioBuffer {
  const c = ensureContext();
  const sampleRate = Math.max(44100, c.sampleRate);
  const duration = 10; // longer loop for more variation
  const length = sampleRate * duration;
  const buffer = c.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Exact-cycle frequencies
  const f1 = Math.round(55 * duration) / duration;
  const f2 = Math.round(82.41 * duration) / duration; // E2
  const f3 = Math.round(110 * duration) / duration;   // A2
  const f4 = Math.round(130.81 * duration) / duration; // C3
  const modF = Math.round(0.4 * duration) / duration;
  const swellF = Math.round(0.15 * duration) / duration;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    // Rich warm drone — layered sine harmonics, no noise
    const drone = Math.sin(t * 2 * Math.PI * f1) * 0.10 +
                  Math.sin(t * 2 * Math.PI * f2) * 0.06 +
                  Math.sin(t * 2 * Math.PI * f1 * 2) * 0.02; // octave harmonic

    // Evolving pad with gentle FM modulation
    const mod = Math.sin(t * 2 * Math.PI * modF) * 1.5;
    const pad = Math.sin(t * 2 * Math.PI * f3 + mod) * 0.04 *
                (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * swellF));

    // High ethereal tone (very subtle)
    const highF = Math.round(220 * duration) / duration;
    const ethMod = Math.sin(t * 2 * Math.PI * 0.2) * 0.3;
    const ethereal = Math.sin(t * 2 * Math.PI * highF + ethMod) * 0.012 *
                     (0.3 + 0.7 * Math.pow(Math.sin(t * 2 * Math.PI * swellF * 0.7), 2));

    // Gentle water drip (clean sine ping, no noise)
    const dripPeriod = 4.0;
    const dripPhase = t % dripPeriod;
    const dripAttack = Math.min(1, dripPhase * 500); // 2ms attack
    const dripDecay = Math.max(0, 1 - dripPhase * 12);
    const drip = Math.sin(t * 2 * Math.PI * 1800 * Math.exp(-dripPhase * 10))
                 * 0.015 * dripAttack * dripDecay;

    const dripPeriod2 = 6.3;
    const dripPhase2 = t % dripPeriod2;
    const dripAttack2 = Math.min(1, dripPhase2 * 500);
    const dripDecay2 = Math.max(0, 1 - dripPhase2 * 8);
    const drip2 = Math.sin(t * 2 * Math.PI * 1400 * Math.exp(-dripPhase2 * 7))
                  * 0.010 * dripAttack2 * dripDecay2;

    // Stereo width via subtle phase offset
    left[i] = drone + pad + ethereal + drip;
    right[i] = drone + pad * 0.85 + ethereal * 1.1 + drip2;
  }

  // Crossfade for seamless loop
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

  // Fade in over 0.8s
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
      musicGain.gain.linearRampToValueAtTime(0, now + 0.4); // 400ms fade out
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

export const setMusicVolume = (v: number) => {
  baseMusicVol = v;
  if (musicGain) musicGain.gain.value = v;
};

export const setSfxVolume = (v: number) => {
  baseSfxVol = v;
  if (sfxGain) sfxGain.gain.value = v;
};

export const setLavaVolume = (v: number) => {
  baseLavaVol = v;
};
