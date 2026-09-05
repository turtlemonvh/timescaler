import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DebugSpritesPage from './DebugSpritesPage';
import { SPRITE_ANIMALS } from '../sprites/bunny';

describe('DebugSpritesPage', () => {
  it('renders every pose', () => {
    render(<DebugSpritesPage />);
    const canvases = screen.getByTestId('character-preview').querySelectorAll('canvas');
    expect(canvases).toHaveLength(4);
  });

  it('defaults to hair, with a harness worn', () => {
    render(<DebugSpritesPage />);
    expect(screen.getByTestId('headgear-select')).toHaveValue('hair');
    expect(screen.getByTestId('harness-toggle')).toBeChecked();
    expect(screen.getByTestId('hair-select')).toBeInTheDocument();
    expect(screen.queryByTestId('helmet-select')).not.toBeInTheDocument();
  });

  it('swaps the hair color picker for a helmet color picker when headgear changes', async () => {
    const user = userEvent.setup();
    render(<DebugSpritesPage />);
    await user.selectOptions(screen.getByTestId('headgear-select'), 'helmet');
    expect(screen.getByTestId('helmet-select')).toBeInTheDocument();
    expect(screen.queryByTestId('hair-select')).not.toBeInTheDocument();
  });

  it('offers more than one color option for every colorable slot', () => {
    render(<DebugSpritesPage />);
    for (const testId of [
      'skin-select',
      'hair-select',
      'shirt-select',
      'pants-select',
      'shoes-select',
    ]) {
      const options = screen.getByTestId(testId).querySelectorAll('option');
      expect(options.length).toBeGreaterThan(1);
    }
  });

  it('toggles the harness off', async () => {
    const user = userEvent.setup();
    render(<DebugSpritesPage />);
    await user.click(screen.getByTestId('harness-toggle'));
    expect(screen.getByTestId('harness-toggle')).not.toBeChecked();
  });

  it('renders a mountain silhouette for all 10 peaks', () => {
    render(<DebugSpritesPage />);
    const canvases = screen.getByTestId('mountain-preview').querySelectorAll('canvas');
    expect(canvases).toHaveLength(10);
  });

  it('offers more than one hair style, only while hair is the headgear', async () => {
    const user = userEvent.setup();
    render(<DebugSpritesPage />);
    const styleOptions = screen.getByTestId('hair-style-select').querySelectorAll('option');
    expect(styleOptions.length).toBeGreaterThan(1);

    await user.selectOptions(screen.getByTestId('headgear-select'), 'helmet');
    expect(screen.queryByTestId('hair-style-select')).not.toBeInTheDocument();
  });

  it('shows every imported animal cycling through each of its poses', () => {
    render(<DebugSpritesPage />);
    const panel = screen.getByTestId('animal-preview');
    for (const animal of SPRITE_ANIMALS) {
      for (const pose of Object.keys(animal.poses)) {
        const cell = screen.getByTestId(`animal-pose-${animal.animal}-${pose}`);
        expect(cell).toBeInTheDocument();
        expect(cell.querySelector('img')).toHaveAttribute('alt', `${animal.displayName}, ${pose}`);
      }
      // Once at native size with a caption, once at 64 px for the F12
      // silhouette check.
      expect(panel.querySelectorAll(`img[alt^="${animal.displayName}, "]`)).toHaveLength(
        Object.keys(animal.poses).length * 2,
      );
    }
  });

  it('credits the license of each imported animal next to it', () => {
    render(<DebugSpritesPage />);
    const panel = screen.getByTestId('animal-preview');
    for (const animal of SPRITE_ANIMALS) {
      expect(panel).toHaveTextContent(animal.credit.pack);
      expect(panel).toHaveTextContent(animal.credit.license);
    }
  });

  it('selecting a different hair style updates the selector', async () => {
    const user = userEvent.setup();
    render(<DebugSpritesPage />);
    await user.selectOptions(screen.getByTestId('hair-style-select'), 'Puffy');
    expect(screen.getByTestId('hair-style-select')).toHaveValue('1');
  });
});
