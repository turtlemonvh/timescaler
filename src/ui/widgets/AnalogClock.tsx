import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  PRECISION_STEP_MINUTES,
  stepTime,
  type TimeOfDay,
  type TimePrecision,
} from '../../engine/timeMath';
import { useRepeatPress } from './useRepeatPress';

const FACE = {
  face: '#fdf6e3',
  faceEdge: '#f1e4c6',
  rim: '#3a2e1f',
  tick: '#8a7960',
  minuteTick: '#c9bda3',
};
const SECOND_HAND_COLOR = '#c0392b';
const NUMERAL_RADIUS_FRACTION = 0.36;
const NUMERALS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

export const CLOCK_HINT =
  'Tap an arrow to move one step. Hold it down to keep going — the longer you hold, the faster it moves.';

export interface AnalogClockProps {
  time: TimeOfDay;
  showSeconds?: boolean;
  /** On-screen size in px. */
  size?: number;
  /** Numerals 1-12 around the face. Difficulty turns this off at high levels. */
  showNumerals?: boolean;
  /** How far one press of a minute arrow moves. Only relevant when `onHandChange` is set. */
  precision?: TimePrecision;
  /** Presence adds the button pad that steps the hands. */
  onHandChange?: (next: TimeOfDay) => void;
  /** Keeps the pad on screen but greys it out (e.g. while an answer is revealed). */
  disabled?: boolean;
}

/**
 * An SVG clock face with display-only hands; the face is a circle with 60
 * ticks. With `onHandChange` it also renders a button pad below the face:
 * hours step by one, minutes by `precision` and carry into the hour. The
 * 12-hour face cannot show AM/PM, so every step keeps whichever half the
 * current time is in (see `stepTime` and `defaultSetHandsDraft`).
 */
export default function AnalogClock({
  time,
  showSeconds = false,
  size = 260,
  showNumerals = true,
  precision = 'minute',
  onHandChange,
  disabled = false,
}: AnalogClockProps) {
  const face = (
    <ClockFace time={time} showSeconds={showSeconds} size={size} showNumerals={showNumerals} />
  );
  if (!onHandChange) return face;
  return (
    <ClockInput time={time} precision={precision} onHandChange={onHandChange} disabled={disabled}>
      {face}
    </ClockInput>
  );
}

interface ClockInputProps {
  time: TimeOfDay;
  precision: TimePrecision;
  onHandChange: (next: TimeOfDay) => void;
  disabled: boolean;
  children: ReactNode;
}

