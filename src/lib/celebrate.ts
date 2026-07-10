import confetti from 'canvas-confetti';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // vibrate unsupported (e.g. iOS Safari) — ignore
  }
}

/**
 * Celebrate a points award. `big` fires a fuller burst (used for a 1st-place
 * finish or a large award). Confetti is skipped under prefers-reduced-motion;
 * a short haptic tap still fires where supported.
 */
export function celebrateAward(colors: string[], big = false) {
  buzz(big ? [12, 40, 12] : 8);
  if (reducedMotion()) return;

  const safeColors = colors.length ? colors : ['#fbbf24', '#34d399', '#60a5fa'];
  confetti({
    particleCount: big ? 90 : 40,
    spread: big ? 75 : 55,
    startVelocity: big ? 45 : 35,
    origin: { y: 0.7 },
    colors: safeColors,
    disableForReducedMotion: true,
    scalar: 0.9,
  });
}
