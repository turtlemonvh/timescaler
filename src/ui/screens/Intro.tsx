import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';

export interface IntroProps {
  onContinue: () => void;
}

const HERO = `${import.meta.env.BASE_URL}intro/`;

/**
 * An 8-second loop of the real game — a fox climbing, a deer slipping, a
 * wolf dancing on the summit, the map of peaks — filmed from the actual
 * scenes by `trailer/` (`pnpm trailer:render`), so it is re-shot rather
 * than redrawn when the game changes. A video rather than a live scene keeps
 * three.js out of the first screen's bundle.
 *
 * Paused while the tab is hidden; reduced motion gets the poster frame only.
 */
function IntroHero() {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      if (document.hidden) video.pause();
      else video.play()?.catch(() => {});
    };
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <img
        className="intro-hero"
        data-testid="intro-hero-poster"
        src={`${HERO}intro-hero-poster.jpg`}
        alt="A wolf dances by the flag at the top of a cliff it has just climbed"
      />
    );
  }
  return (
    <video
      ref={videoRef}
      className="intro-hero"
      data-testid="intro-hero-video"
      poster={`${HERO}intro-hero-poster.jpg`}
      autoPlay
      muted
      loop
      playsInline
      aria-label="Animals climbing cliffs by answering clock and calendar questions"
    >
      <source src={`${HERO}intro-hero.webm`} type="video/webm" />
      <source src={`${HERO}intro-hero.mp4`} type="video/mp4" />
    </video>
  );
}

/**
 * The welcome screen — the Climber's Guild framing from the design spec.
 * Shown once per app load; there is no "first visit" flag in the schema.
 * Get Started sits right under the lead, above the longer explanation, so it
 * stays on the first screen of a phone even with the video above it.
 */
export default function Intro({ onContinue }: IntroProps) {
  return (
    <main className="intro-screen">
      <div className="intro-screen__sky" aria-hidden="true">
        <span className="intro-screen__sun" />
        <span className="intro-screen__peak intro-screen__peak--far" />
        <span className="intro-screen__peak intro-screen__peak--mid" />
        <span className="intro-screen__peak intro-screen__peak--near" />
        <span className="intro-screen__cloud intro-screen__cloud--a" />
        <span className="intro-screen__cloud intro-screen__cloud--b" />
      </div>
      <div className="intro-screen__layout">
        <IntroHero />
        <section className="intro-screen__card">
          <h1>Timescaler</h1>
          <p className="page__lead">
            Welcome to the Climber&apos;s Guild! Ten peaks are waiting, each one testing a different
            skill with clocks and calendars.
          </p>
          <button type="button" data-testid="intro-continue" onClick={onContinue}>
            Get Started
          </button>
          <p className="intro-screen__more">
            Answer questions correctly to climb faster. Miss too many and you&apos;ll slip back down
            — but any peak you&apos;ve already summited stays yours forever. Sign the logbook, pick
            your climber, and start climbing.
          </p>
        </section>
      </div>
    </main>
  );
}
