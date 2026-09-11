'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { circuitTrace } from '@/lib/pipeline';
import type { LabState } from '@/lib/lab-state';
import { definition } from '@/lib/simulation';
import { PipelinePlayer } from './pipeline-player';
import type { CircuitEvent } from './use-circuit-history';

export function CircuitPipeline({
  state,
  tick,
  codeMode,
  codeError,
  events,
}: {
  state: LabState;
  tick: number;
  codeMode: boolean;
  codeError?: string;
  events: CircuitEvent[];
}) {
  const [device, setDevice] = useState(state.devices[0]?.id ?? '');
  const [trace, setTrace] = useState(() =>
    circuitTrace(state, device, codeMode, tick, codeError),
  );
  const [capturedTick, setCapturedTick] = useState(tick);
  const capture = (id = device) => {
    setTrace(circuitTrace(state, id, codeMode, tick, codeError));
    setCapturedTick(tick);
  };
  return (
    <div className="pipeline-workbench">
      <div className="master-section-heading">
        <div>
          <h2>Explain my circuit</h2>
          <p>
            Freeze a learning snapshot of your wiring, device values and program
            or automation.
          </p>
        </div>
        <div className="master-actions">
          <select
            aria-label="Device to explain"
            value={state.devices.some((d) => d.id === device) ? device : ''}
            onChange={(e) => {
              setDevice(e.target.value);
              capture(e.target.value);
            }}
          >
            <option value="">Choose a device</option>
            {state.devices.map((d) => (
              <option key={d.id} value={d.id}>
                {definition(d).name} · {d.id.slice(-8)}
              </option>
            ))}
          </select>
          <Button onClick={() => capture()}>Capture current state</Button>
        </div>
      </div>
      <div className="master-actions">
        <label>
          Recent actions{' '}
          <select
            aria-label="Explain a recent action"
            defaultValue=""
            onChange={(e) => {
              const event = events.find((v) => v.id === +e.target.value);
              if (event) {
                setTrace(event.trace);
                setCapturedTick(event.tick);
              }
            }}
          >
            <option value="">Choose a recorded change…</option>
            {[...events].reverse().map((e) => (
              <option key={e.id} value={e.id}>
                {e.label} · tick {e.tick}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="pipeline-note">
        Captured tick {capturedTick}; live tick {tick}. The last30 circuit
        changes are kept for this session; consecutive running updates are
        combined. The selected snapshot stays fixed during playback.
      </p>
      <PipelinePlayer trace={trace} />
    </div>
  );
}
