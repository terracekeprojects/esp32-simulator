'use client';
import { useEffect, useRef, useState } from 'react';
import type { LabState } from '@/lib/lab-state';
import { circuitTrace, type Trace } from '@/lib/pipeline';

export type CircuitEvent = {
  id: number;
  label: string;
  tick: number;
  trace: Trace;
};
export function useCircuitHistory(
  state: LabState,
  tick: number,
  codeMode: boolean,
  codeError: string,
  serial: string[],
) {
  const [events, setEvents] = useState<CircuitEvent[]>([]);
  const previous = useRef<LabState | null>(null),
    counter = useRef(0);
  useEffect(() => {
    const old = previous.current;
    previous.current = state;
    if (old?.restricted && !state.restricted) {
      setEvents([]);
      return;
    }
    const label = !old
      ? 'Initial circuit'
      : old.chip !== state.chip || old.template !== state.template
        ? 'Project / board changed'
        : old.wires !== state.wires
          ? 'Wiring changed'
          : old.program !== state.program
            ? 'Program edited'
            : old.rules !== state.rules
              ? 'Automation edited'
              : old.settings !== state.settings
                ? 'Parameters changed'
                : old.running !== state.running
                  ? state.running
                    ? 'Simulation started'
                    : 'Simulation paused'
                  : old.devices !== state.devices
                    ? state.running
                      ? 'Simulation update'
                      : 'Device changed'
                    : codeError
                      ? 'Code error'
                      : '';
    if (!label) return;
    const changed = state.devices.find(
      (d) =>
        JSON.stringify(d) !==
        JSON.stringify(old?.devices.find((p) => p.id === d.id)),
    );
    const changedWire =
      state.wires.find(
        (w) => !old?.wires.some((p) => p.id === w.id && p.pinId === w.pinId),
      ) ??
      old?.wires.find(
        (w) => !state.wires.some((p) => p.id === w.id && p.pinId === w.pinId),
      );
    const trace = circuitTrace(
      state,
      changed?.id ?? changedWire?.deviceId ?? state.devices[0]?.id ?? '',
      codeMode,
      tick,
      codeError,
    );
    trace.summary = `${label}. ${trace.summary}`;
    if (codeMode && serial.length)
      trace.steps.push({
        title: 'Latest serial output',
        lane: 'Executed teaching code',
        detail: serial.slice(-4).join('\n'),
      });
    const event = { id: ++counter.current, label, tick, trace };
    setEvents((list) =>
      [
        ...(label === 'Simulation update' && list.at(-1)?.label === label
          ? list.slice(0, -1)
          : list),
        event,
      ].slice(-30),
    );
  }, [
    state.chip,
    state.devices,
    state.wires,
    state.rules,
    state.settings,
    state.template,
    state.program,
    state.running,
    tick,
    codeMode,
    codeError,
    serial,
  ]);
  return events;
}
