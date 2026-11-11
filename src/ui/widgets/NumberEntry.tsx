export interface NumberEntryProps {
  /** '' represents "cleared" — a kid backspacing the field shouldn't snap to 0. */
  value: number | '';
  onChange: (next: number | '') => void;
  min?: number;
  max?: number;
  unit?: string;
}

/**
 * A free-numeric-answer input (elapsed minutes, a count of days, etc.) —
 * the free-entry counterpart to `ChoiceGrid`'s multiple choice. Controlled,
 * like the other input widgets; the question/climb flow decides when a
 * typed value counts as a submitted answer — `Climb` wraps it in a form so
 * Enter submits.
 */
export default function NumberEntry({ value, onChange, min, max, unit }: NumberEntryProps) {
  return (
    <label data-testid="number-entry" className="number-entry">
      <input
        type="number"
        inputMode="numeric"
        // The return key reads "Go" and submits the surrounding form, if any.
        enterKeyHint="go"
        data-testid="number-entry-input"
        value={value}
        min={min}
        max={max}
        style={{ minWidth: 64, minHeight: 44, fontSize: 18 }}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? '' : Number(raw));
        }}
      />
      {unit && <span data-testid="number-entry-unit"> {unit}</span>}
    </label>
  );
}
