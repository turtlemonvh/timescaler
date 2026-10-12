export interface IntroProps {
  onContinue: () => void;
}

/**
 * The welcome screen — the Climber's Guild framing from the design spec.
 * Shown once per app load; there is no "first visit" flag in the schema.
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
      <section className="intro-screen__card">
        <h1>Timescaler</h1>
        <p className="page__lead">
          Welcome to the Climber&apos;s Guild! Ten peaks are waiting, each one testing a different
          skill with clocks and calendars.
        </p>
        <p>
          Answer questions correctly to climb faster. Miss too many and you&apos;ll slip back down —
          but any peak you&apos;ve already summited stays yours forever.
        </p>
        <p>Sign the logbook, pick your climber, and start climbing.</p>
        <button type="button" data-testid="intro-continue" onClick={onContinue}>
          Get Started
        </button>
      </section>
    </main>
  );
}
