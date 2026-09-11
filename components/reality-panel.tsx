'use client';
import { useState } from 'react';
import type { LabState } from '@/lib/lab-state';
import { consequences, faultScenarios, injectFault } from '@/lib/consequences';
import { Button } from './ui/button';
export function RealityPanel({
  state,
  tick,
  onApply,
}: {
  state: LabState;
  tick: number;
  onApply: (s: LabState) => void;
}) {
  const [saved, setSaved] = useState<LabState | null>(null),
    [message, setMessage] = useState('');
  const outcomes = consequences(state, tick);
  return (
    <section className="reality-panel">
      <h2>What would happen on real hardware?</h2>
      <p>
        {state.running ? 'Live simulation' : 'Current circuit'} · tick {tick}.
        Predictions use your wiring, values and resource estimates. They are
        explanations, not measurements or full electrical simulation.
      </p>
      <div className="scenario-buttons">
        {faultScenarios.map((s) => (
          <Button
            key={s.id}
            variant="outline"
            title={s.description}
            onClick={() => {
              try {
                const next = injectFault(state, s.id);
                if (!saved) setSaved(structuredClone(state));
                onApply(next);
                setMessage(
                  s.description + ' Simulation paused for inspection.',
                );
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            {s.name}
          </Button>
        ))}
        {saved && (
          <Button
            onClick={() => {
              onApply({ ...saved, running: false });
              setSaved(null);
              setMessage('Original circuit restored.');
            }}
          >
            Restore before scenarios
          </Button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {!outcomes.length && (
        <p>Add a device or load a template to explore its physical behavior.</p>
      )}
      <div className="reality-grid">
        {outcomes.map((o, i) => (
          <article key={i} className={o.severity}>
            <strong>{o.title}</strong>
            <p>{o.cause}</p>
            <p>{o.effect}</p>
            <small>Try: {o.test}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
