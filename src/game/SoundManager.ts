/**
 * SoundManager – Web Audio API based, iPad-compatible.
 * Uses procedural oscillator sounds (no external files needed).
 * Handles AudioContext unlock on first user gesture (iOS requirement).
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

const ensureContext = (): AudioContext => {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(masterGain);

    // Generate cave ambience buffer
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
  // Play a silent buffer to fully unlock
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
  unlocked = true;
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
};

const playNoise = (duration: number, volume = 0.1) => {
  const c = ensureContext();
  if (c.state === 'suspended') return;

  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.connect(gain);
  gain.connect(sfxGain!);
  src.start();
};

// ─── Event Sounds ───

// Cooldown tracking to prevent overlaps
let lastJumpTime = 0;
let lastCoinTime = 0;

export const playJump = () => {
  const now = performance.now();
  if (now - lastJumpTime < 80) return; // prevent overlap
  lastJumpTime = now;
  // Quick upward sweep
  playTone(280, 0.15, 'square', 0.15, 400);
  playTone(500, 0.08, 'sine', 0.08, 0, 0.03);
};

export const playCoin = () => {
  const now = performance.now();
  if (now - lastCoinTime < 50) return;
  lastCoinTime = now;
  // Coin bling: two quick high notes
  playTone(1200, 0.08, 'sine', 0.2);
  playTone(1600, 0.12, 'sine', 0.15, 0, 0.06);
};

export const playDeath = () => {
  // Low rumble + descending tone
  playTone(200, 0.6, 'sawtooth', 0.25, -180);
  playNoise(0.4, 0.15);
  playTone(120, 0.8, 'sine', 0.2, -80, 0.1);
};

export const playPowerUp = () => {
  // Rising arpeggio
  playTone(400, 0.15, 'sine', 0.2);
  playTone(600, 0.15, 'sine', 0.2, 0, 0.1);
  playTone(800, 0.15, 'sine', 0.2, 0, 0.2);
  playTone(1000, 0.25, 'sine', 0.15, 200, 0.3);
};

export const playLevelComplete = () => {
  // Victory fanfare
  playTone(523, 0.2, 'sine', 0.2);
  playTone(659, 0.2, 'sine', 0.2, 0, 0.15);
  playTone(784, 0.2, 'sine', 0.2, 0, 0.3);
  playTone(1047, 0.4, 'sine', 0.25, 0, 0.45);
};

export const playButtonClick = () => {
  // Soft click
  playTone(800, 0.05, 'square', 0.1);
  playTone(600, 0.03, 'sine', 0.08, 0, 0.02);
};

// ─── Background Music (Procedural Cave Ambience Loop) ───

function generateCaveAmbience(): AudioBuffer {
  const c = ensureContext();
  const duration = 8; // 8 second loop
  const sampleRate = c.sampleRate;
  const length = sampleRate * duration;
  const buffer = c.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Deep drone
    const drone = Math.sin(t * 2 * Math.PI * 55) * 0.08 +
                  Math.sin(t * 2 * Math.PI * 82.5) * 0.04;
    // Slow pad
    const pad = Math.sin(t * 2 * Math.PI * 110 + Math.sin(t * 0.5) * 2) * 0.03 *
                (0.5 + 0.5 * Math.sin(t * 0.3));
    // Subtle noise
    const noise = (Math.random() * 2 - 1) * 0.01;
    // Water drip-like sounds
    const drip = Math.sin(t * 2 * Math.PI * 2000 * Math.exp(-((t % 3.7) * 8))) *
                 0.02 * Math.max(0, 1 - (t % 3.7) * 8);
    const drip2 = Math.sin(t * 2 * Math.PI * 1500 * Math.exp(-((t % 5.1) * 6))) *
                  0.015 * Math.max(0, 1 - (t % 5.1) * 6);

    left[i] = drone + pad + noise + drip;
    right[i] = drone + pad * 0.8 + noise + drip2;
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
      musicSource.stop();
    } catch { /* already stopped */ }
    musicSource = null;
    musicPlaying = false;
  }
};

export const pauseMusic = () => {
  if (musicGain) {
    musicGain.gain.setValueAtTime(0, ensureContext().currentTime);
  }
};

export const resumeMusic = () => {
  if (musicGain) {
    musicGain.gain.setValueAtTime(0.5, ensureContext().currentTime);
  }
};

export const setMusicVolume = (v: number) => {
  if (musicGain) musicGain.gain.value = v;
};

export const setSfxVolume = (v: number) => {
  if (sfxGain) sfxGain.gain.value = v;
};
