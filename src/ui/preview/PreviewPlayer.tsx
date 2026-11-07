import { useEffect, useState } from 'react';
import { PEAKS } from '../../engine/peaks';
import { generateQuestionBatch } from '../../engine/questions/preview';
import {
  isCorrectPickDate,
  isCorrectSetHands,
  type AnswerSpec,
  type DisplaySpec,
  type Question,
} from '../../engine/questions';
import type { TimeOfDay } from '../../engine/timeMath';
import { defaultSetHandsDraft } from '../questionDisplay';
import AnalogClock from '../widgets/AnalogClock';
import CalendarMonth from '../widgets/CalendarMonth';
import ChoiceGrid from '../widgets/ChoiceGrid';
import DatePicker from '../widgets/DatePicker';
import NumberEntry from '../widgets/NumberEntry';

const NOON: TimeOfDay = { hour: 12, minute: 0, second: 0 };

function draftTimeFor(question: Question): TimeOfDay {
  return question.answer.kind === 'setHands' ? defaultSetHandsDraft(question.answer.target) : NOON;
}

const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function renderDisplay(display: DisplaySpec) {
  switch (display.kind) {
    case 'analogClock':
      return (
        <AnalogClock
          time={display.time}
          showSeconds={display.showSeconds}
          showNumerals={display.showNumerals}
        />
      );
    case 'calendar':
      return (
        <CalendarMonth
          year={display.year}
          monthIndex={display.monthIndex}
          highlightDay={display.highlightDay}
        />
      );
    case 'none':
      return null;
  }
}

/**
 * Cycles through a generated batch of questions one at a time, using the
 * real widgets (AnalogClock, CalendarMonth, ChoiceGrid, NumberEntry) rather
 * than a text gloss — so the question engine's output is visible the way
 * it'll actually be presented in the game, without `Climb.tsx`'s full
 * boost/fall-risk/HUD state machine (deliberately lighter-weight than that
 * screen, not a stand-in for it). Choosing an option or checking a typed
 * number, setting the clock hands, or picking a calendar date reveals
 * whether it was correct, but — since there's no climb/scoring here —
 * Enter (or Next) always advances regardless of whether an answer was
 * given at all. Deliberately reachable in production: this is what
 * deploys to GitHub Pages today, so progress on the question engine is
 * visible without a local checkout.
 */
