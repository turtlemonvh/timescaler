import { useState } from 'react';
import { mulberry32 } from '../../engine/rng';
import PixelLayers, { type Layer } from '../pixel/PixelLayers';
import { generateMountainScene } from '../pixel/mountainScene';
import { MOUNTAIN_THEMES, pixelPeakHeight } from '../pixel/mountainThemes';
import { bodyIdle, bodyClimb, bodySlip, bodyCheer } from '../pixel/sprites/body';
import { hairShort, hairPuffy, hairPigtails } from '../pixel/sprites/hair';
import { helmetClassic } from '../pixel/sprites/helmet';
import { harnessBasic } from '../pixel/sprites/harness';
import type { Sprite } from '../pixel/types';
import SpriteAnimator from '../sprites/SpriteAnimator';
import { SPRITE_ANIMALS } from '../sprites/bunny';

const SKIN_TONES = ['#e8b98a', '#c68958', '#8d5a3a', '#f2cba0'];
const HAIR_COLORS = ['#4a2f1c', '#1b1b1b', '#a35c2e', '#e8c15a'];
const SHIRT_COLORS = ['#d1495b', '#3a86ff', '#2a9d8f', '#f4a259'];
const PANTS_COLORS = ['#2b2d42', '#4a3728', '#3d5a80'];
const SHOE_COLORS = ['#1b1b1b', '#6b4226', '#e8e8e8'];
const HELMET_COLORS = ['#e63946', '#ffb703', '#3a86ff', '#2b2d42'];

const POSES: readonly [string, Sprite][] = [
  ['idle', bodyIdle],
  ['climb', bodyClimb],
  ['slip', bodySlip],
  ['cheer', bodyCheer],
];

const HAIR_STYLES: readonly [string, Sprite][] = [
  ['Short', hairShort],
  ['Puffy', hairPuffy],
  ['Pigtails', hairPigtails],
];

const SCALE = 8;

const MOUNTAIN_WIDTH = 64;
const MOUNTAIN_HEIGHT = 24;
const MOUNTAIN_SCALE = 4;

/**
 * Dev-only gallery for the layered character system: every body pose,
 * with the currently selected headgear/harness/colors applied to each —
 * the point is to eyeball the pose set as a set (same character,
 * different silhouette), not each pose in isolation.
 */
