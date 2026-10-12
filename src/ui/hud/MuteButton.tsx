import { useState } from 'react';
import { isMuted, playCue, toggleMuted } from '../../scene/audio/synth';

/** Persistent sound toggle; plays a confirmation tap when turning sound on. */
export default function MuteButton() {
  const [muted, setMuted] = useState(() => isMuted());
  return (
    <button
      type="button"
      data-variant="ghost"
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
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