function ClockInput({ time, precision, onHandChange, disabled, children }: ClockInputProps) {
  // The latest time this pad knows of: its own last step, or the prop once it
  // commits. Steps read it rather than `time`, so a repeat timer firing
  // before React re-renders still moves on from the previous step.
  const timeRef = useRef(time);
  useLayoutEffect(() => {
    timeRef.current = time;
  }, [time]);
  const [hintOpen, setHintOpen] = useState(false);
  const showHint = hintOpen && !disabled;
  const hintId = useId();

  useEffect(() => {
    if (!showHint) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setHintOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showHint]);

  const minuteStep = PRECISION_STEP_MINUTES[precision];
  const showMinutes = precision !== 'hour';

  function step(unit: 'hour' | 'minute', direction: 1 | -1) {
    setHintOpen(false);
    const next = stepTime(timeRef.current, unit, direction * (unit === 'hour' ? 1 : minuteStep));
    timeRef.current = next;
    onHandChange(next);
  }

  const minuteWord = minuteStep === 1 ? 'minute' : 'minutes';

  return (
    <div className="analog-clock-input" data-testid="analog-clock-input">
      {children}
      {showHint && (
        // Tapping the bubble itself closes it too, since it can sit over Submit.
        <p
          className="clock-pad__hint"
          role="tooltip"
          id={hintId}
          data-testid="clock-hint"
          onClick={() => setHintOpen(false)}
        >
          {CLOCK_HINT}
        </p>
      )}
      <div
        className="clock-pad"
        role="group"
        aria-label="Set the clock"
        data-testid="clock-pad"
        data-disabled={disabled ? 'true' : 'false'}
      >
        <StepButton
          direction={-1}
          label="hour hand back 1 hour"
          testId="clock-step-hour-back"
          disabled={disabled}
          onStep={() => step('hour', -1)}
        />
        <span className="clock-pad__label">Hours</span>
        <StepButton
          direction={1}
          label="hour hand forward 1 hour"
          testId="clock-step-hour-forward"
          disabled={disabled}
          onStep={() => step('hour', 1)}
        />
        <button
          type="button"
          className="clock-pad__help"
          data-testid="clock-help"
          aria-label="How to set the clock"
          aria-expanded={showHint}
          aria-describedby={showHint ? hintId : undefined}
          disabled={disabled}
          onClick={() => setHintOpen((open) => !open)}
        >
          <span aria-hidden="true">?</span>
        </button>
        {showMinutes && (
          <>
            <StepButton
              direction={-1}
              label={`minute hand back ${minuteStep} ${minuteWord}`}
              testId="clock-step-minute-back"
              disabled={disabled}
              onStep={() => step('minute', -1)}
            />
            <span className="clock-pad__label">Minutes</span>
            <StepButton
              direction={1}
              label={`minute hand forward ${minuteStep} ${minuteWord}`}
              testId="clock-step-minute-forward"
              disabled={disabled}
              onStep={() => step('minute', 1)}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface StepButtonProps {
  direction: 1 | -1;
  label: string;
  testId: string;
  disabled: boolean;
  onStep: () => void;
}

function StepButton({ direction, label, testId, disabled, onStep }: StepButtonProps) {
  const handlers = useRepeatPress(onStep, disabled);
  return (
    <button
      type="button"
      className="clock-pad__step"
      data-testid={testId}
      aria-label={label}
      disabled={disabled}
      {...handlers}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path
          d={direction > 0 ? 'M5 2.5 L15 9 L5 15.5 Z' : 'M13 2.5 L3 9 L13 15.5 Z'}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

interface ClockFaceProps {
  time: TimeOfDay;
  showSeconds: boolean;
  size: number;
  showNumerals: boolean;
}

function ClockFace({ time, showSeconds, size, showNumerals }: ClockFaceProps) {
  const hourAngle = ((time.hour % 12) + time.minute / 60) * 30;
  const minuteAngle = time.minute * 6 + time.second / 10;
  const secondAngle = time.second * 6;

  const center = size / 2;
  const radius = size * 0.47;

  function point(angleDeg: number, length: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: center + Math.sin(rad) * length, y: center - Math.cos(rad) * length };
  }

  const hourPoint = point(hourAngle, size * 0.27);
  const minutePoint = point(minuteAngle, size * 0.39);
  const secondPoint = point(secondAngle, size * 0.42);
  const numeralRadius = size * NUMERAL_RADIUS_FRACTION;

  return (
    <div
      className="analog-clock"
      style={{ position: 'relative', width: size, height: size }}
      data-testid="analog-clock"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <defs>
          <radialGradient id="analog-clock-face" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor={FACE.face} />
            <stop offset="100%" stopColor={FACE.faceEdge} />
          </radialGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="url(#analog-clock-face)"
          stroke={FACE.rim}
          strokeWidth={size * 0.035}
        />
        {Array.from({ length: 60 }, (_, i) => {
          const major = i % 5 === 0;
          const outer = point(i * 6, radius - size * 0.03);
          const inner = point(i * 6, radius - size * (major ? 0.085 : 0.06));
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={major ? FACE.rim : FACE.minuteTick}
              strokeWidth={size * (major ? 0.016 : 0.008)}
              strokeLinecap="round"
            />
          );
        })}
        {showNumerals &&
          NUMERALS.map((label, i) => {
            const p = point(i * 30, numeralRadius);
            return (
              <text
                key={label}
                data-testid="analog-clock-numeral"
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="var(--sans)"
                fontWeight={700}
                fontSize={size * 0.095}
                fill={FACE.rim}
              >
                {label}
              </text>
            );
          })}
        {showSeconds && (
          <line
            data-testid="analog-clock-second-hand"
            x1={center}
            y1={center}
            x2={secondPoint.x}
            y2={secondPoint.y}
            stroke={SECOND_HAND_COLOR}
            strokeWidth={size * 0.012}
            strokeLinecap="round"
          />
        )}
        <line
          data-testid="analog-clock-hour-hand"
          data-hour={time.hour}
          x1={center}
          y1={center}
          x2={hourPoint.x}
          y2={hourPoint.y}
          stroke={FACE.rim}
          strokeWidth={size * 0.05}
          strokeLinecap="round"
        />
        <line
          data-testid="analog-clock-minute-hand"
          data-minute={time.minute}
          x1={center}
          y1={center}
          x2={minutePoint.x}
          y2={minutePoint.y}
          stroke={FACE.rim}
          strokeWidth={size * 0.034}
          strokeLinecap="round"
        />
        <circle cx={center} cy={center} r={size * 0.028} fill={FACE.rim} />
        <circle cx={center} cy={center} r={size * 0.012} fill={FACE.face} />
      </svg>
    </div>
  );
}