export default function PreviewPlayer({ initialSeed }: { initialSeed?: number }) {
  const [difficulty, setDifficulty] = useState(3);
  const [peakId, setPeakId] = useState(PEAKS[0].id);
  const [seed, setSeed] = useState(() => initialSeed ?? Date.now());
  const [index, setIndex] = useState(0);

  const batch = generateQuestionBatch(seed, peakId, difficulty);
  const question = batch[index];

  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(undefined);
  const [draftNumber, setDraftNumber] = useState<number | ''>('');
  const [numberRevealed, setNumberRevealed] = useState(false);
  const [draftTime, setDraftTime] = useState<TimeOfDay>(() => draftTimeFor(question));
  const [handsRevealed, setHandsRevealed] = useState(false);
  const [pickDateCorrect, setPickDateCorrect] = useState<boolean | undefined>(undefined);

  /** Every answer-related bit of state is scoped to "the current question",
   * so every place that moves to a different one resets them all together
   * here — passing the question being moved *to* explicitly, since `batch`
   * (and so `question`) is recomputed fresh every render rather than read
   * back after the state change that produces it. */
  function resetAnswerState(next: Question) {
    setSelectedIndex(undefined);
    setDraftNumber('');
    setNumberRevealed(false);
    setDraftTime(draftTimeFor(next));
    setHandsRevealed(false);
    setPickDateCorrect(undefined);
  }

  function advance() {
    if (index + 1 < batch.length) {
      resetAnswerState(batch[index + 1]);
      setIndex(index + 1);
    } else {
      const nextSeed = seed + 1;
      resetAnswerState(generateQuestionBatch(nextSeed, peakId, difficulty)[0]);
      setSeed(nextSeed);
      setIndex(0);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter') return;
      if (event.target instanceof HTMLSelectElement) return;
      advance();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function renderAnswerSection(answer: AnswerSpec) {
    switch (answer.kind) {
      case 'choice':
        return (
          <ChoiceGrid
            options={answer.options}
            selectedIndex={selectedIndex}
            correctIndex={selectedIndex !== undefined ? answer.correctIndex : undefined}
            onSelect={setSelectedIndex}
          />
        );
      case 'number':
        return (
          <div data-testid="preview-number-answer">
            <NumberEntry value={draftNumber} onChange={setDraftNumber} unit={answer.unit} />
            <button
              type="button"
              data-testid="preview-check"
              disabled={draftNumber === ''}
              onClick={() => setNumberRevealed(true)}
            >
              Check
            </button>
            {numberRevealed && (
              <p data-testid="preview-number-result">
                {draftNumber === answer.target
                  ? 'Correct!'
                  : `Not quite — the answer is ${answer.target}${answer.unit ? ` ${answer.unit}` : ''}.`}
              </p>
            )}
          </div>
        );
      case 'setHands':
        return (
          <div data-testid="preview-set-hands">
            <AnalogClock
              time={draftTime}
              precision={answer.precision}
              onHandChange={setDraftTime}
            />
            <button
              type="button"
              data-testid="preview-check"
              onClick={() => setHandsRevealed(true)}
            >
              Check
            </button>
            {handsRevealed && (
              <p data-testid="preview-hands-result">
                {isCorrectSetHands(answer, draftTime) ? 'Correct!' : 'Not quite — try again.'}
              </p>
            )}
          </div>
        );
      case 'pickDate':
        return (
          <div data-testid="preview-pick-date">
            <DatePicker
              initialYear={answer.year}
              initialMonthIndex={answer.monthIndex}
              onChange={(date) => setPickDateCorrect(isCorrectPickDate(answer, date))}
            />
            {pickDateCorrect !== undefined && (
              <p data-testid="preview-pickdate-result">
                {pickDateCorrect ? 'Correct!' : 'Not quite — try again.'}
              </p>
            )}
          </div>
        );
    }
  }

  return (
    <main>
      <h1>Timescaler — question preview</h1>
      <p>
        Work in progress: this previews what the question engine produces, using the real answer
        widgets. Pick an option to see whether it's correct, then press <kbd>Enter</kbd> (or tap
        Next) to move on — advancing doesn't require answering, since there's no scoring here yet.
      </p>
      <p>
        This preview always shows one of every question type per batch, regardless of peak —
        deliberately, so every generator stays inspectable no matter which peak you pick. Real
        gameplay is exclusive instead: a peak only ever draws its own matching generator(s) (see
        each peak's emphasis below), and the difficulty further skews which answer modes show up
        among those. Changing Peak here reseeds the batch, so the specific values shown change, but
        not which types appear.
      </p>

      <p>
        <label htmlFor="preview-difficulty">Difficulty</label>{' '}
        <select
          id="preview-difficulty"
          data-testid="preview-difficulty"
          value={difficulty}
          onChange={(event) => {
            const nextDifficulty = Number(event.target.value);
            resetAnswerState(generateQuestionBatch(seed, peakId, nextDifficulty)[0]);
            setDifficulty(nextDifficulty);
            setIndex(0);
          }}
        >
          {DIFFICULTIES.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>{' '}
        <label htmlFor="preview-peak">Peak</label>{' '}
        <select
          id="preview-peak"
          data-testid="preview-peak"
          value={peakId}
          onChange={(event) => {
            const nextPeakId = Number(event.target.value);
            resetAnswerState(generateQuestionBatch(seed, nextPeakId, difficulty)[0]);
            setPeakId(nextPeakId);
            setIndex(0);
          }}
        >
          {PEAKS.map((peak) => (
            <option key={peak.id} value={peak.id}>
              {peak.id}. {peak.name} — {peak.emphasis}
            </option>
          ))}
        </select>{' '}
        <button
          type="button"
          onClick={() => {
            const nextSeed = seed + 1;
            resetAnswerState(generateQuestionBatch(nextSeed, peakId, difficulty)[0]);
            setSeed(nextSeed);
            setIndex(0);
          }}
        >
          Regenerate
        </button>
      </p>

      <p data-testid="preview-progress">
        Question {index + 1} of {batch.length}
      </p>

      <article data-testid="preview-card">
        <h2>{question.typeId}</h2>
        <p>
          <code data-testid="preview-id">{question.id}</code>
        </p>
        <p data-testid="preview-prompt">{question.prompt}</p>
        <div data-testid="preview-display">{renderDisplay(question.display)}</div>
        {renderAnswerSection(question.answer)}
        <p data-testid="preview-explain">{question.explainCorrect}</p>
      </article>

      <button type="button" data-testid="preview-next" onClick={advance}>
        Next (Enter)
      </button>
    </main>
  );
}
