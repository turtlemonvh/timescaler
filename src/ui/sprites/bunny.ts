import bunnyManifestJson from '../../../public/sprites/bunny/manifest.json';
import { parseSpriteManifest, type SpriteManifest } from './manifest';

/**
 * The first CC0 animated animal (issue #93). The JSON is the generated file that
 * ships next to the frames in `public/sprites/bunny/`, imported rather than
 * copied so there is only ever one manifest to keep true.
 *
 * Parsing at module load is deliberate: a manifest re-generated with a bad
 * source mapping fails loudly at startup and in every test that touches it,
 * rather than rendering a broken image somewhere deep in a climb.
 */
export const BUNNY: SpriteManifest = parseSpriteManifest(bunnyManifestJson);

/** Every animal with normalized frames. #94 onward append here. */
export const SPRITE_ANIMALS: readonly SpriteManifest[] = [BUNNY];
