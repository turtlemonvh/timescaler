import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Climb from './Climb';
import type { Peak } from '../../engine/peaks';
import { generateQuestion, type Question } from '../../engine/questions';

// Matches Climb.tsx's internal REVEAL_MS — kept as a separate constant here
// since the component doesn't export it.
const REVEAL_MS = 1500;

const FIXED_QUESTION: Question = {
  id: 'test-question',
  typeId: 'testType',
  prompt: 'What is the answer?',
  display: { kind: 'none' },
  answer: { kind: 'choice', options: ['Right', 'Wrong'], correctIndex: 0 },
  timeLimitMs: 5000,
  explainCorrect: 'Because Right is right.',
};

// No registered generator produces pickDate yet, so that one fixture is
// hand-built the same way FIXED_QUESTION is. setHands and number now have
// real generators (setHands.ts, elapsedBetween.ts), but these fixtures are
// still used so Climb.tsx's rendering/grading is pinned to exact,
// hand-picked values independent of generator internals.
// Target is PM (hour 15, not 3): `Climb.tsx`'s `defaultDraftTime` starts the
// draft in the *same* AM/PM half as the target (noon for PM, midnight for
// AM) precisely so both halves are reachable — see the AM fixture below,
// which exercises the other half.
const SET_HANDS_QUESTION: Question = {
  id: 'test-sethands',
  typeId: 'testSetHands',
  prompt: 'Set the clock to 3:15 PM',
  display: { kind: 'none' },
  answer: { kind: 'setHands', target: { hour: 15, minute: 15, second: 0 }, precision: 'quarter' },
  timeLimitMs: 5000,
  explainCorrect: 'The clock should show 3:15 PM.',
};

const SET_HANDS_QUESTION_AM: Question = {
  id: 'test-sethands-am',
  typeId: 'testSetHands',
  prompt: 'Set the clock to 3:15 AM',
  display: { kind: 'none' },
  answer: { kind: 'setHands', target: { hour: 3, minute: 15, second: 0 }, precision: 'quarter' },
  timeLimitMs: 5000,
  explainCorrect: 'The clock should show 3:15 AM.',
};

const NUMBER_QUESTION: Question = {
  id: 'test-number',
  typeId: 'testNumber',
  prompt: 'How many minutes between 2:00 and 2:45?',
  display: { kind: 'none' },
  answer: { kind: 'number', target: 45, unit: 'minutes' },
  timeLimitMs: 5000,
  explainCorrect: 'The answer is 45 minutes.',
};

const PICK_DATE_QUESTION: Question = {
  id: 'test-pickdate',
  typeId: 'testPickDate',
  prompt: 'What is the 3rd Tuesday of June 2026?',
  display: { kind: 'none' },
  answer: { kind: 'pickDate', year: 2026, monthIndex: 5, day: 16 },
  timeLimitMs: 5000,
  explainCorrect: 'The 3rd Tuesday of June 2026 is June 16.',
};

vi.mock('../../engine/questions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../engine/questions')>();
  return { ...actual, generateQuestion: vi.fn(() => FIXED_QUESTION) };
});

const shortPeak: Peak = { id: 99, name: 'Test Peak', emphasis: 'Testing', height: 3 };

function answerCorrect() {
  fireEvent.click(screen.getByTestId('choice-option-0'));
  act(() => {
    vi.advanceTimersByTime(REVEAL_MS);
  });
}

