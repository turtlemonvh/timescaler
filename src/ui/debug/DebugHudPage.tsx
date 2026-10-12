import { useState } from 'react';
import BoostMeter from '../hud/BoostMeter';
import FallRiskMeter from '../hud/FallRiskMeter';
import ProfileChip from '../hud/ProfileChip';
import TimerBar from '../hud/TimerBar';

/**
 * Dev-only gallery for the M4 HUD components — the small, presentational
 * pieces the Climb screen composes together. Distinct from `/debug/widgets`
 * (question display/answer widgets) since these are game-state indicators,
 * not question I/O.
 */
export default function DebugHudPage() {
  const [fraction, setFraction] = useState(0.6);
  const [boost, setBoost] = useState(2);
  const [fallRisk, setFallRisk] = useState(1);

  return (
    <main>
      <h1>Debug: hud</h1>
      <p>Dev-only. Not shipped to production — see CONTRIBUTING for how to reach this page.</p>

      <h2>TimerBar</h2>
      <p>
        <label htmlFor="hud-fraction">Time remaining</label>{' '}
        <input
          id="hud-fraction"
          data-testid="hud-fraction"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={fraction}
          onChange={(event) => setFraction(Number(event.target.value))}
        />
      </p>
      <div style={{ width: 240 }}>
        <TimerBar fraction={fraction} />
      </div>

      <h2>BoostMeter</h2>
      <p>
        <label htmlFor="hud-boost">Boost</label>{' '}
        <input
          id="hud-boost"
          data-testid="hud-boost"
          type="range"
          min={0}
          max={5}
          step={1}
          value={boost}
          onChange={(event) => setBoost(Number(event.target.value))}
        />
      </p>
      <BoostMeter boost={boost} boostCapacity={5} />

      <h2>FallRiskMeter</h2>
      <p>
        <label htmlFor="hud-fall-risk">Fall risk</label>{' '}
        <input
          id="hud-fall-risk"
          data-testid="hud-fall-risk"
          type="range"
          min={0}
          max={4}
          step={1}
          value={fallRisk}
          onChange={(event) => setFallRisk(Number(event.target.value))}
        />
      </p>
      <FallRiskMeter fallRisk={fallRisk} fallRiskCapacity={4} />

      <h2>ProfileChip</h2>
      <ProfileChip name="Riley" />
      <ProfileChip name="Riley" preview={<span style={{ fontSize: 24 }}>🧗</span>} />
    </main>
  );
}
