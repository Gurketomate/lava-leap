import { create } from 'zustand';

/**
 * Ad Manager — handles all ad timing, cooldowns, and session tracking.
 * SDK integration stubs: replace showInterstitialAd / showRewardedAd with real SDK calls.
 */

interface AdStore {
  sessionStartTime: number;
  deathCount: number;
  lastAdTime: number; // timestamp of last shown ad
  rewardedUsedThisRun: boolean;
  lastInterstitialTime: number;

  // Actions
  initSession: () => void;
  recordDeath: () => void;
  resetRunAdState: () => void;

  // Ad eligibility checks
  canShowInterstitial: () => boolean;
  canShowMilestoneInterstitial: (levelId: number) => boolean;
  canShowRewardedAd: () => boolean;

  // Ad display (stubs — replace with SDK calls)
  showInterstitial: () => Promise<boolean>;
  showRewardedAd: () => Promise<boolean>;

  // Retention helpers
  getCloseCallMessage: (score: number, targetHeight: number) => string | null;
}

const INTERSTITIAL_COOLDOWN_MS = 120_000; // 2 minutes between any interstitial
const SESSION_GRACE_PERIOD_MS = 180_000;  // no interstitials in first 3 minutes
const DEATH_GRACE_COUNT = 2;               // no interstitials in first 2 deaths
const MILESTONE_SESSION_MIN_MS = 180_000; // milestone ads only after 3 min session
const MILESTONE_LEVELS = new Set([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);

export const useAdStore = create<AdStore>((set, get) => ({
  sessionStartTime: Date.now(),
  deathCount: 0,
  lastAdTime: 0,
  rewardedUsedThisRun: false,
  lastInterstitialTime: 0,

  initSession: () => set({
    sessionStartTime: Date.now(),
    deathCount: 0,
    lastAdTime: 0,
    rewardedUsedThisRun: false,
    lastInterstitialTime: 0,
  }),

  recordDeath: () => set((s) => ({ deathCount: s.deathCount + 1 })),

  resetRunAdState: () => set({ rewardedUsedThisRun: false }),

  canShowInterstitial: () => {
    const s = get();
    const now = Date.now();
    const sessionAge = now - s.sessionStartTime;

    // Grace period: no ads in first 3 minutes or first 2 deaths
    if (sessionAge < SESSION_GRACE_PERIOD_MS) return false;
    if (s.deathCount <= DEATH_GRACE_COUNT) return false;

    // Cooldown: at least 2 minutes since last ad
    if (now - s.lastInterstitialTime < INTERSTITIAL_COOLDOWN_MS) return false;

    return true;
  },

  canShowMilestoneInterstitial: (levelId: number) => {
    const s = get();
    const now = Date.now();
    const sessionAge = now - s.sessionStartTime;

    if (!MILESTONE_LEVELS.has(levelId)) return false;
    if (sessionAge < MILESTONE_SESSION_MIN_MS) return false;
    if (now - s.lastInterstitialTime < INTERSTITIAL_COOLDOWN_MS) return false;

    return true;
  },

  canShowRewardedAd: () => {
    const s = get();
    return !s.rewardedUsedThisRun;
  },

  showInterstitial: async () => {
    // STUB: Replace with real ad SDK call
    // e.g. await window.CrazyGames.SDK.ad.requestAd('midgame');
    console.log('[AdManager] Interstitial ad shown (stub)');
    const now = Date.now();
    set({ lastAdTime: now, lastInterstitialTime: now });
    // Simulate ad display with a small delay
    await new Promise((r) => setTimeout(r, 500));
    return true;
  },

  showRewardedAd: async () => {
    // STUB: Replace with real ad SDK call
    // e.g. const result = await window.CrazyGames.SDK.ad.requestAd('rewarded');
    console.log('[AdManager] Rewarded ad shown (stub)');
    set({ rewardedUsedThisRun: true, lastAdTime: Date.now() });
    // Simulate ad display
    await new Promise((r) => setTimeout(r, 500));
    return true;
  },

  getCloseCallMessage: (score: number, targetHeight: number) => {
    if (targetHeight <= 0) return null;
    const ratio = score / targetHeight;

    if (ratio >= 0.90) return '🔥 SO NAH DRAN! Nur noch ein paar Meter!';
    if (ratio >= 0.75) return '💪 Starker Lauf! Du warst bei 75%!';
    if (ratio >= 0.50) return '👀 Über die Hälfte geschafft — pack es nochmal an!';

    return null;
  },
}));
