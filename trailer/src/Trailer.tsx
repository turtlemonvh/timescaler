import type { ReactNode } from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { PEAKS } from '../../src/engine/peaks';
import { FPS } from './shots';
import { Shot } from './Shot';
import { theme } from './theme';

export const TRAILER_FRAMES = 900;
const LIVE_URL = 'turtlemonvh.github.io/timescaler';

function useEntrance(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.6 } });
}

/** Lower-left caption, sitting over the scene and clear of the question card. */
function Caption({
  children,
  delay = 6,
  size = 64,
}: {
  children: ReactNode;
  delay?: number;
  size?: number;
}) {
  const t = useEntrance(delay);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 84px 84px' }}>
      <div
        style={{
          alignSelf: 'flex-start',
          transform: `translateY(${(1 - t) * 40}px) scale(${0.9 + t * 0.1})`,
          opacity: t,
          background: theme.card,
          border: `4px solid ${theme.border}`,
          borderRadius: 28,
          padding: '18px 34px 22px',
          color: theme.ink,
          font: `700 ${size}px/1.1 ${theme.font}`,
          boxShadow: '0 12px 0 rgba(43, 33, 23, 0.25)',
          maxWidth: 1000,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

function Wordmark() {
  const t = useEntrance(4);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 84px 84px' }}>
      <div
        style={{
          alignSelf: 'flex-start',
          transform: `scale(${0.6 + t * 0.4}) rotate(${(1 - t) * -6}deg)`,
          transformOrigin: 'left bottom',
          opacity: t,
          background: theme.accent,
          color: '#fff',
          borderRadius: 30,
          padding: '20px 44px 26px',
          font: `700 112px/1 ${theme.font}`,
          letterSpacing: '0.04em',
          boxShadow: '0 14px 0 #a8501b',
        }}
      >
        TIMESCALER
      </div>
    </AbsoluteFill>
  );
}

/** Peak name tag for the map sweep, swapped as the climber reaches each one. */
function PeakTag({ stops }: { stops: { at: number; peakId: number }[] }) {
  const frame = useCurrentFrame();
  const current = [...stops].reverse().find((stop) => frame >= stop.at * FPS) ?? stops[0];
  const peak = PEAKS.find((p) => p.id === current.peakId)!;
  const since = frame - current.at * FPS;
  const pop = interpolate(since, [0, 6], [0.85, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'flex-end', padding: '84px 84px 0 0' }}>
      <div
        style={{
          transform: `scale(${pop})`,
          transformOrigin: 'right top',
          background: 'rgba(253, 248, 238, 0.94)',
          border: `4px solid ${theme.border}`,
          borderRadius: 24,
          padding: '16px 28px 18px',
          color: theme.ink,
          font: `700 48px/1.15 ${theme.font}`,
          display: 'flex',
          gap: 22,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: theme.accent,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 42,
          }}
        >
          {peak.id}
        </span>
        <span style={{ display: 'grid' }}>
          {peak.name}
          <span style={{ font: `400 30px/1.2 ${theme.font}`, color: theme.text }}>
            {peak.emphasis}
          </span>
        </span>
      </div>
    </AbsoluteFill>
  );
}

function EndCard() {
  const t = useEntrance(2);
  const chips = ['Free', 'No accounts', 'Works offline'];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: 'blur(14px) brightness(0.8)', transform: 'scale(1.08)' }}>
        <Img src={staticFile('shots/summit/f0170.jpg')} style={{ width: '100%', height: '100%' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            transform: `scale(${0.85 + t * 0.15})`,
            opacity: t,
            background: theme.card,
            border: `5px solid ${theme.border}`,
            borderRadius: 40,
            padding: '56px 88px 60px',
            display: 'grid',
            justifyItems: 'center',
            gap: 26,
            color: theme.ink,
            fontFamily: theme.font,
            boxShadow: '0 18px 0 rgba(43, 33, 23, 0.3)',
          }}
        >
          <span
            style={{
              font: `700 124px/1 ${theme.font}`,
              color: theme.accent,
              letterSpacing: '0.03em',
            }}
          >
            TIMESCALER
          </span>
          <span style={{ font: `700 54px/1.2 ${theme.font}` }}>
            Learn to tell time, one ledge at a time
          </span>
          <span style={{ display: 'flex', gap: 16 }}>
            {chips.map((chip) => (
              <span
                key={chip}
                style={{
                  font: `700 32px/1 ${theme.font}`,
                  color: theme.text,
                  background: theme.bg,
                  border: `3px solid ${theme.border}`,
                  borderRadius: 999,
                  padding: '12px 26px',
                }}
              >
                {chip}
              </span>
            ))}
          </span>
          <span style={{ font: `700 40px/1 ${theme.font}`, color: theme.accent }}>{LIVE_URL}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * The 30-second trailer: one continuous take of the real Climb screen for
 * the hook, the climb and the slip, then the character pick, the map and
 * the summit, each a recorded take with a caption laid over it.
 */
export function Trailer() {
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Sequence durationInFrames={240}>
        <Shot id="game" from={0.2} sound />
        <Sequence durationInFrames={84}>
          <Wordmark />
        </Sequence>
        <Sequence from={90}>
          <Caption>Answer right, climb higher</Caption>
        </Sequence>
      </Sequence>
      <Sequence from={240} durationInFrames={120}>
        {/* Opens on the fifth question; the scripted player misses it ~0.8 s in. */}
        <Shot id="game" from={9.7} sound />
        <Caption delay={26}>Miss? You slip, not fall</Caption>
      </Sequence>
      <Sequence from={360} durationInFrames={120}>
        <Shot id="pick" from={0.3} fit="contain" />
        <Caption size={56}>Six climbers</Caption>
      </Sequence>
      <Sequence from={480} durationInFrames={150}>
        <Shot id="map-wide" from={0.1} />
        <PeakTag
          stops={[
            { at: 0, peakId: 1 },
            { at: 0.3, peakId: 3 },
            { at: 1.3, peakId: 5 },
            { at: 2.3, peakId: 8 },
            { at: 3.3, peakId: 10 },
          ]}
        />
        <Caption>10 peaks · 10 time skills</Caption>
      </Sequence>
      <Sequence from={630} durationInFrames={150}>
        <Shot id="summit" from={0.35} sound />
        <Caption>Reach the summit</Caption>
      </Sequence>
      <Sequence from={780} durationInFrames={120}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
