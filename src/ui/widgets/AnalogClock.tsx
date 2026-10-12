import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { to24Hour, type TimeOfDay, type TimePrecision } from '../../engine/timeMath';

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

const PRECISION_STEP_MINUTES: Record<TimePrecision, number> = {
  hour: 60,
  half: 30,
  quarter: 15,
  five: 5,
  minute: 1,
  second: 1,
};

export interface AnalogClockProps {
  time: TimeOfDay;
  showSeconds?: boolean;
  /** On-screen size in px. */
  size?: number;
  /** Numerals 1-12 around the face. Difficulty turns this off at high levels. */
  showNumerals?: boolean;
  /** Minute-hand drag snapping. Only relevant when `onHandChange` is set. */
  precision?: TimePrecision;
  /** Presence makes the hour and minute hands draggable. */
  onHandChange?: (next: TimeOfDay) => void;
}

type Dragging = 'hour' | 'minute' | null;

/**
 * An SVG clock face with draggable hands. Hands are real hit-testable
 * elements with fractional angles; the face is a circle with 60 ticks.
 * The 12-hour face cannot show AM/PM, so a drag always preserves whichever
 * half the current time is in (see `defaultSetHandsDraft`).
 */
export default function AnalogClock({
  time,
  showSeconds = false,
  size = 260,
  showNumerals = true,
  precision = 'minute',
  onHandChange,
}: AnalogClockProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<Dragging>(null);
  const interactive = Boolean(onHandChange);

  const hourAngle = ((time.hour % 12) + time.minute / 60) * 30;
  const minuteAngle = time.minute * 6 + time.second / 10;
  const secondAngle = time.second * 6;

  const angleFromPointer = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  }, []);

  const applyDrag = useCallback(
    (which: Dragging, clientX: number, clientY: number) => {
      if (!which || !onHandChange) return;
      const angle = angleFromPointer(clientX, clientY);
      if (which === 'minute') {
        const step = PRECISION_STEP_MINUTES[precision];
        const minute = (Math.round(angle / 6 / step) * step) % 60;
        onHandChange({ ...time, minute, second: 0 });
      } else {
        const hour12 = Math.round(angle / 30) % 12 || 12;
        const isPM = time.hour >= 12;
        onHandChange({ ...time, hour: to24Hour(hour12, isPM) });
      }
    },
    [angleFromPointer, onHandChange, precision, time],
  );

  const startDrag = useCallback(
    (which: Dragging) => (event: ReactPointerEvent<SVGLineElement>) => {
      if (!interactive) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(which);
      applyDrag(which, event.clientX, event.clientY);
    },
    [applyDrag, interactive],
  );

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    applyDrag(dragging, event.clientX, event.clientY);
  }

  function endDrag() {
    setDragging(null);
  }

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
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block', touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
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
          x1={center}
          y1={center}
          x2={hourPoint.x}
          y2={hourPoint.y}
          stroke={FACE.rim}
          strokeWidth={size * 0.05}
          strokeLinecap="round"
          onPointerDown={startDrag('hour')}
          style={{
            cursor: interactive ? 'grab' : undefined,
            pointerEvents: interactive ? 'stroke' : 'none',
          }}
        />
        <line
          data-testid="analog-clock-minute-hand"
          x1={center}
          y1={center}
          x2={minutePoint.x}
          y2={minutePoint.y}
          stroke={FACE.rim}
          strokeWidth={size * 0.034}
          strokeLinecap="round"
          onPointerDown={startDrag('minute')}
          style={{
            cursor: interactive ? 'grab' : undefined,
            pointerEvents: interactive ? 'stroke' : 'none',
          }}
        />
        <circle cx={center} cy={center} r={size * 0.028} fill={FACE.rim} />
        <circle cx={center} cy={center} r={size * 0.012} fill={FACE.face} />
      </svg>
    </div>
  );
}
