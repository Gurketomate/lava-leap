/**
 * Analytics hooks — prepared for CrazyGames SDK or similar integration.
 * Replace the console.log stubs with actual SDK calls when ready.
 */

export function runStart() {
  console.log('[Analytics] runStart', { timestamp: Date.now() });
}

export function runEnd(score: number, duration: number) {
  console.log('[Analytics] runEnd', { score, duration, timestamp: Date.now() });
}

export function upgradeChosen(type: string) {
  console.log('[Analytics] upgradeChosen', { type, timestamp: Date.now() });
}

export function deathCause(cause: 'lava' | 'fall') {
  console.log('[Analytics] deathCause', { cause, timestamp: Date.now() });
}
