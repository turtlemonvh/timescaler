import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';
import { describeTime, formatTime12, randomTime, stepTime, to24Hour } from './timeMath';

describe('randomTime', () => {
  it('snaps to hour boundaries', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const t = randomTime(rng, 'hour');
      expect(t.minute).toBe(0);
      expect(t.second).toBe(0);
    }
  });

  it('snaps to half-hour boundaries', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 100; i++) {
      const t = randomTime(rng, 'half');
      expect([0, 30]).toContain(t.minute);
    }
  });

  it('snaps to quarter-hour boundaries', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 100; i++) {
      const t = randomTime(rng, 'quarter');
      expect([0, 15, 30, 45]).toContain(t.minute);
    }
  });

  it('snaps to five-minute boundaries', () => {
    const rng = mulberry32(4);
    for (let i = 0; i < 100; i++) {
      const t = randomTime(rng, 'five');
      expect(t.minute % 5).toBe(0);
    }
  });

  it('allows any minute at minute precision, with zero seconds', () => {
    const rng = mulberry32(5);
    const minutes = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const t = randomTime(rng, 'minute');
      minutes.add(t.minute);
      expect(t.second).toBe(0);
    }
    expect(minutes.size).toBeGreaterThan(10);
  });

  it('produces varied seconds at second precision', () => {
    const rng = mulberry32(6);
    const seconds = new Set<number>();
    for (let i = 0; i < 300; i++) {
      seconds.add(randomTime(rng, 'second').second);
    }
    expect(seconds.size).toBeGreaterThan(10);
  });

  it('always produces an hour in [0, 23]', () => {
    const rng = mulberry32(8);
    for (let i = 0; i < 200; i++) {
      const t = randomTime(rng, 'hour');
      expect(t.hour).toBeGreaterThanOrEqual(0);
      expect(t.hour).toBeLessThanOrEqual(23);
    }
  });
});

describe('formatTime12', () => {
  it('formats midnight as 12:00 AM', () => {
    expect(formatTime12({ hour: 0, minute: 0, second: 0 })).toBe('12:00 AM');
  });

  it('formats noon as 12:00 PM', () => {
    expect(formatTime12({ hour: 12, minute: 0, second: 0 })).toBe('12:00 PM');
  });

  it('formats a morning time', () => {
    expect(formatTime12({ hour: 1, minute: 5, second: 0 })).toBe('1:05 AM');
  });

  it('formats an afternoon time', () => {
    expect(formatTime12({ hour: 13, minute: 5, second: 0 })).toBe('1:05 PM');
  });

  it('includes seconds when requested', () => {
    expect(formatTime12({ hour: 15, minute: 45, second: 9 }, { seconds: true })).toBe('3:45:09 PM');
  });
});

describe('to24Hour', () => {
  it('maps 12 AM to hour 0 (midnight)', () => {
    expect(to24Hour(12, false)).toBe(0);
  });

  it('maps 12 PM to hour 12 (noon)', () => {
    expect(to24Hour(12, true)).toBe(12);
  });

  it('maps a morning hour unchanged', () => {
    expect(to24Hour(3, false)).toBe(3);
  });

  it('adds 12 to a non-noon afternoon hour', () => {
    expect(to24Hour(3, true)).toBe(15);
  });

  it("round-trips with formatTime12's hour-12 conversion for every hour", () => {
    for (let hour = 0; hour < 24; hour++) {
      const isPM = hour >= 12;
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      expect(to24Hour(hour12, isPM)).toBe(hour);
    }
  });
});

