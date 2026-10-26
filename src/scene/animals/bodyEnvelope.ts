import type { AnimalId } from './roster';

/**
 * How much room each animal's skinned mesh actually takes up, measured from
 * the shipped GLBs at roster scale (feet at y = 0, facing +Z). Pure numbers so
 * the climb's flight paths can be checked against the ledges in a unit test
 * without loading three.js models.
 *
 * `x`/`z` are the lateral/forward extents over every clip the climb plays.
 * `jump` and `land` are [lowest, highest] y of the mesh at 21 evenly spaced
 * points through `Gallop_Jump` and `Jump_ToIdle` — both clips carry their own
 * hop (the body rises up to ~0.5 units off the ground mid-clip), which the
 * scene's arc stacks on top of. Re-measure if the models change: load each GLB
 * with three's GLTFLoader + MeshoptDecoder, sample the clips with an
 * AnimationMixer and take `SkinnedMesh.getVertexPosition` bounds.
 */
export interface BodyEnvelope {
  x: readonly [number, number];
  z: readonly [number, number];
  idleTop: number;
  jump: readonly (readonly [number, number])[];
  land: readonly (readonly [number, number])[];
  /** Fraction of `Jump_ToIdle` where the feet are back down: play the land clip from here. */
  touchdown: number;
  /** Fraction of `Gallop_Jump` with the body stretched out mid-leap: the slip's scrabble pose. */
  reach: number;
}

type Pair = readonly [number, number];

