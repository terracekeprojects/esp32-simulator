import { chips } from './hardware';
import { validate, definition } from './simulation';
import { compileProgram, executeProgram, freshRuntime } from './program';
import { normalizeState, type LabState } from './lab-state';
import { valueSpec } from './parameters';

export type TestResult = {
  name: string;
  status: 'pass' | 'fail' | 'info';
  detail: string;
};
export function runCircuitTests(state: LabState): TestResult[] {
  const chip = chips.find((c) => c.id === state.chip)!;
  const checks = validate(chip, state.devices, state.wires);
  const results: TestResult[] = [
    {
      name: 'Wiring & electrical rules',
      status: checks.errors.length ? 'fail' : 'pass',
      detail:
        checks.errors.join('\n') ||
        'Required terminals, rails and GPIO compatibility pass.',
    },
    {
      name: 'Circuit warnings',
      status: 'info',
      detail: checks.warnings.join('\n') || 'No additional wiring warnings.',
    },
  ];
  if (!state.devices.length)
    results.push({
      name: 'Devices',
      status: 'info',
      detail:
        'This circuit has no peripherals yet. Add a device to test input/output behavior.',
    });
  if (state.program) {
    try {
      const program = compileProgram(state.program);
      results.push({
        name: 'Teaching code syntax',
        status: 'pass',
        detail: 'Program parses in the supported interpreter.',
      });
      if (!checks.errors.length) {
        const run = executeProgram(
          program,
          structuredClone(state),
          freshRuntime(),
        );
        results.push({
          name: 'One-loop dry run',
          status: 'pass',
          detail: `Virtual time ${run.runtime.ms} ms. ${run.logs.join('\n') || 'No serial output.'} The live circuit is unchanged.`,
        });
      }
    } catch (e) {
      results.push({
        name: 'Teaching code',
        status: 'fail',
        detail: (e as Error).message,
      });
    }
  }
  try {
    normalizeState(JSON.parse(JSON.stringify(state)));
    results.push({
      name: 'Project portability',
      status: 'pass',
      detail: 'Circuit configuration passes JSON import validation.',
    });
  } catch (e) {
    results.push({
      name: 'Project portability',
      status: 'fail',
      detail: (e as Error).message,
    });
  }
  return results;
}
export function voiceAction(
  text: string,
  state: LabState,
): { message: string; deviceId?: string; value?: number } {
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9 .%-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Intentionally bounded command grammar. Unrecognized or negated phrases never actuate.
  const on =
    clean.match(
      /^(?:please )?(?:turn|switch) (on|off) (?:the )?(led|light|lamp|fan|relay|buzzer)(?: please)?\.?$/,
    ) ??
    clean.match(
      /^(?:please )?(?:turn|switch) (?:the )?(led|light|lamp|fan|relay|buzzer) (on|off)(?: please)?\.?$/,
    );
  const set = clean.match(
    /^(?:please )?set (?:the )?(led|light|lamp|fan|servo|buzzer) (?:to )?(\d+(?:\.\d+)?)\s*(?:percent|%|degrees)?\.?$/,
  );
  if (!on && !set)
    return {
      message:
        'No device command matched. Try “turn on the LED”, “set fan to 60 percent” or “set servo to 90 degrees”.',
    };
  const words = on ? on.slice(1, 3) : [];
  const name = set?.[1] ?? words.find((w) => w !== 'on' && w !== 'off')!;
  const type = ['light', 'lamp'].includes(name) ? 'led' : name;
  const devices = state.devices.filter((d) => d.type === type);
  if (devices.length !== 1)
    return {
      message: devices.length
        ? 'More than one matching device exists. Select its value in Devices & wiring to avoid ambiguity.'
        : `Add a ${type} to the current board first.`,
    };
  const device = devices[0],
    spec = valueSpec(device.type),
    value = set ? Number(set[2]) : words.includes('on') ? spec.max : spec.min;
  if (value < spec.min || value > spec.max)
    return { message: `Value must be between ${spec.min} and ${spec.max}.` };
  return {
    message: `Set ${definition(device).name} to ${value}. Review before applying.`,
    deviceId: device.id,
    value,
  };
}
export function wav16(samples: Float32Array, rate = 16000): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2),
    view = new DataView(buffer);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
  });
  return buffer;
}
