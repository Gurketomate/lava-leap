/**
 * SoundManager – Web Audio API based, iPad-compatible.
 * Clean audio mix: separate music/SFX channels, ducking, SFX limiter, seamless loops.
 */

let ctx: AudioContext | null = null;
let unlocked = false;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;

// Background music state
let musicSource: AudioBufferSourceNode | null = null;
let musicBuffer: AudioBuffer | null = null;
let musicPlaying = false;

// SFX concurrency limiter (max 3 simultaneous)
let activeSfxCount = 0;
const MAX_CONCURRENT_SFX = 3;

// Ducking state
let duckTimeout: ReturnType<typeof setTimeout> | null = null;
const DUCK_AMOUNT = 0.8; // reduce music to 80% of current vol
const DUCK_DURATION = 300; // ms
let baseMusicVol = 0.4; // default 40%
let baseSfxVol = 0.6;   // default 60%

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

    musicBuffer = generateCaveAmbience();
  }
  return ctx;
};

/** Must be called from a user gesture (touch/click) to unlock AudioContext on iOS */
export const unlockAudio = () => {
  const c = ensureContext();
  if (unlocked) return;
  if (c.state === 'suspended') {
    c.resume();
  }
  const buf = c.createBuffer(1, 1, 44100);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
  unlocked = true;
};

// ─── Ducking: temporarily lower music when SFX plays ───

const duckMusic = () => {
  if (!musicGain || !musicPlaying) return;
  const c = ensureContext();
  const now = c.currentTime;
  const duckedVol = baseMusicVol * DUCK_AMOUNT;

  // Quick fade down
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(duckedVol, now + 0.02);

  // Schedule fade back up
  if (duckTimeout) clearTimeout(duckTimeout);
  duckTimeout = setTimeout(() => {
    if (!musicGain || !ctx) return;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(baseMusicVol, t + 0.1);
  }, DUCK_DURATION);
};

// ─── Procedural Sound Generators ───

const playTone = (
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
  pitchDecay = 0,
  delayTime = 0
) => {
  const c = ensureContext();
  if (c.state === 'suspended') return;
  if (activeSfxCount >= MAX_CONCURRENT_SFX) return; // limiter

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
  gain.connect(sfxGain!);
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
  // Apply fade-in/out envelope to prevent clicks
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

export const playJump = () => {
  const now = performance.now();
  if (now - lastJumpTime < 80) return;
  lastJumpTime = now;
  playTone(280, 0.15, 'square', 0.15, 400);
  playTone(500, 0.08, 'sine', 0.08, 0, 0.03);
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

// ─── Background Music (Seamless Cave Ambience Loop at 44.1kHz) ───

function generateCaveAmbience(): AudioBuffer {
  const c = ensureContext();
  const sampleRate = Math.max(44100, c.sampleRate); // ensure ≥44.1kHz
  const duration = 8;
  const length = sampleRate * duration;
  const buffer = c.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Pre-compute frequencies that complete exact cycles in `duration` seconds
  // to ensure seamless looping (no click at loop boundary)
  const droneFreq1 = Math.round(55 * duration) / duration;   // ~55 Hz, exact cycles
  const droneFreq2 = Math.round(82.5 * duration) / duration; // ~82.5 Hz
  const padFreq = Math.round(110 * duration) / duration;     // ~110 Hz

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const phase = t / duration; // 0..1 for envelope continuity

    // Deep drone (exact cycle frequencies for seamless loop)
    const drone = Math.sin(t * 2 * Math.PI * droneFreq1) * 0.08 +
                  Math.sin(t * 2 * Math.PI * droneFreq2) * 0.04;

    // Slow evolving pad with smooth modulation
    const modSpeed = Math.round(0.5 * duration) / duration;
    const pad = Math.sin(t * 2 * Math.PI * padFreq + Math.sin(t * 2 * Math.PI * modSpeed) * 2) * 0.03 *
                (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * (Math.round(0.3 * duration) / duration)));

    // Filtered noise (very subtle)
    const noise = (Math.random() * 2 - 1) * 0.008;

    // Water drip sounds with smooth envelope
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

  // Cross-fade last 1024 samples with first 1024 for seamless loop
  const crossFadeLen = 1024;
  for (let i = 0; i < crossFadeLen; i++) {
    const fade = i / crossFadeLen;
    const revFade = 1 - fade;
    // Blend end into start
    left[length - crossFadeLen + i] = left[length - crossFadeLen + i] * revFade + left[i] * fade;
    right[length - crossFadeLen + i] = right[length - crossFadeLen + i] * revFade + right[i] * fade;
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
      // Fade out to prevent click
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
        // Restore gain for next start
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
