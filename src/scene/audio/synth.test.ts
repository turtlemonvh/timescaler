import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMuted, playCue, resetAudioForTests, setMuted, toggleMuted } from './synth';

function fakeParam() {
  return {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

class FakeAudioContext {
  static created = 0;
  static oscillators = 0;
  state = 'running';
  currentTime = 0;
  destination = {};
  constructor() {
    FakeAudioContext.created += 1;
  }
  resume = vi.fn(() => Promise.resolve());
  createOscillator() {
    FakeAudioContext.oscillators += 1;
    return {
      type: 'sine',
      frequency: fakeParam(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return { gain: fakeParam(), connect: vi.fn() };
  }
}

describe('synth', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAudioForTests();
    FakeAudioContext.created = 0;
    FakeAudioContext.oscillators = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is unmuted by default and persists the mute toggle', () => {
    expect(isMuted()).toBe(false);
    expect(toggleMuted()).toBe(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('does nothing, and does not throw, without an AudioContext', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playCue('hop')).not.toThrow();
  });

  it('schedules oscillators for a cue when unmuted, and none when muted', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    playCue('summit');
    expect(FakeAudioContext.created).toBe(1);
    expect(FakeAudioContext.oscillators).toBeGreaterThan(3);

    const before = FakeAudioContext.oscillators;
    setMuted(true);
    playCue('hop');
    expect(FakeAudioContext.oscillators).toBe(before);
  });

  it('reuses one context across cues', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    playCue('hop');
    playCue('slip');
    expect(FakeAudioContext.created).toBe(1);
  });
});
