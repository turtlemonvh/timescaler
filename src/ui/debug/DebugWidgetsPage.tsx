import { useState } from 'react';
import type { TimeOfDay, TimePrecision } from '../../engine/timeMath';
import AnalogClock from '../widgets/AnalogClock';
import CalendarMonth from '../widgets/CalendarMonth';
import ChoiceGrid from '../widgets/ChoiceGrid';
import DatePicker from '../widgets/DatePicker';
import DigitalClock from '../widgets/DigitalClock';
import NumberEntry from '../widgets/NumberEntry';
import TimeEntry from '../widgets/TimeEntry';

const PRECISIONS: TimePrecision[] = ['hour', 'half', 'quarter', 'five', 'minute', 'second'];

const STATIC_TIMES: TimeOfDay[] = [
  { hour: 0, minute: 0, second: 0 },
  { hour: 3, minute: 15, second: 0 },
  { hour: 6, minute: 30, second: 0 },
  { hour: 9, minute: 45, second: 0 },
  { hour: 14, minute: 7, second: 42 },
];

/**
 * Dev-only gallery for the question display/answer widgets (clocks,
 * calendar, choice grid, entry fields) — a place to see every widget
 * rendered and interact with the draggable ones without playing through
 * the real game.
 */
export default function DebugWidgetsPage() {
  const [interactiveTime, setInteractiveTime] = useState<TimeOfDay>({
    hour: 10,
    minute: 10,
    second: 0,
  });
  const [precision, setPrecision] = useState<TimePrecision>('five');
  const [pickedDate, setPickedDate] = useState<{
    day: number;
    year: number;
    monthIndex: number;
  } | null>(null);
  const [choiceSelected, setChoiceSelected] = useState<number | undefined>(undefined);
  const [choiceRevealed, setChoiceRevealed] = useState(false);
  const [entryTime, setEntryTime] = useState<TimeOfDay>({ hour: 9, minute: 30, second: 0 });
  const [entryHour24, setEntryHour24] = useState(false);
  const [entryNumber, setEntryNumber] = useState<number | ''>('');

  return (
    <main>
      <h1>Debug: widgets</h1>
      <p>Dev-only. Not shipped to production — see CONTRIBUTING for how to reach this page.</p>

      <h2>AnalogClock — read-only</h2>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {STATIC_TIMES.map((time) => (
          <div key={`${time.hour}:${time.minute}:${time.second}`}>
            <AnalogClock time={time} showSeconds={time.second > 0} />
            <p>
              <DigitalClock time={time} showSeconds={time.second > 0} />
            </p>
          </div>
        ))}
      </div>

      <h2>AnalogClock — numerals on vs off</h2>
      <p>
        Numerals turn off at difficulty 9-10 (<code>clockNumerals</code> in
        <code>difficulty.ts</code>) as a deliberate positional-reading challenge.
      </p>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div>
          <AnalogClock time={{ hour: 10, minute: 10, second: 0 }} />
          <p>showNumerals (default)</p>
        </div>
        <div>
          <AnalogClock time={{ hour: 10, minute: 10, second: 0 }} showNumerals={false} />
          <p>showNumerals={'{false}'}</p>
        </div>
      </div>

      <h2>AnalogClock — draggable hands</h2>
      <p>
        <label htmlFor="widgets-precision">Snap precision</label>{' '}
        <select
          id="widgets-precision"
          data-testid="widgets-precision"
          value={precision}
          onChange={(event) => setPrecision(event.target.value as TimePrecision)}
        >
          {PRECISIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </p>
      <AnalogClock
        time={interactiveTime}
        precision={precision}
        onHandChange={setInteractiveTime}
        size={220}
      />
      <p>
        <DigitalClock time={interactiveTime} />
      </p>

      <h2>DigitalClock — 12h vs 24h</h2>
      <p>
        <DigitalClock time={{ hour: 14, minute: 5, second: 0 }} /> vs{' '}
        <DigitalClock time={{ hour: 14, minute: 5, second: 0 }} hour24 />
      </p>

      <h2>CalendarMonth — read-only, with a highlighted day</h2>
      <CalendarMonth year={2026} monthIndex={7} highlightDay={15} />

      <h2>CalendarMonth — clickable days</h2>
      <CalendarMonth
        year={2026}
        monthIndex={0}
        onDayClick={(day, year, monthIndex) => setPickedDate({ day, year, monthIndex })}
      />
      <p data-testid="widgets-picked-date">
        {pickedDate
          ? `Picked: ${pickedDate.monthIndex + 1}/${pickedDate.day}/${pickedDate.year}`
          : 'Nothing picked yet'}
      </p>

      <h2>ChoiceGrid — pick an answer, then reveal</h2>
      <ChoiceGrid
        options={['9:00 AM', '9:15 AM', '9:30 AM', '9:45 AM']}
        selectedIndex={choiceSelected}
        correctIndex={choiceRevealed ? 2 : undefined}
        disabled={choiceRevealed}
        onSelect={(index) => setChoiceSelected(index)}
      />
      <p>
        <button
          type="button"
          data-testid="widgets-reveal-choice"
          disabled={choiceSelected === undefined}
          onClick={() => setChoiceRevealed(true)}
        >
          Reveal
        </button>{' '}
        <button
          type="button"
          data-testid="widgets-reset-choice"
          onClick={() => {
            setChoiceSelected(undefined);
            setChoiceRevealed(false);
          }}
        >
          Reset
        </button>
      </p>

      <h2>ChoiceGrid — static reveal states</h2>
      <p>Correct pick:</p>
      <ChoiceGrid options={['A', 'B', 'C', 'D']} selectedIndex={1} correctIndex={1} />
      <p>Wrong pick:</p>
      <ChoiceGrid options={['A', 'B', 'C', 'D']} selectedIndex={0} correctIndex={1} />

      <h2>DatePicker</h2>
      <DatePicker initialYear={2026} initialMonthIndex={7} />

      <h2>TimeEntry</h2>
      <p>
        <label>
          <input
            type="checkbox"
            data-testid="widgets-entry-hour24"
            checked={entryHour24}
            onChange={(event) => setEntryHour24(event.target.checked)}
          />{' '}
          24-hour
        </label>
      </p>
      <TimeEntry time={entryTime} onChange={setEntryTime} hour24={entryHour24} showSeconds />
      <p>
        <DigitalClock time={entryTime} hour24={entryHour24} showSeconds />
      </p>

      <h2>NumberEntry</h2>
      <NumberEntry value={entryNumber} onChange={setEntryNumber} min={0} max={59} unit="minutes" />
    </main>
  );
}
