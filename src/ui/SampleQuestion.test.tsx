import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SampleQuestion from './SampleQuestion';
import type { Question } from '../engine/questions';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'test-1',
    typeId: 'readAnalog',
    prompt: 'What time does the clock show?',
    display: {
      kind: 'analogClock',
      time: { hour: 8, minute: 30, second: 0 },
      showSeconds: false,
      showNumerals: true,
    },
    answer: { kind: 'choice', options: ['5:30', '6:30', '8:30', '9:00'], correctIndex: 2 },
    timeLimitMs: 26000,
    explainCorrect: 'The clock shows 8:30.',
    ...overrides,
  };
}

describe('SampleQuestion', () => {
  it('shows the prompt and explanation', () => {
    render(<SampleQuestion question={makeQuestion()} />);
    expect(screen.getByTestId('sample-question-prompt')).toHaveTextContent(
      'What time does the clock show?',
    );
    expect(screen.getByTestId('sample-question-explain')).toHaveTextContent(
      'The clock shows 8:30.',
    );
  });

  it('renders an analog clock for an analogClock display', () => {
    render(<SampleQuestion question={makeQuestion()} />);
    expect(screen.getByTestId('analog-clock')).toBeInTheDocument();
  });

  it('renders a calendar for a calendar display', () => {
    const question = makeQuestion({
      display: { kind: 'calendar', year: 2026, monthIndex: 0, highlightDay: 23 },
      answer: {
        kind: 'choice',
        options: ['Sunday', 'Wednesday', 'Friday', 'Saturday'],
        correctIndex: 2,
      },
    });
    render(<SampleQuestion question={question} />);
    expect(screen.getByTestId('calendar-month')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-day-highlighted')).toHaveTextContent('23');
  });

  it('renders no display widget when display is "none"', () => {
    const question = makeQuestion({
      display: { kind: 'none' },
      prompt: 'If today is Wednesday, what day will it be in 10 days?',
    });
    render(<SampleQuestion question={question} />);
    expect(screen.queryByTestId('analog-clock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calendar-month')).not.toBeInTheDocument();
  });

  it('reveals the correct choice, disabled, for a choice answer', () => {
    render(<SampleQuestion question={makeQuestion()} />);
    const grid = screen.getByTestId('choice-grid');
    const correct = within(grid).getByTestId('choice-option-2');
    expect(correct).toHaveAttribute('data-state', 'correct');
    expect(correct).toBeDisabled();
    for (const btn of within(grid).getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });

  it('renders a read-only clock at the target for a setHands answer', () => {
    const question = makeQuestion({
      typeId: 'setHands',
      prompt: 'Set the clock to 3:15.',
      display: { kind: 'none' },
      answer: { kind: 'setHands', target: { hour: 3, minute: 15, second: 0 }, precision: 'five' },
      explainCorrect: 'The clock should show 3:15.',
    });
    render(<SampleQuestion question={question} />);
    const clock = screen.getByTestId('analog-clock');
    expect(clock).toBeInTheDocument();
    // Non-interactive: no button pad without onHandChange, and the hands show the target.
    expect(screen.queryByTestId('clock-pad')).not.toBeInTheDocument();
    expect(screen.getByTestId('analog-clock-hour-hand')).toHaveAttribute('data-hour', '3');
    expect(screen.getByTestId('analog-clock-minute-hand')).toHaveAttribute('data-minute', '15');
  });

  it('renders a disabled, pre-filled NumberEntry for a number answer', () => {
    const question = makeQuestion({
      typeId: 'elapsedBetween',
      prompt: "It's 3:00. It becomes 3:45. How many minutes have passed?",
      display: { kind: 'none' },
      answer: { kind: 'number', target: 45, unit: 'minutes' },
      explainCorrect: 'From 3:00 to 3:45 is 45 minutes.',
    });
    render(<SampleQuestion question={question} />);
    const input = screen.getByTestId('number-entry-input');
    expect(input).toHaveValue(45);
    expect(input).toBeDisabled();
    expect(screen.getByTestId('number-entry-unit')).toHaveTextContent('minutes');
  });

  it('renders a read-only calendar highlighting the target day for a pickDate answer', () => {
    const question = makeQuestion({
      typeId: 'nthWeekday',
      prompt: 'What date is the 3rd Tuesday of March 2026?',
      display: { kind: 'none' },
      answer: { kind: 'pickDate', year: 2026, monthIndex: 2, day: 17 },
      explainCorrect: 'The 3rd Tuesday of March 2026 is March 17.',
    });
    render(<SampleQuestion question={question} />);
    expect(screen.getByTestId('calendar-month')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-day-highlighted')).toHaveTextContent('17');
    // Non-interactive: day cells render as plain divs, not buttons.
    expect(screen.queryByRole('button', { name: '17' })).not.toBeInTheDocument();
  });
});
