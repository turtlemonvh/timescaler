import { Composition, Still } from 'remotion';
import { INTRO_FRAMES, IntroLoop, IntroPoster } from './IntroLoop';
import { FPS } from './shots';
import { TRAILER_FRAMES, Trailer } from './Trailer';

export function Root() {
  return (
    <>
      <Composition
        id="IntroLoop"
        component={IntroLoop}
        durationInFrames={INTRO_FRAMES}
        fps={FPS}
        width={540}
        height={540}
      />
      <Still id="IntroPoster" component={IntroPoster} width={540} height={540} />
      <Composition
        id="Trailer"
        component={Trailer}
        durationInFrames={TRAILER_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
}
