import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Intro from './Intro';

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('Intro', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setHidden(false);
  });

  it('calls onContinue when the button is clicked', () => {
    const onContinue = vi.fn();
    render(<Intro onContinue={onContinue} />);
    fireEvent.click(screen.getByTestId('intro-continue'));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('plays a muted looping WebM of the game over a poster frame', () => {
    render(<Intro onContinue={() => {}} />);
    const video = screen.getByTestId('intro-hero-video') as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(video.getAttribute('poster')).toMatch(/intro\/intro-hero-poster\.jpg$/);
    const sources = [...video.querySelectorAll('source')].map((s) => s.getAttribute('type'));
    expect(sources).toEqual(['video/webm']);
  });

  it('pauses the video while the tab is hidden and resumes when it returns', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    render(<Intro onContinue={() => {}} />);
    setHidden(true);
    expect(pause).toHaveBeenCalledOnce();
    setHidden(false);
    expect(play).toHaveBeenCalledOnce();
  });

  it('shows a still poster and no video when reduced motion is requested', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    render(<Intro onContinue={() => {}} />);
    expect(screen.queryByTestId('intro-hero-video')).toBeNull();
    const poster = screen.getByTestId('intro-hero-poster');
    expect(poster.getAttribute('src')).toMatch(/intro\/intro-hero-poster\.jpg$/);
    expect(poster.getAttribute('alt')).toMatch(/climbed/);
    expect(screen.getByTestId('intro-continue')).toBeTruthy();
  });
});