function answerWrong() {
  fireEvent.click(screen.getByTestId('choice-option-1'));
  act(() => {
    vi.advanceTimersByTime(REVEAL_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(generateQuestion).mockReturnValue(FIXED_QUESTION);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Climb', () => {
  it('renders the prompt and choice options', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    expect(screen.getByTestId('climb-prompt')).toHaveTextContent('What is the answer?');
    expect(screen.getByTestId('choice-option-0')).toHaveTextContent('Right');
    expect(screen.getByTestId('choice-option-1')).toHaveTextContent('Wrong');
  });

  it('climbs half the peak at level 5 and all of it at level 8 (issue #131)', () => {
    const tallPeak: Peak = { ...shortPeak, height: 20 };
    const renderAt = (difficulty: number) =>
      render(
        <Climb
          peak={tallPeak}
          difficulty={difficulty}
          animalId="fox"
          seed={1}
          onSummit={vi.fn()}
          onFall={vi.fn()}
          onBail={vi.fn()}
        />,
      );
    const { unmount } = renderAt(5);
    expect(screen.getByTestId('climb-scene')).toHaveAttribute('data-height', '10');
    unmount();
    renderAt(8);
    expect(screen.getByTestId('climb-scene')).toHaveAttribute('data-height', '20');
  });

  it('calls onSummit once enough correct answers reach the peak height', () => {
    const onSummit = vi.fn();
    render(
      <Climb
        peak={shortPeak}
        difficulty={8}
        animalId="fox"
        seed={1}
        onSummit={onSummit}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    answerCorrect();
    expect(onSummit).not.toHaveBeenCalled();
    answerCorrect();
    expect(onSummit).not.toHaveBeenCalled();
    answerCorrect();
    expect(onSummit).toHaveBeenCalledTimes(1);
    const [finalState, elapsedMs] = onSummit.mock.calls[0];
    expect(finalState.status).toBe('summited');
    expect(finalState.position).toBe(3);
    expect(typeof elapsedMs).toBe('number');
  });

  it('calls onFall once misses exceed the fall-risk capacity', () => {
    const onFall = vi.fn();
    // Difficulty 1-3 -> fallRiskCapacity 5, so 6 misses fall.
    render(
      <Climb
        peak={shortPeak}
        difficulty={1}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={onFall}
        onBail={vi.fn()}
      />,
    );
    for (let i = 0; i < 5; i++) {
      answerWrong();
      expect(onFall).not.toHaveBeenCalled();
    }
    answerWrong();
    expect(onFall).toHaveBeenCalledTimes(1);
    expect(onFall.mock.calls[0][0].status).toBe('fell');
    expect(typeof onFall.mock.calls[0][1]).toBe('number');
  });

  it('calls onBail with the elapsed time when Bail is clicked, without touching onSummit/onFall', () => {
    const onSummit = vi.fn();
    const onFall = vi.fn();
    const onBail = vi.fn();
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={onSummit}
        onFall={onFall}
        onBail={onBail}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1234);
    });
    fireEvent.click(screen.getByTestId('climb-bail'));
    expect(onBail).toHaveBeenCalledTimes(1);
    expect(onBail).toHaveBeenCalledWith(expect.any(Number));
    expect(onBail.mock.calls[0][0]).toBeGreaterThanOrEqual(1234);
    expect(onSummit).not.toHaveBeenCalled();
    expect(onFall).not.toHaveBeenCalled();
  });

  it('disables Bail during the post-answer reveal beat', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    expect(screen.getByTestId('climb-bail')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('choice-option-0'));
    expect(screen.getByTestId('climb-bail')).toBeDisabled();
  });

  it('reveals the correct answer and disables the grid during the beat', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('choice-option-1'));
    expect(screen.getByTestId('choice-option-0')).toHaveAttribute('data-state', 'correct');
    expect(screen.getByTestId('choice-option-1')).toHaveAttribute('data-state', 'incorrect');
    expect(screen.getByTestId('choice-option-0')).toBeDisabled();
    expect(screen.getByTestId('climb-explain')).toHaveTextContent('Because Right is right.');
  });

  it('applies the slip animation and renders dust puffs during the reveal beat after a miss', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('choice-option-1'));
    expect(screen.getByTestId('climb-scene')).toHaveAttribute('data-move', 'slip');
    expect(screen.getByTestId('climb-move-label')).toHaveTextContent('Slipped!');

    act(() => {
      vi.advanceTimersByTime(REVEAL_MS);
    });
    // The move stays on the scene (it is the last thing that happened) but the
    // HUD label clears once the reveal beat ends.
    expect(screen.queryByTestId('climb-move-label')).not.toBeInTheDocument();
  });

  it('does not apply the slip animation after a correct answer', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('choice-option-0'));
    expect(screen.getByTestId('climb-scene')).toHaveAttribute('data-move', 'hop');
    expect(screen.getByTestId('climb-scene')).toHaveAttribute('data-position', '1');
    expect(screen.getByTestId('climb-move-label')).toHaveTextContent('Hop up!');
  });

  it('reports every answer via onQuestionAnswered, including correctness and elapsed time', () => {
    const onQuestionAnswered = vi.fn();
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
        onQuestionAnswered={onQuestionAnswered}
      />,
    );
    fireEvent.click(screen.getByTestId('choice-option-1'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testType', false, expect.any(Number));
  });

  it('auto-misses on timeout with no answer selected', () => {
    const onQuestionAnswered = vi.fn();
    render(
      <Climb
        peak={shortPeak}
        difficulty={1}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
        onQuestionAnswered={onQuestionAnswered}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(FIXED_QUESTION.timeLimitMs);
    });
    expect(onQuestionAnswered).toHaveBeenCalledWith('testType', false, expect.any(Number));
    expect(screen.getByTestId('choice-option-0')).toHaveAttribute('data-state', 'correct');
  });

  it('increments the boost meter on a correct answer and halves it on a miss', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    expect(screen.queryAllByTestId('boost-pip-filled')).toHaveLength(0);
    // An instant answer (0ms elapsed under fake timers) counts as "fast" -> +2 boost.
    answerCorrect();
    expect(screen.getAllByTestId('boost-pip-filled')).toHaveLength(2);
    answerWrong();
    // A miss halves boost (rounding down): 2 -> 1.
    expect(screen.getAllByTestId('boost-pip-filled')).toHaveLength(1);
  });

  it('gives only +1 boost for a correct answer past the halfway point of the timer', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    // Over half of the 5000ms time limit -> not "fast".
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    answerCorrect();
    expect(screen.getAllByTestId('boost-pip-filled')).toHaveLength(1);
  });
});

