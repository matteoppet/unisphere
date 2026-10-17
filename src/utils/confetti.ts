import confetti from 'canvas-confetti';

/**
 * Fires a sleek, contained particle burst for task completion micro-feedback.
 */
export function fireTaskConfetti(origin?: { x: number; y: number }) {
  try {
    const x = origin ? origin.x / window.innerWidth : 0.5;
    const y = origin ? origin.y / window.innerHeight : 0.6;

    confetti({
      particleCount: 36,
      spread: 55,
      startVelocity: 28,
      ticks: 120,
      origin: { x, y },
      colors: ['#3B77BC', '#81C046', '#FCCF03', '#DE482B', '#5A738E'],
      disableForReducedMotion: true,
      scalar: 0.85,
    });
  } catch (e) {
    console.debug('Confetti burst failed', e);
  }
}

/**
 * Fires a dual-cannon celebration burst for study block completion, Loot Drops, or Level-ups.
 */
export function fireCelebrationConfetti() {
  try {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      disableForReducedMotion: true,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#3B77BC', '#81C046', '#FCCF03'],
    });

    fire(0.2, {
      spread: 60,
      colors: ['#FCCF03', '#DE482B', '#5A738E'],
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ['#81C046', '#3B77BC', '#FCCF03'],
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#FCCF03', '#81C046'],
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ['#3B77BC', '#DE482B'],
    });
  } catch (e) {
    console.debug('Celebration confetti failed', e);
  }
}
