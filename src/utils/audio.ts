/**
 * Web Audio API synthesized tones for UniSphere academic workstation feedback.
 * Zero external audio assets, zero network latency, sub-5ms tactile response.
 */

const AUDIO_STORAGE_KEY = 'unisphere_audio_muted';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Audio mute state helpers
 */
export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(AUDIO_STORAGE_KEY);
    // User requested enabled by default
    return saved === 'true';
  } catch {
    return false;
  }
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUDIO_STORAGE_KEY, muted ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('unisphere-audio-toggle', { detail: { muted } }));
  } catch {}
}

export function toggleAudioMuted(): boolean {
  const current = isAudioMuted();
  setAudioMuted(!current);
  return !current;
}

/**
 * Subtle generic UI click
 */
export function playClickBeep() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch (e) {
    console.debug('Click beep failed', e);
  }
}

/**
 * Crisp tactile mechanical click when checking off a task / deliverable.
 * Synthesizes a rapid dual-transient impact reminiscent of a clean mechanical switch.
 */
export function playMechanicalClick() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Transient 1: High crisp snap
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    const snapFilter = ctx.createBiquadFilter();

    snapFilter.type = 'bandpass';
    snapFilter.frequency.setValueAtTime(2200, now);
    snapFilter.Q.setValueAtTime(3, now);

    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(1400, now);
    snapOsc.frequency.exponentialRampToValueAtTime(320, now + 0.025);

    snapGain.gain.setValueAtTime(0.05, now);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    snapOsc.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(ctx.destination);

    snapOsc.start(now);
    snapOsc.stop(now + 0.025);

    // Transient 2: Subtle bottom body tap
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();

    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(450, now + 0.005);
    bodyOsc.frequency.exponentialRampToValueAtTime(120, now + 0.035);

    bodyGain.gain.setValueAtTime(0.04, now + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(ctx.destination);

    bodyOsc.start(now + 0.005);
    bodyOsc.stop(now + 0.035);
  } catch (e) {
    console.debug('Mechanical click failed', e);
  }
}

/**
 * Sleek futuristic chime when a study timer hits 00:00.
 * Cascades an airy, harmonic frequency cluster that gently resolves.
 */
export function playFuturisticChime() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Frequencies: C5, E5, G5, B5, C6 (Pristine Major 7th harmonic ascent)
    const freqs = [523.25, 659.25, 783.99, 987.77, 1046.5];
    const delays = [0, 0.08, 0.16, 0.24, 0.32];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + delays[i];

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      // Soft envelope with gentle decay
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.9);
    });
  } catch (e) {
    console.debug('Futuristic chime failed', e);
  }
}

/**
 * Triumphant Loot Drop / XP Reward chime
 */
export function playLootDropChime() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Fast sparkling arpeggio
    const chord = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    chord.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + index * 0.05;

      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.045, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.7);
    });
  } catch (e) {
    console.debug('Loot drop chime failed', e);
  }
}

/**
 * Power-up level sweep
 */
export function playPowerUp() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(960, now + 0.25);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {
    console.debug('Power up failed', e);
  }
}
