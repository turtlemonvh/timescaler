import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame } from 'remotion';
import { FPS, SHOTS, type ShotId } from './shots';

/** Shots that made a sound while being filmed (`record.ts` writes audio.wav). */
const HAS_AUDIO: ReadonlySet<ShotId> = new Set([
  'fox-climb',
  'deer-slip',
  'wolf-summit',
  'game',
  'summit',
]);

/**
 * One recorded take, played from `from` seconds in. Frames are the JPEGs
 * `record.ts` saved, so a frame here is exactly a frame of the game.
 */
export function Shot({
  id,
  from,
  sound = false,
  fit = 'cover',
}: {
  id: ShotId;
  from: number;
  sound?: boolean;
  /** `contain` letterboxes a take that isn't 16:9, pinned right to leave the caption room. */
  fit?: 'cover' | 'contain';
}) {
  const frame = useCurrentFrame();
  const last = Math.round(SHOTS[id].seconds * FPS) - 1;
  const index = Math.min(last, Math.round(from * FPS) + frame);
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(`shots/${id}/f${String(index).padStart(4, '0')}.jpg`)}
        style={{ width: '100%', height: '100%', objectFit: fit, objectPosition: 'right center' }}
      />
      {sound && HAS_AUDIO.has(id) && (
        <Audio src={staticFile(`shots/${id}/audio.wav`)} trimBefore={Math.round(from * FPS)} />
      )}
    </AbsoluteFill>
  );
}
