import { to24Hour, type TimeOfDay } from '../../engine/timeMath';

export interface TimeEntryProps {
  time: TimeOfDay;
  onChange: (next: TimeOfDay) => void;
  /** 24-hour display (difficulty 8+ per the design spec) vs. 12-hour AM/PM. */
  hour24?: boolean;
  showSeconds?: boolean;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_OR_SECONDS = Array.from({ length: 60 }, (_, i) => i);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Dropdown-based exact time entry — the typed-input counterpart to
 * `AnalogClock`'s step-button hands. Uses `to24Hour` to convert between
 * 12-hour display and the engine's 24-hour `TimeOfDay`.
 */
export default function TimeEntry({
  time,
  onChange,
  hour24 = false,
  showSeconds = false,
}: TimeEntryProps) {
  const isPM = time.hour >= 12;
  const hour12 = time.hour % 12 === 0 ? 12 : time.hour % 12;

  return (
    <div data-testid="time-entry">
      <select
        data-testid="time-entry-hour"
        value={hour24 ? time.hour : hour12}
        onChange={(event) => {
          const selected = Number(event.target.value);
          const hour = hour24 ? selected : to24Hour(selected, isPM);
          onChange({ ...time, hour });
        }}
      >
        {(hour24 ? HOURS_24 : HOURS_12).map((h) => (
          <option key={h} value={h}>
            {hour24 ? pad2(h) : h}
          </option>
        ))}
      </select>
      :
      <select
        data-testid="time-entry-minute"
        value={time.minute}
        onChange={(event) => onChange({ ...time, minute: Number(event.target.value) })}
      >
        {MINUTES_OR_SECONDS.map((m) => (
          <option key={m} value={m}>
            {pad2(m)}
          </option>
        ))}
      </select>
      {showSeconds && (
        <>
          :
          <select
            data-testid="time-entry-second"
            value={time.second}
            onChange={(event) => onChange({ ...time, second: Number(event.target.value) })}
          >
            {MINUTES_OR_SECONDS.map((s) => (
              <option key={s} value={s}>
                {pad2(s)}
              </option>
            ))}
          </select>
        </>
      )}
      {!hour24 && (
        <select
          data-testid="time-entry-period"
          value={isPM ? 'PM' : 'AM'}
          onChange={(event) =>
            onChange({ ...time, hour: to24Hour(hour12, event.target.value === 'PM') })
          }
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      )}
    </div>
  );
}
