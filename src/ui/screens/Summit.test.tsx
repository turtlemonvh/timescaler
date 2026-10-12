import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Summit, { type SummitProps } from './Summit';
import type { Peak } from '../../engine/peaks';

const peak: Peak = { id: 1, name: 'Basecamp Bluff', emphasis: 'Reading analog clocks', height: 20 };

function renderSummit(overrides: Partial<SummitProps> = {}) {
  return render(
    <Summit
      peak={peak}
      animalId="fox"
      elapsedMs={45000}
      tier="success"
      difficulty={3}
      onContinue={vi.fn()}
      {...overrides}
    />,
  );
}

describe('Summit', () => {
  it('shows the peak name', () => {
    renderSummit();
    expect(screen.getByRole('main')).toHaveTextContent('Basecamp Bluff');
  });

  it('formats a sub-minute time in seconds', () => {
    renderSummit({ elapsedMs: 45000 });
    expect(screen.getByTestId('summit-time')).toHaveTextContent('45s');
  });

  it('formats a time over a minute as minutes and seconds', () => {
    renderSummit({ elapsedMs: 92000 });
    expect(screen.getByTestId('summit-time')).toHaveTextContent('1m 32s');
  });

  it('rounds to the nearest second', () => {
    renderSummit({ elapsedMs: 45600 });
    expect(screen.getByTestId('summit-time')).toHaveTextContent('46s');
  });

  it('calls onContinue when clicked', () => {
    const onContinue = vi.fn();
    renderSummit({ onContinue });
    fireEvent.click(screen.getByTestId('summit-continue'));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  describe('celebration tiers', () => {
    it('"success" tier shows no ribbon, no badge, and no tier message', () => {
      renderSummit({ tier: 'success' });
      expect(screen.queryByTestId('summit-ribbon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('summit-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('summit-tier-message')).not.toBeInTheDocument();
    });

    it('"newBest" tier shows a ribbon and tier message, but no badge', () => {
      renderSummit({ tier: 'newBest' });
      expect(screen.getByTestId('summit-ribbon')).toHaveTextContent('NEW BEST!');
      expect(screen.queryByTestId('summit-badge')).not.toBeInTheDocument();
      expect(screen.getByTestId('summit-tier-message')).toHaveTextContent('New personal best!');
    });

    it('"firstAtDifficulty" tier shows a ribbon, a badge, and its own tier message', () => {
      renderSummit({ tier: 'firstAtDifficulty' });
      expect(screen.getByTestId('summit-ribbon')).toHaveTextContent('NEW BEST!');
      expect(screen.getByTestId('summit-badge')).toBeInTheDocument();
      expect(screen.getByTestId('summit-tier-message')).toHaveTextContent(
        'First time clearing this level!',
      );
    });

    it('escalates confetti count from success to newBest to firstAtDifficulty at the same difficulty', () => {
      const { unmount: unmount1 } = renderSummit({ tier: 'success', difficulty: 4 });
      const successCount = screen.getAllByTestId('summit-confetti-piece').length;
      unmount1();

      const { unmount: unmount2 } = renderSummit({ tier: 'newBest', difficulty: 4 });
      const newBestCount = screen.getAllByTestId('summit-confetti-piece').length;
      unmount2();

      renderSummit({ tier: 'firstAtDifficulty', difficulty: 4 });
      const firstCount = screen.getAllByTestId('summit-confetti-piece').length;

      expect(successCount).toBeLessThan(newBestCount);
      expect(newBestCount).toBeLessThan(firstCount);
    });

    it('gives a harder difficulty more confetti than an easier one, at the same tier', () => {
      const { unmount } = renderSummit({ tier: 'success', difficulty: 1 });
      const easyCount = screen.getAllByTestId('summit-confetti-piece').length;
      unmount();

      renderSummit({ tier: 'success', difficulty: 10 });
      const hardCount = screen.getAllByTestId('summit-confetti-piece').length;

      expect(hardCount).toBeGreaterThan(easyCount);
    });
  });

  describe('reward line', () => {
    it('shows nothing when no reward is passed', () => {
      renderSummit();
      expect(screen.queryByTestId('summit-reward')).not.toBeInTheDocument();
    });

    it('shows coins and a trophy when both were earned', () => {
      renderSummit({ tier: 'firstAtDifficulty', reward: { coins: 15, trophy: true } });
      expect(screen.getByTestId('summit-reward-coins')).toHaveTextContent('+15 coins');
      expect(screen.getByTestId('summit-reward-trophy')).toHaveTextContent('Trophy earned!');
    });

    it('shows coins only, singular for one coin', () => {
      renderSummit({ reward: { coins: 1, trophy: false } });
      expect(screen.getByTestId('summit-reward-coins')).toHaveTextContent('+1 coin');
      expect(screen.getByTestId('summit-reward-coins')).not.toHaveTextContent('coins');
      expect(screen.queryByTestId('summit-reward-trophy')).not.toBeInTheDocument();
    });

    it('omits the coin text once the coin cap is reached', () => {
      renderSummit({ reward: { coins: 0, trophy: true } });
      expect(screen.queryByTestId('summit-reward-coins')).not.toBeInTheDocument();
      expect(screen.getByTestId('summit-reward-trophy')).toBeInTheDocument();
    });
  });
});
