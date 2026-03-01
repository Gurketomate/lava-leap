/**
 * SoundManager – Web Audio API based, iPad-compatible.
 * Channels: Music (30-50%), SFX (50-70%), Lava (15-25%).
 * Features: ducking, SFX limiter (max 4), seamless loops, lava proximity sound.
 */

let ctx: AudioContext | null = null;
let unlocked = false;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let lavaGain: GainNode | null = null;

// Background music state
let musicSource: AudioBufferSourceNode | null = null;
let musicBuffer: AudioBuffer | null = null;
let musicPlaying = false;

// Lava ambient state
let lavaSource: AudioBufferSourceNode | null = null;
let lavaBuffer: AudioBuffer | null = null;
let lavaPlaying = false;
let lavaWarningOsc: OscillatorNode | null = null;
let lavaWarningGain: GainNode | null = null;

// SFX concurrency limiter
let activeSfxCount = 0;
const MAX_CONCURRENT_SFX = 4;

// Ducking state
let duckTimeout: ReturnType<typeof setTimeout> | null = null;
const DUCK_AMOUNT = 0.8;
const DUCK_DURATION = 300;
let baseMusicVol = 0.4;
let baseSfxVol = 0.6;
let baseLavaVol = 0.2;

const ensureContext = (): AudioContext => {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = baseSfxVol;
    sfxGain.connect(masterGain);

    musicGain = ctx.createGain();
    musicGain.gain.value = baseMusicVol;
    musicGain.connect(masterGain);

    lavaGain = ctx.createGain();
    lavaGain.gain.value = 0; // starts silent, driven by proximity
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
  const duckedVol = baseMusicVol * DUCK_AMOUNT;

  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(duckedVol, now + 0.02);

  if (duckTimeout) clearTimeout(duckTimeout);
  duckTimeout = setTimeout(() => {
    if (!musicGain || !ctx) return;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(baseMusicVol, t + 0.1);
  }, DUCK_DURATION);
};

// ─── Tone / Noise generators ───

const playTone = (
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
  pitchDecay = 0,
  delayTime = 0,
  targetGain?: GainNode
) => {
  const c = ensureContext();
  if (c.state === 'suspended') return;
  if (activeSfxCount >= MAX_CONCURRENT_SFX) return;

  activeSfxCount++;
  duckMusic();

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delayTime);
  if (pitchDecay) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, freq + pitchDecay),
      c.currentTime + delayTime + duration
    );
  }
  gain.gain.setValueAtTime(volume, c.currentTime + delayTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delayTime + duration);

  osc.connect(gain);
  gain.connect(targetGain || sfxGain!);
  osc.start(c.currentTime + delayTime);
  osc.stop(c.currentTime + delayTime + duration);
  osc.onended = () => { activeSfxCount = Math.max(0, activeSfxCount - 1); };
};

