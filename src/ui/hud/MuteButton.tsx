import { useState } from 'react';
import { isMuted, playCue, toggleMuted } from '../../scene/audio/synth';

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="M16 9l5 6M21 9l-5 6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

/** Persistent sound toggle; plays a confirmation tap when turning sound on. */
export default function MuteButton() {
  const [muted, setMuted] = useState(() => isMuted());
  return (
    <button
      type="button"
      data-variant="ghost"
      className="mute-button"
      data-testid="mute-toggle"
      aria-pressed={muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound off' : 'Sound on'}
      onClick={() => {
        const next = toggleMuted();
        setMuted(next);
        if (!next) playCue('tap');
      }}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}
