import { create } from 'zustand';
import { setMusicVolume, setSfxVolume } from '@/game/SoundManager';

interface SettingsState {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number; // 0-100
  sfxVolume: number;   // 0-100
  vibrationEnabled: boolean;

  toggleMusic: () => void;
  toggleSfx: () => void;
  setMusicVol: (v: number) => void;
  setSfxVol: (v: number) => void;
  toggleVibration: () => void;
  loadSettings: () => void;
}

const STORAGE_KEY = 'volcanoEscapeSettings';

const loadFromStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const save = (s: Partial<SettingsState>) => {
  const prev = loadFromStorage();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...prev,
    musicEnabled: s.musicEnabled,
    sfxEnabled: s.sfxEnabled,
    musicVolume: s.musicVolume,
    sfxVolume: s.sfxVolume,
    vibrationEnabled: s.vibrationEnabled,
  }));
};

const applyVolumes = (musicEnabled: boolean, musicVolume: number, sfxEnabled: boolean, sfxVolume: number) => {
  setMusicVolume(musicEnabled ? musicVolume / 100 : 0);
  setSfxVolume(sfxEnabled ? sfxVolume / 100 : 0);
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 50,
  sfxVolume: 50,
  vibrationEnabled: true,

  toggleMusic: () => {
    const next = !get().musicEnabled;
    set({ musicEnabled: next });
    applyVolumes(next, get().musicVolume, get().sfxEnabled, get().sfxVolume);
    save(get());
  },

  toggleSfx: () => {
    const next = !get().sfxEnabled;
    set({ sfxEnabled: next });
    applyVolumes(get().musicEnabled, get().musicVolume, next, get().sfxVolume);
    save(get());
  },

  setMusicVol: (v) => {
    set({ musicVolume: v });
    applyVolumes(get().musicEnabled, v, get().sfxEnabled, get().sfxVolume);
    save(get());
  },

  setSfxVol: (v) => {
    set({ sfxVolume: v });
    applyVolumes(get().musicEnabled, get().musicVolume, get().sfxEnabled, v);
    save(get());
  },

  toggleVibration: () => {
    const next = !get().vibrationEnabled;
    set({ vibrationEnabled: next });
    save(get());
  },

  loadSettings: () => {
    const data = loadFromStorage();
    const s = {
      musicEnabled: data.musicEnabled ?? true,
      sfxEnabled: data.sfxEnabled ?? true,
      musicVolume: data.musicVolume ?? 50,
      sfxVolume: data.sfxVolume ?? 50,
      vibrationEnabled: data.vibrationEnabled ?? true,
    };
    set(s);
    applyVolumes(s.musicEnabled, s.musicVolume, s.sfxEnabled, s.sfxVolume);
  },
}));