export const BODY_ENVELOPES: Readonly<Record<AnimalId, BodyEnvelope>> = {
  fox: {
    x: [-0.23, 0.38],
    z: [-1.19, 1.08],
    idleTop: 1.0,
    jump: pairs(
      '0 1.13 0 1.04 0 .88 -.05 .92 -.03 .96 .07 1 .05 1.04 0 1.06 .03 1.12 0 1.18 -.01 1.22 .01 1.22 .04 1.21 .19 1.23 .31 1.39 .32 1.5 .32 1.53 .32 1.51 .28 1.42 .16 1.28 .02 1.15',
    ),
    land: pairs(
      '0 1.13 0 .96 -.04 .92 0 .98 .07 1.03 -.01 1.06 .01 1.17 -.01 1.22 .02 1.21 .21 1.23 .32 1.5 .32 1.55 .31 1.51 .16 1.32 .03 1.17 .02 1.07 .02 .92 .01 .96 .01 .98 0 1 0 1',
    ),
    touchdown: 0.7,
    reach: 0.7,
  },
  deer: {
    x: [-0.25, 0.42],
    z: [-0.88, 1.15],
    idleTop: 1.36,
    jump: pairs(
      '-.01 1.18 -.01 1.17 -.01 1.16 0 1.11 -.01 1.09 -.03 1.21 -.03 1.49 .04 1.66 .21 1.69 .41 1.69 .48 1.67 .54 1.62 .48 1.46 .37 1.3 .27 1.24 .15 1.18 .05 1.07 -.01 1 0 1.07 -.01 1.12 -.01 1.18',
    ),
    land: pairs(
      '-.01 1.18 -.01 1.19 0 1.17 .01 1.1 -.02 1.19 -.02 1.49 .04 1.66 .23 1.7 .41 1.71 .5 1.68 .51 1.48 .37 1.3 .24 1.24 .09 1.16 .02 1.05 -.02 1.07 -.01 1.11 -.01 1.15 0 1.21 0 1.27 0 1.33',
    ),
    touchdown: 0.7,
    reach: 0.45,
  },
  stag: {
    x: [-0.39, 0.54],
    z: [-0.85, 1.17],
    idleTop: 1.58,
    jump: pairs(
      '-.01 1.41 -.01 1.38 -.01 1.39 0 1.4 -.01 1.36 -.03 1.43 -.03 1.62 .04 1.75 .2 1.78 .38 1.81 .45 1.84 .5 1.84 .44 1.74 .35 1.59 .26 1.45 .14 1.38 .04 1.34 -.01 1.29 0 1.35 -.01 1.38 -.01 1.41',
    ),
    land: pairs(
      '-.01 1.41 -.01 1.4 0 1.44 0 1.39 -.02 1.41 -.02 1.61 .04 1.74 .22 1.78 .38 1.81 .47 1.84 .46 1.73 .34 1.58 .2 1.43 .09 1.36 .01 1.3 -.02 1.3 -.01 1.35 0 1.41 0 1.48 0 1.53 0 1.58',
    ),
    touchdown: 0.7,
    reach: 0.45,
  },
  wolf: {
    x: [-0.24, 0.37],
    z: [-1.22, 1.14],
    idleTop: 1.1,
    jump: pairs(
      '0 1.22 0 1.12 0 .97 -.05 1.02 -.04 1.06 .06 1.11 .05 1.14 -.01 1.16 .02 1.23 0 1.3 -.01 1.34 0 1.34 .05 1.34 .21 1.35 .34 1.46 .35 1.59 .35 1.61 .34 1.6 .3 1.51 .17 1.37 .02 1.24',
    ),
    land: pairs(
      '0 1.22 0 1.04 -.05 1.01 -.01 1.08 .06 1.14 -.02 1.17 .01 1.28 -.01 1.34 .02 1.34 .23 1.36 .35 1.57 .35 1.63 .33 1.59 .16 1.41 .03 1.26 .02 1.17 .02 1.02 .01 1.06 .01 1.08 .01 1.1 0 1.1',
    ),
    touchdown: 0.7,
    reach: 0.7,
  },
  alpaca: {
    x: [-0.17, 0.37],
    z: [-0.72, 1.07],
    idleTop: 1.4,
    jump: pairs(
      '-.01 1.24 -.01 1.22 0 1.22 0 1.2 0 1.19 -.01 1.31 -.01 1.53 .05 1.6 .21 1.63 .33 1.65 .38 1.65 .43 1.63 .38 1.48 .31 1.29 .22 1.14 .12 1.1 .02 1.11 -.01 1.12 -.01 1.17 -.01 1.21 -.01 1.24',
    ),
    land: pairs(
      '-.01 1.24 -.01 1.23 0 1.24 0 1.17 -.01 1.26 -.01 1.52 .05 1.61 .22 1.64 .36 1.67 .43 1.66 .37 1.52 .27 1.31 .16 1.16 .04 1.14 0 1.16 0 1.2 0 1.22 0 1.26 0 1.31 0 1.36 0 1.39',
    ),
    touchdown: 0.7,
    reach: 0.45,
  },
  husky: {
    x: [-0.19, 0.33],
    z: [-0.67, 0.9],
    idleTop: 1.06,
    jump: pairs(
      '.01 1.05 0 1.03 0 1.01 -.01 .99 -.01 1.02 0 1.05 .07 1.06 .1 1.07 .05 1.12 0 1.18 -.01 1.22 0 1.23 .04 1.24 .17 1.26 .27 1.28 .29 1.3 .28 1.28 .28 1.26 .22 1.2 .13 1.13 .04 1.06',
    ),
    land: pairs(
      '.01 1.05 0 1.02 -.05 .98 -.04 1.03 .07 1.06 .09 1.08 .01 1.17 -.01 1.22 .01 1.23 .18 1.26 .28 1.33 .28 1.3 .27 1.26 .14 1.16 .02 1.08 .02 1.07 .01 1.05 .01 1.02 .01 1.04 0 1.05 0 1.05',
    ),
    touchdown: 0.7,
    reach: 0.7,
  },
};

function pairs(text: string): Pair[] {
  const values = text.split(' ').map(Number);
  const out: Pair[] = [];
  for (let i = 0; i < values.length; i += 2) out.push([values[i], values[i + 1]]);
  return out;
}

/** [lowest, highest] mesh y over a window of a sampled clip, so crossfades and sampling gaps are covered. */
export function envelopeAt(
  samples: readonly Pair[],
  from: number,
  to: number = from,
): [number, number] {
  const last = samples.length - 1;
  const a = Math.max(0, Math.floor(Math.min(from, to) * last));
  const b = Math.min(last, Math.ceil(Math.max(from, to) * last));
  let low = Infinity;
  let high = -Infinity;
  for (let i = a; i <= b; i++) {
    low = Math.min(low, samples[i][0]);
    high = Math.max(high, samples[i][1]);
  }
  return [low, high];
}
