import { AbsoluteFill, Sequence } from 'remotion';
import { Shot } from './Shot';

/**
 * The intro screen's loop (#104): no words, one animal per shot since no
 * climber has been picked yet. Ends on the map gliding back to peak 1, where
 * the fox's opening climb takes place, so the loop reads as continuous.
 */
export const INTRO_FRAMES = 240;

export function IntroLoop() {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Sequence durationInFrames={60}>
        <Shot id="fox-climb" from={0.3} />
      </Sequence>
      <Sequence from={60} durationInFrames={45}>
        <Shot id="deer-slip" from={0.3} />
      </Sequence>
      <Sequence from={105} durationInFrames={75}>
        <Shot id="wolf-summit" from={0.3} />
      </Sequence>
      <Sequence from={180} durationInFrames={60}>
        <Shot id="map-sweep" from={3.0} />
      </Sequence>
    </AbsoluteFill>
  );
}

/** Reduced-motion stand-in: the wolf dancing by the summit flag. */
export function IntroPoster() {
  return <Shot id="wolf-summit" from={4.5} />;
}
