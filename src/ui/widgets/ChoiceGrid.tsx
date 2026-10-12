export interface ChoiceGridProps {
  options: string[];
  /** Presence makes options clickable; omit for a purely display-only grid. */
  onSelect?: (index: number) => void;
  /** The option the player picked, if any. */
  selectedIndex?: number;
  /** Set during the post-answer reveal to mark the correct option (and the
   * wrong one, if the player missed it). Undefined means "not revealed yet". */
  correctIndex?: number;
  /** Forces every option non-interactive, independent of onSelect. */
  disabled?: boolean;
  /** Fixed column count, filling the available width. Omitted, the grid
   * auto-fits 120px+ columns to its content (one column when its parent
   * shrink-wraps it). The portrait climb card asks for 2 so four options
   * take two rows instead of four. */
  columns?: number;
}

/**
 * A clickable multiple-choice grid with 44px+ tap targets (design spec's
 * "sized for a 7-year-old's finger"). Purely presentational: it reports
 * clicks and renders whatever selection/reveal state it's given, but never
 * tracks its own state — the question/climb flow above it owns "has this
 * been answered yet."
 */
export default function ChoiceGrid({
  options,
  onSelect,
  selectedIndex,
  correctIndex,
  disabled,
  columns,
}: ChoiceGridProps) {
  const revealing = correctIndex !== undefined;

  return (
    <div
      data-testid="choice-grid"
      role="group"
      style={{
        display: 'grid',
        gridTemplateColumns: columns
          ? `repeat(${columns}, minmax(0, 1fr))`
          : 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 8,
        ...(columns ? { width: '100%', maxWidth: 420 } : null),
      }}
    >
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const isCorrect = revealing && index === correctIndex;
        const isWrongSelection = revealing && isSelected && index !== correctIndex;
        // An option that's neither the answer nor what was picked, shown
        // during reveal — it should read as an inert reference, not fall
        // through to the loud default ember pill.
        const isNeutralReveal = revealing && !isCorrect && !isWrongSelection && !isSelected;
        const state = isCorrect
          ? 'correct'
          : isWrongSelection
            ? 'incorrect'
            : isSelected
              ? 'selected'
              : undefined;

        return (
          <button
            type="button"
            key={option}
            data-testid={`choice-option-${index}`}
            data-state={state}
            disabled={disabled || !onSelect}
            onClick={() => onSelect?.(index)}
            style={{
              minWidth: 44,
              minHeight: 44,
              padding: '12px 16px',
              borderRadius: 8,
              // The reveal state is the actual feedback moment — dimming
              // it via the global disabled-opacity rule would undercut the
              // colors that carry that feedback, so it's overridden here
              // unconditionally rather than only while revealing.
              opacity: 1,
              // Once revealing, every option is a flat feedback indicator,
              // not a pressable CTA — the global button's 3D bevel shadow
              // has to be turned off explicitly or it leaks through under
              // the correct/neutral backgrounds too. Before reveal, leave
              // it alone so answer options still look like normal pills.
              boxShadow: revealing ? 'none' : undefined,
              background: isCorrect
                ? 'var(--pine)'
                : isWrongSelection
                  ? 'var(--danger)'
                  : isSelected
                    ? 'var(--accent)'
                    : isNeutralReveal
                      ? 'var(--code-bg)'
                      : undefined,
              border: isNeutralReveal ? '1px solid var(--border)' : undefined,
              color:
                isCorrect || isWrongSelection || isSelected
                  ? '#fff'
                  : isNeutralReveal
                    ? 'var(--text-h)'
                    : undefined,
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