const playNoise = (duration: number, volume = 0.1) => {
  const c = ensureContext();
  if (c.state === 'suspended') return;
  if (activeSfxCount >= MAX_CONCURRENT_SFX) return;

  activeSfxCount++;
  duckMusic();

  const sampleRate = c.sampleRate;
  const bufferSize = sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  const fadeLen = Math.min(512, bufferSize / 4);
  for (let i = 0; i < fadeLen; i++) {
    const env = i / fadeLen;
    data[i] *= env;
    data[bufferSize - 1 - i] *= env;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.connect(gain);
  gain.connect(sfxGain!);
  src.start();
  src.onended = () => { activeSfxCount = Math.max(0, activeSfxCount - 1); };
};

// ─── Event Sounds ───

let lastJumpTime = 0;
let lastCoinTime = 0;
let lastLavaWarnTime = 0;

/**
 * Jump sound with optional pitch shift based on velocity.
 * @param velocityRatio 0..1 where 1 = max jump force (boost), affects pitch
 */
export const playJump = (velocityRatio = 0.5) => {
  const now = performance.now();
  if (now - lastJumpTime < 80) return;
  lastJumpTime = now;
  // Base freq 250-400 based on jump strength, duration 0.1-0.15s, volume 30-40%
  const baseFreq = 250 + velocityRatio * 150;
  playTone(baseFreq, 0.12, 'square', 0.12, 300);
  playTone(baseFreq + 200, 0.06, 'sine', 0.06, 0, 0.02);
};

export const playCoin = () => {
  const now = performance.now();
  if (now - lastCoinTime < 50) return;
  lastCoinTime = now;
  playTone(1200, 0.08, 'sine', 0.2);
  playTone(1600, 0.12, 'sine', 0.15, 0, 0.06);
};

export const playDeath = () => {
  playTone(200, 0.6, 'sawtooth', 0.25, -180);
  playNoise(0.4, 0.15);
  playTone(120, 0.8, 'sine', 0.2, -80, 0.1);
};

export const playPowerUp = () => {
  playTone(400, 0.15, 'sine', 0.2);
  playTone(600, 0.15, 'sine', 0.2, 0, 0.1);
  playTone(800, 0.15, 'sine', 0.2, 0, 0.2);
  playTone(1000, 0.25, 'sine', 0.15, 200, 0.3);
};

export const playLevelComplete = () => {
  playTone(523, 0.2, 'sine', 0.2);
  playTone(659, 0.2, 'sine', 0.2, 0, 0.15);
  playTone(784, 0.2, 'sine', 0.2, 0, 0.3);
  playTone(1047, 0.4, 'sine', 0.25, 0, 0.45);
};

export const playButtonClick = () => {
  playTone(800, 0.05, 'square', 0.1);
  playTone(600, 0.03, 'sine', 0.08, 0, 0.02);
};

/** Short lava warning beep when proximity > 0.7 */
export const playLavaWarning = () => {
  const now = performance.now();
  if (now - lastLavaWarnTime < 2000) return; // max every 2s
  lastLavaWarnTime = now;
  playTone(180, 0.3, 'sawtooth', 0.15, -60);
  playTone(140, 0.2, 'sine', 0.1, 0, 0.15);
};

// ─── Lava Proximity Sound (own channel, 15-25%) ───

/**
 * Update lava ambient volume based on proximity (0=far, 1=touching).
 * Call this every frame from GameEngine.
 */
export const updateLavaProximity = (proximity: number) => {
  if (!lavaGain || !ctx) return;
  // Map proximity to volume: 0 at <0.1, ramp to baseLavaVol at 1.0
  const vol = proximity > 0.1
    ? baseLavaVol * Math.min(1, (proximity - 0.1) / 0.9)
    : 0;
  // Smooth transition to avoid clicks
  const now = ctx.currentTime;
  lavaGain.gain.setTargetAtTime(vol, now, 0.1);

  // Trigger warning beep at high proximity
  if (proximity > 0.7) {
    playLavaWarning();
  }
};

function generateLavaLoop(): AudioBuffer {
  const c = ensureContext();
  const sampleRate = Math.max(44100, c.sampleRate);
  const duration = 4;
  const length = sampleRate * duration;
  const buffer = c.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Exact-cycle frequencies for seamless loop
  const rumbleFreq = Math.round(40 * duration) / duration;
  const crackleRate = Math.round(6 * duration) / duration;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Deep rumble
    const rumble = Math.sin(t * 2 * Math.PI * rumbleFreq) * 0.15 +
                   Math.sin(t * 2 * Math.PI * rumbleFreq * 1.5) * 0.06;
    // Bubbling crackle (amplitude-modulated noise)
    const bubbleEnv = (Math.sin(t * 2 * Math.PI * crackleRate) * 0.5 + 0.5);
    const crackle = (Math.random() * 2 - 1) * 0.04 * bubbleEnv;
    // Slow wavering
    const waver = Math.sin(t * 2 * Math.PI * 0.5) * 0.02;

    left[i] = rumble + crackle + waver;
    right[i] = rumble + crackle * 0.8 + waver * 1.1;
  }

  // Crossfade for seamless loop
  const crossFadeLen = 1024;
  for (let i = 0; i < crossFadeLen; i++) {
    const fade = i / crossFadeLen;
    left[length - crossFadeLen + i] = left[length - crossFadeLen + i] * (1 - fade) + left[i] * fade;
    right[length - crossFadeLen + i] = right[length - crossFadeLen + i] * (1 - fade) + right[i] * fade;
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
    try {
      if (lavaGain && ctx) {
        lavaGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
      setTimeout(() => {
        try { lavaSource?.stop(); } catch { /* */ }
        lavaSource = null;
        lavaPlaying = false;
      }, 100);
    } catch {
      lavaSource = null;
      lavaPlaying = false;
    }
  }
};

// ─── Background Music (Seamless Cave Ambience Loop at 44.1kHz) ───

function generateCaveAmbience(): AudioBuffer {
  const c = ensureContext();
  const sampleRate = Math.max(44100, c.sampleRate);
  const duration = 8;
  const length = sampleRate * duration;
  const buffer = c.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const droneFreq1 = Math.round(55 * duration) / duration;
  const droneFreq2 = Math.round(82.5 * duration) / duration;
  const padFreq = Math.round(110 * duration) / duration;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    const drone = Math.sin(t * 2 * Math.PI * droneFreq1) * 0.08 +
                  Math.sin(t * 2 * Math.PI * droneFreq2) * 0.04;

    const modSpeed = Math.round(0.5 * duration) / duration;
    const pad = Math.sin(t * 2 * Math.PI * padFreq + Math.sin(t * 2 * Math.PI * modSpeed) * 2) * 0.03 *
                (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * (Math.round(0.3 * duration) / duration)));

    const noise = (Math.random() * 2 - 1) * 0.008;

    const dripPeriod1 = 3.7;
    const dripPhase1 = t % dripPeriod1;
    const dripEnv1 = Math.max(0, 1 - dripPhase1 * 8) * Math.min(1, dripPhase1 * 200);
    const drip = Math.sin(t * 2 * Math.PI * 2000 * Math.exp(-dripPhase1 * 8)) * 0.015 * dripEnv1;

    const dripPeriod2 = 5.1;
    const dripPhase2 = t % dripPeriod2;
    const dripEnv2 = Math.max(0, 1 - dripPhase2 * 6) * Math.min(1, dripPhase2 * 200);
    const drip2 = Math.sin(t * 2 * Math.PI * 1500 * Math.exp(-dripPhase2 * 6)) * 0.012 * dripEnv2;

    left[i] = drone + pad + noise + drip;
    right[i] = drone + pad * 0.8 + noise + drip2;
  }

  const crossFadeLen = 1024;
  for (let i = 0; i < crossFadeLen; i++) {
    const fade = i / crossFadeLen;
    left[length - crossFadeLen + i] = left[length - crossFadeLen + i] * (1 - fade) + left[i] * fade;
    right[length - crossFadeLen + i] = right[length - crossFadeLen + i] * (1 - fade) + right[i] * fade;
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
  musicSource.start();
  musicPlaying = true;
};

export const stopMusic = () => {
  if (musicSource && musicPlaying) {
    try {
      if (musicGain && ctx) {
        const now = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(now);
        musicGain.gain.setValueAtTime(musicGain.gain.value, now);
        musicGain.gain.linearRampToValueAtTime(0, now + 0.05);
      }
      setTimeout(() => {
        try { musicSource?.stop(); } catch { /* */ }
        musicSource = null;
        musicPlaying = false;
        if (musicGain && ctx) {
          musicGain.gain.setValueAtTime(baseMusicVol, ctx.currentTime);
        }
      }, 60);
    } catch {
      musicSource = null;
      musicPlaying = false;
    }
  }
};

export const pauseMusic = () => {
  if (musicGain && ctx) {
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(0, now + 0.1);
  }
};

export const resumeMusic = () => {
  if (musicGain && ctx) {
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(0, now);
    musicGain.gain.linearRampToValueAtTime(baseMusicVol, now + 0.1);
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
