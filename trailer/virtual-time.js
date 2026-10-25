// Injected before the page's own scripts by record.ts. Replaces the page's
// clocks, timers and animation frames with a virtual clock that only moves
// when the recorder calls `__vt.step(ms)`, so every recorded frame is exactly
// 1/fps apart no matter how slowly the software renderer draws it. Sound
// goes to one OfflineAudioContext on the same clock, rendered at the end.
(() => {
  const realNow = performance.now.bind(performance);
  const realDateNow = Date.now;
  const epoch = realDateNow();
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  let frameCallbacks = new Map();

  performance.now = () => now;
  Date.now = () => epoch + now;

  window.setTimeout = (fn, delay = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { due: now + Math.max(0, Number(delay) || 0), fn, args, every: null });
    return id;
  };
  window.setInterval = (fn, delay = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(delay) || 0);
    timers.set(id, { due: now + every, fn, args, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  window.requestAnimationFrame = (fn) => {
    const id = nextId++;
    frameCallbacks.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => frameCallbacks.delete(id);

  const SAMPLE_RATE = 48000;
  const MAX_SECONDS = 90;
  let offline = null;
  function audioContext() {
    offline ??= new OfflineAudioContext(2, SAMPLE_RATE * MAX_SECONDS, SAMPLE_RATE);
    return offline;
  }
  let audioOrigin = 0;
  class VirtualAudioContext {
    get currentTime() {
      return Math.max(0, (now - audioOrigin) / 1000);
    }
    get state() {
      return 'running';
    }
    get destination() {
      return audioContext().destination;
    }
    resume() {
      return Promise.resolve();
    }
    createOscillator() {
      return audioContext().createOscillator();
    }
    createGain() {
      return audioContext().createGain();
    }
  }
  window.AudioContext = VirtualAudioContext;
  window.webkitAudioContext = VirtualAudioContext;

  const seen = new WeakMap();
  function syncCssAnimations() {
    for (const animation of document.getAnimations()) {
      if (!seen.has(animation)) seen.set(animation, now);
      animation.pause();
      animation.currentTime = now - seen.get(animation);
    }
  }

  // A real macrotask: lets React's scheduler (MessageChannel) and microtasks
  // run between timers, as they would between real timer callbacks.
  const channel = new MessageChannel();
  const pending = [];
  channel.port1.onmessage = () => pending.shift()?.();
  const yieldToPage = () =>
    new Promise((resolve) => {
      pending.push(resolve);
      channel.port2.postMessage(null);
    });

  window.__vt = {
    now: () => now,
    /** Restart the audio track's zero at the current virtual time. */
    markAudioStart() {
      audioOrigin = now;
    },
    async step(ms) {
      const target = now + ms;
      for (;;) {
        let next = null;
        for (const [id, timer] of timers) {
          if (timer.due <= target && (!next || timer.due < next[1].due)) next = [id, timer];
        }
        if (!next) break;
        const [id, timer] = next;
        now = Math.max(now, timer.due);
        if (timer.every) timer.due += timer.every;
        else timers.delete(id);
        try {
          timer.fn(...timer.args);
        } catch (error) {
          console.error(error);
        }
        await yieldToPage();
      }
      now = target;
    },
    frame() {
      const callbacks = frameCallbacks;
      frameCallbacks = new Map();
      for (const fn of callbacks.values()) {
        try {
          fn(now);
        } catch (error) {
          console.error(error);
        }
      }
      syncCssAnimations();
    },
    /** The sound since `markAudioStart`, as a base64 WAV, or null if nothing played. */
    async renderAudio(durationMs) {
      if (!offline) return null;
      const buffer = await offline.startRendering();
      return encodeWav(buffer, Math.ceil((durationMs / 1000) * SAMPLE_RATE));
    },
    realNow,
  };

  function encodeWav(buffer, samples) {
    const channels = buffer.numberOfChannels;
    const length = Math.min(buffer.length, samples);
    const bytes = new DataView(new ArrayBuffer(44 + length * channels * 2));
    const text = (offset, s) =>
      [...s].forEach((c, i) => bytes.setUint8(offset + i, c.charCodeAt(0)));
    text(0, 'RIFF');
    bytes.setUint32(4, 36 + length * channels * 2, true);
    text(8, 'WAVEfmt ');
    bytes.setUint32(16, 16, true);
    bytes.setUint16(20, 1, true);
    bytes.setUint16(22, channels, true);
    bytes.setUint32(24, buffer.sampleRate, true);
    bytes.setUint32(28, buffer.sampleRate * channels * 2, true);
    bytes.setUint16(32, channels * 2, true);
    bytes.setUint16(34, 16, true);
    text(36, 'data');
    bytes.setUint32(40, length * channels * 2, true);
    const data = [...Array(channels).keys()].map((c) => buffer.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < channels; c++) {
        const sample = Math.max(-1, Math.min(1, data[c][i]));
        bytes.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    let binary = '';
    const u8 = new Uint8Array(bytes.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) {
      binary += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }
})();