export default function DebugSpritesPage() {
  const [headgear, setHeadgear] = useState<'hair' | 'helmet'>('hair');
  const [showHarness, setShowHarness] = useState(true);
  const [skinIndex, setSkinIndex] = useState(0);
  const [hairStyleIndex, setHairStyleIndex] = useState(0);
  const [hairIndex, setHairIndex] = useState(0);
  const [shirtIndex, setShirtIndex] = useState(0);
  const [pantsIndex, setPantsIndex] = useState(0);
  const [shoesIndex, setShoesIndex] = useState(0);
  const [helmetIndex, setHelmetIndex] = useState(0);

  const bodyPalette = {
    skin: SKIN_TONES[skinIndex],
    shirt: SHIRT_COLORS[shirtIndex],
    pants: PANTS_COLORS[pantsIndex],
    shoes: SHOE_COLORS[shoesIndex],
    eyes: '#2b2118',
  };

  const headgearLayer: Layer =
    headgear === 'hair'
      ? { sprite: HAIR_STYLES[hairStyleIndex][1], palette: { hair: HAIR_COLORS[hairIndex] } }
      : { sprite: helmetClassic, palette: { helmet: HELMET_COLORS[helmetIndex] } };
  const harnessLayer: Layer[] = showHarness
    ? [{ sprite: harnessBasic, palette: { harness: '#ffcc00' } }]
    : [];

  function colorSelect(
    label: string,
    testId: string,
    colors: string[],
    index: number,
    onChange: (index: number) => void,
  ) {
    return (
      <p>
        <label htmlFor={testId}>{label}</label>{' '}
        <select
          id={testId}
          data-testid={testId}
          value={index}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {colors.map((color, i) => (
            <option key={color} value={i}>
              {color}
            </option>
          ))}
        </select>
      </p>
    );
  }

  return (
    <main>
      <h1>Debug: sprites</h1>
      <p>Dev-only. Layered, customizable character: body + headgear + harness, every pose.</p>

      <p>
        <label htmlFor="headgear-select">Headgear</label>{' '}
        <select
          id="headgear-select"
          data-testid="headgear-select"
          value={headgear}
          onChange={(event) => setHeadgear(event.target.value as 'hair' | 'helmet')}
        >
          <option value="hair">Hair</option>
          <option value="helmet">Helmet</option>
        </select>
      </p>
      <p>
        <label htmlFor="harness-toggle">
          <input
            id="harness-toggle"
            data-testid="harness-toggle"
            type="checkbox"
            checked={showHarness}
            onChange={(event) => setShowHarness(event.target.checked)}
          />{' '}
          Harness
        </label>
      </p>

      {colorSelect('Skin', 'skin-select', SKIN_TONES, skinIndex, setSkinIndex)}
      {headgear === 'hair'
        ? colorSelect(
            'Hair style',
            'hair-style-select',
            HAIR_STYLES.map(([name]) => name),
            hairStyleIndex,
            setHairStyleIndex,
          )
        : null}
      {headgear === 'hair'
        ? colorSelect('Hair color', 'hair-select', HAIR_COLORS, hairIndex, setHairIndex)
        : colorSelect('Helmet color', 'helmet-select', HELMET_COLORS, helmetIndex, setHelmetIndex)}
      {colorSelect('Shirt', 'shirt-select', SHIRT_COLORS, shirtIndex, setShirtIndex)}
      {colorSelect('Pants', 'pants-select', PANTS_COLORS, pantsIndex, setPantsIndex)}
      {colorSelect('Shoes', 'shoes-select', SHOE_COLORS, shoesIndex, setShoesIndex)}

      <div
        data-testid="character-preview"
        style={{ display: 'flex', gap: '2rem', alignItems: 'flex-end' }}
      >
        {POSES.map(([name, body]) => (
          <div key={name}>
            <PixelLayers
              layers={[{ sprite: body, palette: bodyPalette }, headgearLayer, ...harnessLayer]}
              scale={SCALE}
            />
            <p>{name}</p>
          </div>
        ))}
      </div>

      <h2>Imported animals</h2>
      <p>
        Normalized CC0 art from <code>public/sprites/</code>, cycling live at each pose&rsquo;s own
        fps — the pipeline from issue #93. Check these against <code>docs/fun-bar.md</code> F12
        (silhouette at 64 px) and F13 (four poses a child can name). With{' '}
        <code>prefers-reduced-motion</code> set, each one falls back to a static frame plus its pose
        name.
      </p>
      <div data-testid="animal-preview">
        {SPRITE_ANIMALS.map((animal) => (
          <div key={animal.animal}>
            <p>
              <strong>{animal.displayName}</strong> — {animal.frameSize}×{animal.frameSize},{' '}
              {animal.credit.pack} by {animal.credit.author} (
              <a href={animal.credit.url} target="_blank" rel="noreferrer">
                {animal.credit.license}
              </a>
              )
            </p>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-end' }}>
              {Object.entries(animal.poses).map(([pose, spec]) => (
                <div key={pose} data-testid={`animal-pose-${animal.animal}-${pose}`}>
                  <SpriteAnimator manifest={animal} pose={pose} />
                  <p>
                    {pose} — {spec.frames.length}f @ {spec.fps}fps
                    {spec.loop ? '' : ', once'}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-end' }}>
              {Object.keys(animal.poses).map((pose) => (
                <SpriteAnimator key={pose} manifest={animal} pose={pose} size={64} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2>Mountain scenes</h2>
      <p>
        Procedurally generated, 3 parallax bands per scene (paler and shorter toward the back) — one
        algorithm, different seed/palette/peak-height per theme. All 10 peaks, in climb order.
      </p>
      <div
        data-testid="mountain-preview"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
      >
        {MOUNTAIN_THEMES.map((theme) => (
          <div key={theme.peak.id}>
            <p>
              {theme.peak.id}. {theme.peak.name} — {theme.peak.emphasis}
            </p>
            <PixelLayers
              layers={generateMountainScene(
                mulberry32(theme.peak.id),
                MOUNTAIN_WIDTH,
                MOUNTAIN_HEIGHT,
                pixelPeakHeight(theme.peak),
                theme.rock,
                theme.snow,
              )}
              scale={MOUNTAIN_SCALE}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
