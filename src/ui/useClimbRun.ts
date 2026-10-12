import { useEffect, useRef, useState } from 'react';
import {
  applyCorrect,
  applyMiss,
  createClimb,
  isFastAnswer,
  type ClimbState,
} from '../engine/climb';
import type { Peak } from '../engine/peaks';
import {
  generateQuestion,
  isCorrectChoice,
  isCorrectNumber,
  isCorrectPickDate,
  isCorrectSetHands,
  type Question,
} from '../engine/questions';
import { mulberry32 } from '../engine/rng';
import type { TimeOfDay } from '../engine/timeMath';
import { describeMove, type ClimbMove } from '../scene/climb/motion';
import { defaultSetHandsDraft } from './questionDisplay';

/** The ~1.5 s post-answer beat from the design spec, applied to every answer
 * so the reveal and the climber's move have the same room either way. */
export const REVEAL_MS = 1500;
const TICK_MS = 100;

const NOON: TimeOfDay = { hour: 12, minute: 0, second: 0 };

/** `defaultSetHandsDraft` needs a target; non-`setHands` questions never
 * render the draft, so this always-PM fallback is never shown. */
function defaultDraftTime(question: Question): TimeOfDay {
  return question.answer.kind === 'setHands' ? defaultSetHandsDraft(question.answer.target) : NOON;
}

export interface PickedDate {
  year: number;
  monthIndex: number;
  day: number;
}

export interface ClimbRunOptions {
  peak: Peak;
  difficulty: number;
  /** Caller-supplied so a retry after falling isn't byte-identical to the failed run. */
  seed: number;
  onSummit: (finalState: ClimbState, elapsedMs: number) => void;
  onFall: (finalState: ClimbState, elapsedMs: number) => void;
  /** Reported after every answer (timeouts count as incorrect), regardless of outcome. */
  onQuestionAnswered?: (typeId: string, correct: boolean, elapsedMs: number) => void;
}

export interface ClimbRun {
  climbState: ClimbState;
  question: Question;
  selectedIndex: number | undefined;
  draftTime: TimeOfDay;
  setDraftTime: (next: TimeOfDay) => void;
  draftNumber: number | '';
  setDraftNumber: (next: number | '') => void;
  revealing: boolean;
  timeLeftMs: number;
  /** The last move the rules produced, for the scene and the sound. */
  move: ClimbMove | null;
  answerChoice: (index: number | undefined) => void;
  submitSetHands: () => void;
  submitNumber: () => void;
  pickDate: (date: PickedDate) => void;
  /** Milliseconds since the climb started. */
  elapsedMs: () => number;
}

/**
 * The core gameplay loop, lifted out of the old `Climb.tsx` so it can be
 * tested in jsdom without a WebGL canvas: generate a question, let the
 * player answer (or time out), apply the result to `climb.ts`, show a reveal
 * beat, then summit, fall, or move on. All four `AnswerSpec` kinds route
 * through the same `finishAnswer`; only capture and grading differ.
 */
export function useClimbRun({
  peak,
  difficulty,
  seed,
  onSummit,
  onFall,
  onQuestionAnswered,
}: ClimbRunOptions): ClimbRun {
  const [rng] = useState(() => mulberry32(seed));
  const [climbState, setClimbState] = useState<ClimbState>(() => createClimb(peak, difficulty));
  const [question, setQuestion] = useState<Question>(() =>
    generateQuestion(rng, { difficulty, peak }),
  );
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(undefined);
  const [draftTime, setDraftTime] = useState<TimeOfDay>(() => defaultDraftTime(question));
  const [draftNumber, setDraftNumber] = useState<number | ''>('');
  const [revealing, setRevealing] = useState(false);
  const [move, setMove] = useState<ClimbMove | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(question.timeLimitMs);

  // `Date.now()` is impure, so both start times are set from a mount-only
  // effect rather than a `useRef(Date.now())` initializer.
  const questionStartRef = useRef(0);
  const climbStartRef = useRef(0);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const moveCount = useRef(0);

  useEffect(() => {
    const now = Date.now();
    questionStartRef.current = now;
    climbStartRef.current = now;
    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, []);

  const answer = question.answer;

  function finishAnswer(correct: boolean, elapsedMs: number) {
    const fast = isFastAnswer(elapsedMs, question.timeLimitMs);
    const nextState = correct ? applyCorrect(climbState, fast) : applyMiss(climbState);
    moveCount.current += 1;

    setRevealing(true);
    setMove(describeMove(climbState, nextState, fast, moveCount.current));
    setClimbState(nextState);
    onQuestionAnswered?.(question.typeId, correct, elapsedMs);

    revealTimeoutRef.current = setTimeout(() => {
      if (nextState.status === 'summited') {
        onSummit(nextState, Date.now() - climbStartRef.current);
        return;
      }
      if (nextState.status === 'fell') {
        onFall(nextState, Date.now() - climbStartRef.current);
        return;
      }
      const nextQuestion = generateQuestion(rng, { difficulty, peak });
      questionStartRef.current = Date.now();
      setQuestion(nextQuestion);
      setTimeLeftMs(nextQuestion.timeLimitMs);
      setSelectedIndex(undefined);
      setDraftTime(defaultDraftTime(nextQuestion));
      setDraftNumber('');
      setRevealing(false);
    }, REVEAL_MS);
  }

  function handleTimeout() {
    if (revealing) return;
    finishAnswer(false, Date.now() - questionStartRef.current);
  }

  // Ticks the countdown; the timeout path fires from inside the interval
  // callback (async), never synchronously from an effect body.
  useEffect(() => {
    if (revealing) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - questionStartRef.current;
      const remaining = Math.max(0, question.timeLimitMs - elapsed);
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleTimeout();
      }
    }, TICK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealing, question]);

  function answerChoice(index: number | undefined) {
    if (revealing || answer.kind !== 'choice') return;
    const elapsedMs = Date.now() - questionStartRef.current;
    const correct = index !== undefined && isCorrectChoice(answer, index);
    setSelectedIndex(index);
    finishAnswer(correct, elapsedMs);
  }

  function submitSetHands() {
    if (revealing || answer.kind !== 'setHands') return;
    finishAnswer(isCorrectSetHands(answer, draftTime), Date.now() - questionStartRef.current);
  }

  function submitNumber() {
    if (revealing || answer.kind !== 'number' || draftNumber === '') return;
    finishAnswer(isCorrectNumber(answer, draftNumber), Date.now() - questionStartRef.current);
  }

  function pickDate(date: PickedDate) {
    if (revealing || answer.kind !== 'pickDate') return;
    finishAnswer(isCorrectPickDate(answer, date), Date.now() - questionStartRef.current);
  }

  return {
    climbState,
    question,
    selectedIndex,
    draftTime,
    setDraftTime,
    draftNumber,
    setDraftNumber,
    revealing,
    timeLeftMs,
    move,
    answerChoice,
    submitSetHands,
    submitNumber,
    pickDate,
    elapsedMs: () => Date.now() - climbStartRef.current,
  };
}
