import { useEffect, useState, useSyncExternalStore } from 'react';
import { frameAt } from './frameAt';
import type { SpriteManifest } from './manifest';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function reducedMotionQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null;
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  if (query === null || typeof query.addEventListener !== 'function') return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Reads `prefers-reduced-motion`, and keeps up if it changes mid-session.
 *
 * A missing or listener-less `matchMedia` means "animate", which is what every
 * CSS animation in `index.css` already does — the media query there is
 * `no-preference`, so an environment that reports nothing gets motion.
 */
function reducedMotionSnapshot(): boolean {
  return reducedMotionQuery()?.matches ?? false;
}

export type SpriteAnimatorProps = {
  manifest: SpriteManifest;
  /** Pose name; must exist in `manifest.poses`. */
  pose: string;
  /** Rendered size in CSS pixels. Defaults to the manifest's native frame size. */
  size?: number;
  className?: string;
};

/**
 * Renders one pose of a normalized animal as a frame-cycling `<img>`.
 *
 * All the timing lives in the pure `frameAt(pose, elapsedMs)`; this component
 * only supplies the clock. That split is what makes the animation testable at
 * all — jsdom has no WebGL and only a canvas 2D stub, so anything checkable
 * only by looking at rendered pixels would not be checkable here.
 *
 * `prefers-reduced-motion: reduce` shows a static frame plus the pose name as a
 * visible label instead of animating (`docs/fun-bar.md` F15).
 */
export default function SpriteAnimator({ manifest, pose, size, className }: SpriteAnimatorProps) {
  const poseSpec = manifest.poses[pose] as SpriteManifest['poses'][string] | undefined;
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );

  // Keyed by pose so a pose change resets to frame 0 during render rather than
  // showing a stale frame index for one paint.
  const [tick, setTick] = useState<{ pose: string; frame: number }>({ pose, frame: 0 });
  const frame = tick.pose === pose ? tick.frame : 0;

  const frameCount = poseSpec?.frames.length ?? 0;
  const animate = !reducedMotion && frameCount > 1;

  useEffect(() => {
    if (!animate || poseSpec === undefined) return;

    let raf = 0;
    let startedAt: number | null = null;
    const step = (now: number) => {
      startedAt ??= now;
      setTick({ pose, frame: frameAt(poseSpec, now - startedAt) });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animate, pose, poseSpec]);

  if (poseSpec === undefined) {
    return (
      <span
        data-testid="sprite-missing-pose"
        role="img"
        aria-label={`${manifest.displayName}: no ${pose} pose`}
      >
        ?
      </span>
    );
  }

  const px = size ?? manifest.frameSize;
  const file = poseSpec.frames[Math.min(frame, frameCount - 1)];
  const src = `${import.meta.env.BASE_URL}${manifest.basePath}/${file}`;

  return (
    <span
      className={className}
      data-testid="sprite-animator"
      data-animal={manifest.animal}
      data-pose={pose}
      data-frame={frame}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <img
        src={src}
        width={px}
        height={px}
        alt={`${manifest.displayName}, ${pose}`}
        style={{ width: px, height: px, display: 'block' }}
        draggable={false}
      />
      {reducedMotion ? (
        <span data-testid="sprite-pose-label" style={{ fontSize: '0.75rem' }}>
          {pose}
        </span>
      ) : null}
    </span>
  );
}
