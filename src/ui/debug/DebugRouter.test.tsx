import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DebugRouter from './DebugRouter';

describe('DebugRouter', () => {
  it('renders the questions page at /debug/questions', () => {
    render(<DebugRouter pathname="/debug/questions" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Debug: questions' })).toBeInTheDocument();
  });

  it('tolerates a trailing slash', () => {
    render(<DebugRouter pathname="/debug/questions/" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Debug: questions' })).toBeInTheDocument();
  });

  it('renders the sprites page at /debug/sprites', () => {
    render(<DebugRouter pathname="/debug/sprites" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Debug: sprites' })).toBeInTheDocument();
  });

  it('renders the widgets page at /debug/widgets', () => {
    render(<DebugRouter pathname="/debug/widgets" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Debug: widgets' })).toBeInTheDocument();
  });

  it('renders the hud page at /debug/hud', () => {
    render(<DebugRouter pathname="/debug/hud" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Debug: hud' })).toBeInTheDocument();
  });

  it('renders the climb stage page at /debug/climb-stage', () => {
    render(<DebugRouter pathname="/debug/climb-stage" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Debug: climb-stage' }),
    ).toBeInTheDocument();
    // Every move the issue asks to be able to trigger by hand.
    for (const id of [
      'stage-correct',
      'stage-fast-correct',
      'stage-miss',
      'stage-fill-boost',
      'stage-summit',
      'stage-fall',
      'stage-narrow-toggle',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('renders the screens page at /debug/screens', () => {
    render(<DebugRouter pathname="/debug/screens" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Debug: screens' })).toBeInTheDocument();
  });

  it('renders PreviewPlayer at /debug/preview', () => {
    render(<DebugRouter pathname="/debug/preview" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Timescaler — question preview' }),
    ).toBeInTheDocument();
  });

  it('shows an index for a debug route that does not exist', () => {
    render(<DebugRouter pathname="/debug/nonexistent" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Unknown debug route' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '/debug/questions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '/debug/sprites' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '/debug/widgets' })).toBeInTheDocument();
  });

  it('shows the index for a path outside /debug/ entirely', () => {
    render(<DebugRouter pathname="/" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Unknown debug route' }),
    ).toBeInTheDocument();
  });
});
