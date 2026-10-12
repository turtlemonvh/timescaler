import type { Peak } from './peaks';

export type ClimbStatus = 'climbing' | 'summited' | 'fell';

export interface ClimbState {
  peakId: number;
  height: number;
  position: number;
  boost: number;
  boostCapacity: number;
  fallRisk: number;
  fallRiskCapacity: number;
  status: ClimbStatus;
}

const BOOST_CAPACITY = 5;

function fallRiskCapacityForDifficulty(difficulty: number): number {
  if (difficulty <= 3) return 5;
  if (difficulty <= 7) return 4;
  return 3;
}

export function createClimb(peak: Peak, difficulty: number): ClimbState {
  return {
    peakId: peak.id,
    height: peak.height,
    position: 0,
    boost: 0,
    boostCapacity: BOOST_CAPACITY,
    fallRisk: 0,
    fallRiskCapacity: fallRiskCapacityForDifficulty(difficulty),
    status: 'climbing',
  };
}

export function applyCorrect(state: ClimbState, fast: boolean): ClimbState {
  if (state.status !== 'climbing') return state;
  const speedMultiplier = state.boost >= state.boostCapacity ? 2 : 1;
  const position = Math.min(state.height, state.position + speedMultiplier);
  const boost = Math.min(state.boostCapacity, state.boost + (fast ? 2 : 1));
  const status: ClimbStatus = position >= state.height ? 'summited' : 'climbing';
  return { ...state, position, boost, status };
}

export function applyMiss(state: ClimbState): ClimbState {
  if (state.status !== 'climbing') return state;
  if (state.fallRisk >= state.fallRiskCapacity) {
    return { ...state, status: 'fell' };
  }
  return {
    ...state,
    position: Math.max(0, state.position - 1),
    boost: Math.floor(state.boost / 2),
    fallRisk: state.fallRisk + 1,
  };
}

/**
 * Whether a correct answer counts as "fast" for `applyCorrect`'s boost
 * bonus — answered in under half the question's time limit, per the design
 * spec. A tiny pure rule, but it belongs here rather than inlined in a UI
 * component: it's a game rule, not a rendering concern.
 */
export function isFastAnswer(elapsedMs: number, timeLimitMs: number): boolean {
  return elapsedMs < timeLimitMs / 2;
}
