import { useCallback } from 'react';
import { playButtonClick, unlockAudio } from '@/game/SoundManager';

/**
 * Hook that wraps an onClick handler with button click sound + iOS audio unlock.
 */
export const useSoundClick = (handler?: (() => void) | ((...args: any[]) => void)) => {
  return useCallback((...args: any[]) => {
    unlockAudio();
    playButtonClick();
    if (handler) handler(...args);
  }, [handler]);
};