describe('Climb — portrait card layout (issue #113)', () => {
  // jsdom's matchMedia stub matches nothing, so Climb takes the docked
  // (portrait, bottom card) layout here.
  function renderWith(question: Question) {
    vi.mocked(generateQuestion).mockReturnValue(question);
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    return screen.getByTestId('choice-grid').style.gridTemplateColumns;
  }

  it('lays four short options out in two columns', () => {
    const columns = renderWith({
      ...FIXED_QUESTION,
      answer: { kind: 'choice', options: ['6:00', '7:00', '8:00', '9:00'], correctIndex: 1 },
    });
    expect(columns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('keeps one column when any of the four labels is long', () => {
    const columns = renderWith({
      ...FIXED_QUESTION,
      answer: {
        kind: 'choice',
        options: ['Tuesday, July 14, 2026', '7:00', '8:00', '9:00'],
        correctIndex: 1,
      },
    });
    expect(columns).toContain('auto-fit');
  });

  it('leaves a two-option question on the auto-fit grid', () => {
    expect(renderWith(FIXED_QUESTION)).toContain('auto-fit');
  });
});

describe('Climb — setHands answer kind', () => {
  beforeEach(() => {
    vi.mocked(generateQuestion).mockReturnValue(SET_HANDS_QUESTION);
  });

  function renderClimb(onQuestionAnswered = vi.fn()) {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
        onQuestionAnswered={onQuestionAnswered}
      />,
    );
    return onQuestionAnswered;
  }

  function press(testId: string, times: number) {
    for (let i = 0; i < times; i++) fireEvent.click(screen.getByTestId(testId));
  }

  it('renders an interactive AnalogClock with its button pad and a Submit button', () => {
    renderClimb();
    expect(screen.getByTestId('analog-clock')).toBeInTheDocument();
    expect(screen.getByTestId('clock-step-hour-forward')).toBeEnabled();
    expect(screen.getByTestId('clock-step-minute-forward')).toBeEnabled();
    expect(screen.getByTestId('climb-submit')).toBeInTheDocument();
  });

  it('submitting without setting the hands (the default noon) misses against a different target', () => {
    const onQuestionAnswered = renderClimb();
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testSetHands', false, expect.any(Number));
  });

  it('pressing the buttons to the target and submitting grades correct', () => {
    const onQuestionAnswered = renderClimb();
    // Noon -> 3 PM with three hour presses, then :15 with one quarter-hour press.
    press('clock-step-hour-forward', 3);
    press('clock-step-minute-forward', 1);
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testSetHands', true, expect.any(Number));
  });

  it('minutes carry into the hour: 3:15 PM reached by minute presses alone', () => {
    const onQuestionAnswered = renderClimb();
    // 13 quarter-hour presses from noon: 12:00 -> 3:15 PM.
    press('clock-step-minute-forward', 13);
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testSetHands', true, expect.any(Number));
  });

  it("an AM target is reachable too — the default draft starts in the target's own half", () => {
    vi.mocked(generateQuestion).mockReturnValue(SET_HANDS_QUESTION_AM);
    const onQuestionAnswered = renderClimb();
    // Midnight -> 3:15 AM going backwards round the face: 9 hours back, then
    // :15 — the hour arrows never cross into PM.
    press('clock-step-hour-back', 9);
    press('clock-step-minute-forward', 1);
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testSetHands', true, expect.any(Number));
  });

  it('keeps the pad on screen but disabled during the reveal', () => {
    renderClimb();
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(screen.getByTestId('clock-pad')).toBeInTheDocument();
    expect(screen.getByTestId('clock-step-minute-forward')).toBeDisabled();
    expect(screen.getByTestId('clock-help')).toBeDisabled();
  });
});

describe('Climb — number answer kind', () => {
  beforeEach(() => {
    vi.mocked(generateQuestion).mockReturnValue(NUMBER_QUESTION);
  });

  function renderClimb(onQuestionAnswered = vi.fn()) {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
        onQuestionAnswered={onQuestionAnswered}
      />,
    );
    return onQuestionAnswered;
  }

  it('renders a NumberEntry and a Submit button, disabled until a value is entered', () => {
    renderClimb();
    expect(screen.getByTestId('number-entry-input')).toBeInTheDocument();
    expect(screen.getByTestId('number-entry-unit')).toHaveTextContent('minutes');
    expect(screen.getByTestId('climb-submit')).toBeDisabled();
  });

  it('submitting the correct number grades correct', () => {
    const onQuestionAnswered = renderClimb();
    fireEvent.change(screen.getByTestId('number-entry-input'), { target: { value: '45' } });
    expect(screen.getByTestId('climb-submit')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testNumber', true, expect.any(Number));
  });

  it('submitting a wrong number misses', () => {
    const onQuestionAnswered = renderClimb();
    fireEvent.change(screen.getByTestId('number-entry-input'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testNumber', false, expect.any(Number));
  });

  // Issue #168: return on the phone keyboard did nothing.
  it('pressing Enter in the field submits, like the Submit button', async () => {
    vi.useRealTimers(); // user-event awaits real timers between keystrokes
    const user = userEvent.setup();
    const onQuestionAnswered = renderClimb();
    await user.type(screen.getByTestId('number-entry-input'), '45{Enter}');
    expect(onQuestionAnswered).toHaveBeenCalledTimes(1);
    expect(onQuestionAnswered).toHaveBeenCalledWith('testNumber', true, expect.any(Number));
  });

  it('pressing Enter with a wrong number misses', async () => {
    vi.useRealTimers(); // user-event awaits real timers between keystrokes
    const user = userEvent.setup();
    const onQuestionAnswered = renderClimb();
    await user.type(screen.getByTestId('number-entry-input'), '10{Enter}');
    expect(onQuestionAnswered).toHaveBeenCalledWith('testNumber', false, expect.any(Number));
  });

  it('pressing Enter on an empty field does nothing', async () => {
    vi.useRealTimers(); // user-event awaits real timers between keystrokes
    const user = userEvent.setup();
    const onQuestionAnswered = renderClimb();
    await user.type(screen.getByTestId('number-entry-input'), '{Enter}');
    // Typed then cleared counts as empty too.
    await user.type(screen.getByTestId('number-entry-input'), '7{Backspace}{Enter}');
    expect(onQuestionAnswered).not.toHaveBeenCalled();
    expect(screen.getByTestId('climb-submit')).toBeDisabled();
    expect(screen.queryByTestId('climb-explain')).not.toBeInTheDocument();
  });

  it('a second Enter while the answer is revealed does not answer twice', async () => {
    vi.useRealTimers(); // user-event awaits real timers between keystrokes
    const user = userEvent.setup();
    const onQuestionAnswered = renderClimb();
    await user.type(screen.getByTestId('number-entry-input'), '45{Enter}{Enter}');
    expect(onQuestionAnswered).toHaveBeenCalledTimes(1);
  });

  it('wraps the field in a form whose submit button is Submit', () => {
    renderClimb();
    const form = screen.getByTestId('climb-number');
    expect(form.tagName).toBe('FORM');
    expect(screen.getByTestId('climb-submit')).toHaveAttribute('type', 'submit');
    expect(form).toContainElement(screen.getByTestId('number-entry-input'));
  });
});

describe('Climb — pickDate answer kind', () => {
  beforeEach(() => {
    vi.mocked(generateQuestion).mockReturnValue(PICK_DATE_QUESTION);
  });

  function renderClimb(onQuestionAnswered = vi.fn()) {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        animalId="fox"
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
        onQuestionAnswered={onQuestionAnswered}
      />,
    );
    return onQuestionAnswered;
  }

  function clickDay(day: number) {
    const cell = screen.getAllByTestId('calendar-day').find((el) => el.textContent === String(day));
    if (!cell) throw new Error(`no calendar day cell for ${day}`);
    fireEvent.click(cell);
  }

  it('renders a DatePicker opened on the target month, with no separate Submit button', () => {
    renderClimb();
    expect(screen.getByTestId('date-picker')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-month-select')).toHaveValue('5');
    expect(screen.getByTestId('calendar-year-select')).toHaveValue('2026');
    expect(screen.queryByTestId('climb-submit')).not.toBeInTheDocument();
  });

  it('clicking the target day immediately grades correct — a click is the whole gesture', () => {
    const onQuestionAnswered = renderClimb();
    clickDay(16);
    expect(onQuestionAnswered).toHaveBeenCalledWith('testPickDate', true, expect.any(Number));
  });

  it('clicking a different day immediately misses', () => {
    const onQuestionAnswered = renderClimb();
    clickDay(17);
    expect(onQuestionAnswered).toHaveBeenCalledWith('testPickDate', false, expect.any(Number));
  });
});
