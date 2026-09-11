import type { LabState } from './lab-state';
import { chips } from './hardware';
import { definition, validate } from './simulation';
import { readout } from './parameters';

export type TraceStep = {
  title: string;
  lane: string;
  detail: string;
  source?: string;
  warning?: boolean;
};
export type Trace = { title: string; summary: string; steps: TraceStep[] };

export function circuitTrace(
  state: LabState,
  deviceId: string,
  codeMode: boolean,
  tick: number,
  codeError?: string,
): Trace {
  const chip = chips.find((c) => c.id === state.chip)!;
  const d = state.devices.find((d) => d.id === deviceId) ?? state.devices[0];
  if (!d)
    return {
      title: 'Build your first signal path',
      summary: 'Add a device and wire its terminals to see the path here.',
      steps: [
        {
          title: 'Choose an input or output',
          lane: 'Workbench',
          detail:
            'A sensor measures something. Firmware processes the reading. An output turns that decision into light, movement, sound or pixels.',
        },
      ],
    };
  const def = definition(d);
  const wires = state.wires.filter((w) => w.deviceId === d.id);
  const routes = wires.map((w) => `${w.terminal} → ${w.pinId}`).join(' · ');
  const issues = validate(chip, state.devices, state.wires);
  const rules = state.rules.filter(
    (r) => r.enabled && (r.source === d.id || r.target === d.id),
  );
  return {
    title: `${def.name}: from connection to behavior`,
    summary: `Snapshot at simulator tick ${tick}. ${state.running ? 'Simulation running' : 'Simulation paused'}. This is a circuit explanation; playback time is slowed for learning, not a measured CPU trace.`,
    steps: [
      {
        title: 'Physical device',
        lane: 'Environment',
        detail: `${def.name} currently reads ${readout(d, state.settings, tick)}. Device parameters: ${JSON.stringify(d.params ?? {})}.`,
      },
      {
        title: 'Pins and electrical path',
        lane: 'Connections',
        detail:
          routes ||
          'No terminals are wired. Connect power, ground and the required signal terminals in Devices & wiring.',
        warning: !wires.length,
      },
      {
        title: 'Peripheral interface',
        lane: chip.name,
        detail: `${def.terminals.map((t) => `${t.name}: ${t.type}`).join(' · ')}. Power supplies the device; ground establishes the reference; signal pins carry data. A peripheral and its driver interpret that data.`,
      },
      {
        title: codeMode ? 'Your program decides' : 'Automation decides',
        lane: 'CPU / firmware',
        detail: codeMode
          ? `The Code studio executes its supported setup()/loop() teaching subset. ${codeError ? `Execution stopped: ${codeError}` : 'Inspect variables and the serial monitor for the actual executed result; this explanation does not infer a C++ call graph.'}`
          : rules.length
            ? rules
                .map(
                  (r) =>
                    `${r.source} → ${r.target}: ${r.mode}, threshold ${r.threshold}, output ${r.output}, otherwise ${r.otherwise}`,
                )
                .join('\n')
            : 'No enabled automation rule involves this device. Its value remains controlled by the device parameters.',
        warning: !!codeError,
      },
      {
        title: 'Where the bytes live',
        lane: 'Memory',
        detail: `${chip.sram} KB on-chip SRAM is shared by firmware data, stacks and buffers; it is not all free heap. ${chip.rom ?? 'Unspecified'} KB ROM holds built-in routines and boot code. Flash stores firmware and persistent data. ${chip.psram ? 'External PSRAM can hold larger buffers when fitted and configured.' : 'This profile does not provide external PSRAM support.'} Browser state here is a teaching model, not a heap measurement.`,
      },
      {
        title: 'Observe the result',
        lane: 'Output / feedback',
        detail: `${readout(d, state.settings, tick)}. ${issues.errors.length + issues.warnings.length ? `${issues.errors.length} errors and ${issues.warnings.length} warnings need review in the Workbench checks.` : 'Circuit checks currently pass. Changing a sensor, wire, rule, code or parameter changes the next captured explanation.'}`,
        warning: issues.errors.length > 0,
      },
    ],
  };
}

export function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let b = 0; b < 8; b++)
      crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc;
}
export function encodeFrame(payload: object): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(payload));
  if (!body.length || body.length > 509)
    throw Error('Payload must be 1–509 UTF-8 bytes.');
  const frame = new Uint8Array(body.length + 5);
  frame.set([0xa5, body.length & 255, body.length >> 8]);
  frame.set(body, 3);
  const crc = crc16(body);
  frame.set([crc & 255, crc >> 8], body.length + 3);
  return frame;
}
export function decodeFrame(frame: Uint8Array): Record<string, unknown> {
  const length = frame[1] | (frame[2] << 8);
  if (
    frame[0] !== 0xa5 ||
    length < 1 ||
    length > 509 ||
    frame.length !== length + 5
  )
    throw Error('Invalid frame length or sentinel.');
  const bytes = frame.slice(3, 3 + length);
  if (crc16(bytes) !== (frame[length + 3] | (frame[length + 4] << 8)))
    throw Error('CRC mismatch: discard frame and request fresh state.');
  const value: unknown = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  );
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Expected a JSON object.');
  return value as Record<string, unknown>;
}
