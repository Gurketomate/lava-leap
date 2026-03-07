import { Settings, X, Volume2, VolumeX, Music, Smartphone, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGameStore } from '@/stores/gameStore';
import { useSoundClick } from '@/hooks/useSoundClick';
import { useState } from 'react';

interface SettingsMenuProps {
  onClose: () => void;
}

const SettingsMenu = ({ onClose }: SettingsMenuProps) => {
  const {
    musicEnabled, sfxEnabled, musicVolume, sfxVolume, vibrationEnabled,
    toggleMusic, toggleSfx, setMusicVol, setSfxVol, toggleVibration,
  } = useSettingsStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleClose = useSoundClick(onClose);
  const handleToggleMusic = useSoundClick(toggleMusic);
  const handleToggleSfx = useSoundClick(toggleSfx);
  const handleToggleVibration = useSoundClick(toggleVibration);

  const handleReset = useSoundClick(() => {
    localStorage.removeItem('volcanoEscape');
    useGameStore.getState().loadPersisted();
    setShowResetConfirm(false);
  });

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-md"
      onClick={handleClose}
    >
      <div
        className="glass-panel w-[90%] max-w-sm p-6 flex flex-col gap-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="text-primary" size={22} />
            <h2 className="text-xl font-display font-bold text-foreground">SETTINGS</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted/50 active:scale-90 transition-all"
          >
            <X className="text-muted-foreground" size={20} />
          </button>
        </div>

        {/* Music toggle + slider */}
        <div className="flex flex-col gap-2">
          <button onClick={handleToggleMusic} className="flex items-center justify-between py-2 group">
            <div className="flex items-center gap-3">
              <Music size={18} className="text-accent" />
              <span className="font-body text-sm text-foreground">Music</span>
            </div>
            <TogglePill enabled={musicEnabled} />
          </button>
          {musicEnabled && (
            <div className="flex items-center gap-3 pl-8">
              <VolumeX size={14} className="text-muted-foreground" />
              <input
                type="range" min={0} max={100} value={musicVolume}
                onChange={(e) => setMusicVol(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none bg-muted cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
              />
              <Volume2 size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-body w-8 text-right">{musicVolume}%</span>
            </div>
          )}
        </div>

        {/* SFX toggle + slider */}
        <div className="flex flex-col gap-2">
          <button onClick={handleToggleSfx} className="flex items-center justify-between py-2 group">
            <div className="flex items-center gap-3">
              <Volume2 size={18} className="text-accent" />
              <span className="font-body text-sm text-foreground">Sound Effects</span>
            </div>
            <TogglePill enabled={sfxEnabled} />
          </button>
          {sfxEnabled && (
            <div className="flex items-center gap-3 pl-8">
              <VolumeX size={14} className="text-muted-foreground" />
              <input
                type="range" min={0} max={100} value={sfxVolume}
                onChange={(e) => setSfxVol(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none bg-muted cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
              />
              <Volume2 size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-body w-8 text-right">{sfxVolume}%</span>
            </div>
          )}
        </div>

        {/* Vibration */}
        <button onClick={handleToggleVibration} className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Smartphone size={18} className="text-accent" />
            <span className="font-body text-sm text-foreground">Vibration / Haptics</span>
          </div>
          <TogglePill enabled={vibrationEnabled} />
        </button>

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Reset */}
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-3 py-2 group"
          >
            <RotateCcw size={18} className="text-destructive" />
            <span className="font-body text-sm text-destructive">Reset Progress</span>
          </button>
        ) : (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-xs text-destructive font-body text-center">
              Highscore, Münzen und Upgrades werden gelöscht. Bist du sicher?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 py-2 rounded-lg font-display font-bold text-sm bg-destructive text-destructive-foreground
                  hover:scale-105 active:scale-95 transition-transform"
              >
                JA, RESET
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-lg font-display font-semibold text-sm glass-panel text-foreground
                  hover:scale-105 active:scale-95 transition-transform"
              >
                ABBRECHEN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TogglePill = ({ enabled }: { enabled: boolean }) => (
  <div className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ${
    enabled ? 'bg-primary' : 'bg-muted'
  }`}>
    <div className={`w-5 h-5 rounded-full bg-foreground transition-transform duration-200 ${
      enabled ? 'translate-x-5' : 'translate-x-0'
    }`} />
  </div>
);

export default SettingsMenu;