describe('describeTime', () => {
  it("describes exact hours as o'clock", () => {
    expect(describeTime({ hour: 3, minute: 0, second: 0 })).toBe("three o'clock");
    expect(describeTime({ hour: 0, minute: 0, second: 0 })).toBe("twelve o'clock");
    expect(describeTime({ hour: 12, minute: 0, second: 0 })).toBe("twelve o'clock");
  });

  it('describes quarter past and quarter to', () => {
    expect(describeTime({ hour: 3, minute: 15, second: 0 })).toBe('quarter past three');
    expect(describeTime({ hour: 3, minute: 45, second: 0 })).toBe('quarter to four');
  });

  it('describes half past', () => {
    expect(describeTime({ hour: 3, minute: 30, second: 0 })).toBe('half past three');
  });

  it('describes arbitrary minutes past and to the hour', () => {
    expect(describeTime({ hour: 3, minute: 10, second: 0 })).toBe('ten past three');
    expect(describeTime({ hour: 3, minute: 50, second: 0 })).toBe('ten to four');
  });

  it('wraps the hour word at the top of the clock', () => {
    expect(describeTime({ hour: 23, minute: 45, second: 0 })).toBe('quarter to twelve');
    expect(describeTime({ hour: 11, minute: 45, second: 0 })).toBe('quarter to twelve');
  });
});

describe('stepTime', () => {
  const t = (hour: number, minute: number) => ({ hour, minute, second: 0 });

  it('steps the hour and wraps 12 <-> 1 without touching the minutes', () => {
    expect(stepTime(t(3, 20), 'hour', 1)).toEqual(t(4, 20));
    expect(stepTime(t(12, 20), 'hour', 1)).toEqual(t(13, 20)); // 12 PM -> 1 PM
    expect(stepTime(t(13, 20), 'hour', -1)).toEqual(t(12, 20)); // 1 PM -> 12 PM
    expect(stepTime(t(0, 5), 'hour', 1)).toEqual(t(1, 5)); // 12 AM -> 1 AM
  });

  it('never changes AM/PM when stepping the hour', () => {
    expect(stepTime(t(11, 0), 'hour', 1)).toEqual(t(0, 0)); // 11 AM -> 12 AM
    expect(stepTime(t(23, 0), 'hour', 1)).toEqual(t(12, 0)); // 11 PM -> 12 PM, not AM
    expect(stepTime(t(12, 0), 'hour', -1)).toEqual(t(23, 0)); // 12 PM -> 11 PM
    expect(stepTime(t(0, 0), 'hour', -1)).toEqual(t(11, 0)); // 12 AM -> 11 AM
  });

  it('carries minutes into the hour like a real clock', () => {
    expect(stepTime(t(9, 55), 'minute', 5)).toEqual(t(10, 0));
    expect(stepTime(t(10, 0), 'minute', -1)).toEqual(t(9, 59));
    expect(stepTime(t(14, 45), 'minute', 15)).toEqual(t(15, 0));
    expect(stepTime(t(14, 30), 'minute', -30)).toEqual(t(14, 0));
    expect(stepTime(t(14, 0), 'minute', -30)).toEqual(t(13, 30));
  });

  it('holds AM/PM at every minute boundary', () => {
    expect(stepTime(t(11, 59), 'minute', 1)).toEqual(t(0, 0)); // 11:59 AM -> 12:00 AM
    expect(stepTime(t(11, 55), 'minute', 5)).toEqual(t(0, 0)); // 11:55 AM -> 12:00 AM
    expect(stepTime(t(12, 0), 'minute', -1)).toEqual(t(23, 59)); // 12:00 PM -> 11:59 PM
    expect(stepTime(t(23, 59), 'minute', 1)).toEqual(t(12, 0)); // 11:59 PM -> 12:00 PM
    expect(stepTime(t(0, 0), 'minute', -1)).toEqual(t(11, 59)); // 12:00 AM -> 11:59 AM
    expect(stepTime(t(12, 59), 'minute', 1)).toEqual(t(13, 0)); // 12:59 PM -> 1:00 PM
  });

  it('always zeroes seconds', () => {
    expect(stepTime({ hour: 4, minute: 10, second: 33 }, 'minute', 1).second).toBe(0);
    expect(stepTime({ hour: 4, minute: 10, second: 33 }, 'hour', 1).second).toBe(0);
  });

  it('a full lap of either unit comes back to the start', () => {
    let time = t(17, 25);
    for (let i = 0; i < 12; i++) time = stepTime(time, 'hour', 1);
    expect(time).toEqual(t(17, 25));
    for (let i = 0; i < 720; i++) time = stepTime(time, 'minute', -1);
    expect(time).toEqual(t(17, 25));
  });
});
