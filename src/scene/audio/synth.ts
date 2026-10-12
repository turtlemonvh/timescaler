/**
 * Tiny WebAudio synth for the game's cues. No audio files: every sound is a
 * couple of oscillators with an envelope, which keeps the PWA precache small
 * and means there is nothing to forget in the workbox glob.
 *
 * The AudioContext is created lazily on the first cue, which in practice is
 * always inside a click handler, so autoplay policy is satisfied.
 */
export type Cue = 'tap' | 'hop' | 'hopFast' | 'slip' | 'fall' | 'summit' | 'select';

const MUTE_KEY = 'timescaler.muted';

let context: AudioContext | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  return storage()?.getItem(MUTE_KEY) === '1';
}

export function setMuted(muted: boolean): void {
  storage()?.setItem(MUTE_KEY, muted ? '1' : '0');
}

export function toggleMuted(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

interface Note {
  /** Seconds after the cue starts. */
  at: number;
  freq: number;
  /** Seconds. */
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Frequency to glide to by the end of the note. */
  glide?: number;
}

const CUES: Readonly<Record<Cue, readonly Note[]>> = {
  tap: [{ at: 0, freq: 880, dur: 0.05, type: 'square', gain: 0.08 }],
  select: [
    { at: 0, freq: 523, dur: 0.08, type: 'triangle' },
    { at: 0.08, freq: 784, dur: 0.12, type: 'triangle' },
  ],
  hop: [
    { at: 0, freq: 392, dur: 0.1, type: 'triangle', glide: 659 },
    { at: 0.1, freq: 784, dur: 0.14, type: 'triangle', gain: 0.18 },
  ],
  hopFast: [
    { at: 0, freq: 523, dur: 0.08, type: 'triangle', glide: 880 },
    { at: 0.08, freq: 1047, dur: 0.1, type: 'triangle', gain: 0.2 },
    { at: 0.18, freq: 1319, dur: 0.16, type: 'sine', gain: 0.16 },
  ],
  slip: [
    // The leap: a short rising effort note, then the slide and the thud.
    { at: 0, freq: 330, dur: 0.14, type: 'triangle', gain: 0.12, glide: 520 },
    { at: 0.3, freq: 440, dur: 0.22, type: 'sawtooth', gain: 0.12, glide: 180 },
    { at: 0.52, freq: 140, dur: 0.08, type: 'square', gain: 0.1 },
  ],
  fall: [
    { at: 0, freq: 600, dur: 0.6, type: 'sawtooth', gain: 0.12, glide: 90 },
    { at: 0.62, freq: 70, dur: 0.18, type: 'square', gain: 0.18 },
    { at: 0.7, freq: 55, dur: 0.25, type: 'triangle', gain: 0.14 },
  ],
  summit: [
    { at: 0, freq: 523, dur: 0.14, type: 'square', gain: 0.12 },
    { at: 0.14, freq: 659, dur: 0.14, type: 'square', gain: 0.12 },
    { at: 0.28, freq: 784, dur: 0.14, type: 'square', gain: 0.12 },
    { at: 0.42, freq: 1047, dur: 0.4, type: 'square', gain: 0.14 },
    { at: 0.42, freq: 523, dur: 0.4, type: 'triangle', gain: 0.1 },
    { at: 0.9, freq: 784, dur: 0.12, type: 'square', gain: 0.1 },
    { at: 1.02, freq: 1047, dur: 0.5, type: 'square', gain: 0.14 },
    { at: 1.02, freq: 1319, dur: 0.5, type: 'triangle', gain: 0.1 },
  ],
};

export interface CueOptions {
  /** Shift the whole cue up (or down) by this many semitones. */
  semitones?: number;
}

/** Plays a cue unless muted or audio is unavailable. Never throws. */
export function playCue(cue: Cue, options: CueOptions = {}): void {
  if (isMuted()) return;
  const ctx = getContext();
  if (!ctx) return;
  const pitch = Math.pow(2, (options.semitones ?? 0) / 12);
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime + 0.01;
    for (const note of CUES[cue]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type ?? 'triangle';
      osc.frequency.setValueAtTime(note.freq * pitch, start + note.at);
      if (note.glide) {
        osc.frequency.exponentialRampToValueAtTime(note.glide * pitch, start + note.at + note.dur);
      }
      const peak = note.gain ?? 0.15;
      gain.gain.setValueAtTime(0.0001, start + note.at);
      gain.gain.exponentialRampToValueAtTime(peak, start + note.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start + note.at);
      osc.stop(start + note.at + note.dur + 0.02);
    }
  } catch {
    // Audio is decoration; a broken context must never break the game.
  }
}

/** Test seam: forget the lazily-created context. */
export function resetAudioForTests(): void {
  context = null;
}
