import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Climb, { REVEAL_MS } from './Climb';
import { CHARACTER_PRESETS } from '../character/presets';
import type { Peak } from '../../engine/peaks';
import { generateQuestion, type Question } from '../../engine/questions';

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

const preset = CHARACTER_PRESETS[0];
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
        characterPreset={preset}
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

  it('calls onSummit once enough correct answers reach the peak height', () => {
    const onSummit = vi.fn();
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        characterPreset={preset}
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
        characterPreset={preset}
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
        characterPreset={preset}
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
        characterPreset={preset}
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
        characterPreset={preset}
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

  it('drops the climber back down the stage and kicks up dust after a miss', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        characterPreset={preset}
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    answerCorrect();
    expect(screen.getByTestId('climb-stage').style.getPropertyValue('--climb-progress')).toBe(
      String(1 / 3),
    );

    fireEvent.click(screen.getByTestId('choice-option-1'));
    expect(screen.getByTestId('climb-stage-climber')).toHaveAttribute('data-move', 'drop');
    expect(screen.getAllByTestId('climb-stage-dust')).toHaveLength(3);
    // The engine really moved the climber back, and the stage really follows it.
    expect(screen.getByTestId('climb-stage').style.getPropertyValue('--climb-progress')).toBe('0');

    act(() => {
      vi.advanceTimersByTime(REVEAL_MS);
    });
    expect(screen.getByTestId('climb-stage-climber')).toHaveAttribute('data-move', 'none');
    expect(screen.queryAllByTestId('climb-stage-dust')).toHaveLength(0);
  });

  it('hops instead of dropping after a correct answer, and moves the climber up', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        characterPreset={preset}
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('choice-option-0'));
    // An instant answer under fake timers is "fast", which earns the bigger hop.
    expect(screen.getByTestId('climb-stage-climber')).toHaveAttribute('data-move', 'bigHop');
    expect(screen.queryAllByTestId('climb-stage-dust')).toHaveLength(0);
    expect(screen.getByTestId('climb-stage').style.getPropertyValue('--climb-progress')).toBe(
      String(1 / 3),
    );
  });

  it('shows the boost glow once the meter is full, and loses it on a miss', () => {
    const tallPeak: Peak = { id: 98, name: 'Tall Peak', emphasis: 'Testing', height: 30 };
    const { container } = render(
      <Climb
        peak={tallPeak}
        difficulty={5}
        characterPreset={preset}
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
      />,
    );
    expect(container.querySelector('.climb-stage__glow')).toBeNull();
    // Three instant (fast, +2) answers fill the 5-pip meter.
    answerCorrect();
    answerCorrect();
    answerCorrect();
    expect(container.querySelector('.climb-stage__glow')).not.toBeNull();

    answerWrong();
    expect(container.querySelector('.climb-stage__glow')).toBeNull();
  });

  it('reports every answer via onQuestionAnswered, including correctness and elapsed time', () => {
    const onQuestionAnswered = vi.fn();
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        characterPreset={preset}
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
        characterPreset={preset}
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

  it('increments the boost meter on a correct answer and resets it on a miss', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        characterPreset={preset}
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
    expect(screen.queryAllByTestId('boost-pip-filled')).toHaveLength(0);
  });

  it('gives only +1 boost for a correct answer past the halfway point of the timer', () => {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        characterPreset={preset}
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

describe('Climb — setHands answer kind', () => {
  const CENTER = 129; // AnalogClock's default target size (260) snaps to actualSize 258.
  const RADIUS = 50;
  const RECT = {
    left: 0,
    top: 0,
    width: CENTER * 2,
    height: CENTER * 2,
    right: CENTER * 2,
    bottom: CENTER * 2,
    x: 0,
    y: 0,
    toJSON: () => {},
  } as DOMRect;

  beforeEach(() => {
    vi.mocked(generateQuestion).mockReturnValue(SET_HANDS_QUESTION);
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
  });

  function renderClimb(onQuestionAnswered = vi.fn()) {
    render(
      <Climb
        peak={shortPeak}
        difficulty={5}
        characterPreset={preset}
        seed={1}
        onSummit={vi.fn()}
        onFall={vi.fn()}
        onBail={vi.fn()}
        onQuestionAnswered={onQuestionAnswered}
      />,
    );
    return onQuestionAnswered;
  }

  it('renders an interactive AnalogClock and a Submit button', () => {
    renderClimb();
    expect(screen.getByTestId('analog-clock')).toBeInTheDocument();
    expect(screen.getByTestId('analog-clock-minute-hand')).toBeInTheDocument();
    expect(screen.getByTestId('climb-submit')).toBeInTheDocument();
  });

  it('submitting without dragging (the default noon) misses against a different target', () => {
    const onQuestionAnswered = renderClimb();
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testSetHands', false, expect.any(Number));
  });

  it('dragging both hands to the target and submitting grades correct', () => {
    const onQuestionAnswered = renderClimb();
    // Minute hand to the "3" position -> snaps to minute 15 at quarter precision.
    fireEvent.pointerDown(screen.getByTestId('analog-clock-minute-hand'), {
      clientX: CENTER + RADIUS,
      clientY: CENTER,
      pointerId: 1,
    });
    // Hour hand to the "3" position -> hour 15, preserving the default's PM half.
    fireEvent.pointerDown(screen.getByTestId('analog-clock-hour-hand'), {
      clientX: CENTER + RADIUS,
      clientY: CENTER,
      pointerId: 1,
    });
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testSetHands', true, expect.any(Number));
  });

  it("an AM target is reachable too — the default draft starts in the target's own half", () => {
    vi.mocked(generateQuestion).mockReturnValue(SET_HANDS_QUESTION_AM);
    const onQuestionAnswered = renderClimb();
    // Minute hand to the "3" position -> snaps to minute 15 at quarter precision.
    fireEvent.pointerDown(screen.getByTestId('analog-clock-minute-hand'), {
      clientX: CENTER + RADIUS,
      clientY: CENTER,
      pointerId: 1,
    });
    // Hour hand to the "3" position -> hour 3, preserving the default's AM half
    // (midnight, since the target itself is AM) — this is exactly the case that
    // was unreachable before `defaultDraftTime` matched the target's half.
    fireEvent.pointerDown(screen.getByTestId('analog-clock-hour-hand'), {
      clientX: CENTER + RADIUS,
      clientY: CENTER,
      pointerId: 1,
    });
    fireEvent.click(screen.getByTestId('climb-submit'));
    expect(onQuestionAnswered).toHaveBeenCalledWith('testSetHands', true, expect.any(Number));
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
        characterPreset={preset}
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
        characterPreset={preset}
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
