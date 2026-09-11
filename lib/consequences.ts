import type { LabState } from './lab-state';
import { chips } from './hardware';
import { definition, validate } from './simulation';
import { telemetry, readout } from './parameters';

export type Consequence = {
  title: string;
  cause: string;
  effect: string;
  test: string;
  severity: 'risk' | 'check' | 'normal';
};
export function consequences(state: LabState, tick = 0): Consequence[] {
  const chip = chips.find((c) => c.id === state.chip)!;
  const t = telemetry(chip, state.devices, state.settings),
    checks = validate(chip, state.devices, state.wires);
  const results: Consequence[] = [];
  for (const d of state.devices) {
    const def = definition(d),
      missing = def.terminals.filter(
        (p) =>
          !state.wires.some(
            (w) => w.deviceId === d.id && w.terminal === p.name,
          ),
      );
    if (missing.length)
      results.push({
        title: def.name + ' has an incomplete circuit',
        cause: 'Unconnected: ' + missing.map((p) => p.name).join(', '),
        effect: missing.some((p) => p.type === 'ground')
          ? 'Without a shared reference, logic readings can float or be unreliable. The device may appear dead or respond unpredictably.'
          : missing.some((p) => p.type === 'power')
            ? 'The device cannot operate normally without its required supply. Signal pins can sometimes back-power an unpowered chip.'
            : 'The data path is incomplete; firmware may read a constant, noise, or a bus timeout.',
        test: 'Restore the listed connections and compare the checks before running.',
        severity: 'risk',
      });
    else
      results.push({
        title: def.name,
        cause: 'Virtual value: ' + readout(d, state.settings, tick),
        effect:
          d.type === 'led'
            ? 'PWM duty changes the time the LED emits light. At zero it is dark; increasing duty increases average brightness.'
            : d.type === 'servo'
              ? 'A powered servo attempts the requested angle; load, mechanical stops and available current determine actual motion.'
              : d.type === 'relay'
                ? 'The driver changes the relay coil state. Contacts click and switch the external load; contact ratings and isolation must match that load.'
                : d.type === 'fan'
                  ? 'The driver changes fan power or PWM. Airflow and RPM depend on load and the real fan; low duty may stall it.'
                  : /oled|display|spi/.test(d.type)
                    ? 'Firmware transfers a framebuffer to the display. Slow transfers can produce visible lag; missing buffers can stop rendering.'
                    : 'The physical device produces or consumes this signal through its configured interface. Actual calibration, driver behavior and external conditions affect the result.',
        test: 'Change its value, run a tick and compare the signal story and serial monitor.',
        severity: 'normal',
      });
  }
  if (t.voltage < 3)
    results.unshift({
      title: 'Supply drop / possible resets',
      cause: `Estimated rail ${t.voltage.toFixed(2)} V after wiring loss.`,
      effect:
        'A real board may reset, lose radio connectivity or corrupt a peripheral transfer. The exact brownout threshold depends on chip and configuration.',
      test: 'Reduce wiring resistance or current demand. Measure the rail during load transients on hardware.',
      severity: 'risk',
    });
  if (t.internal > chip.sram)
    results.unshift({
      title: 'Memory allocation can fail',
      cause: `Estimated internal allocation ${t.internal.toFixed(0)} KB exceeds ${chip.sram} KB total SRAM.`,
      effect:
        'A framebuffer or audio allocation can fail. Firmware must handle a null allocation; otherwise it can crash or repeatedly reboot. Available heap is smaller than total SRAM.',
      test: 'Reduce resolution, color depth, audio duration or buffer count; use supported PSRAM.',
      severity: 'risk',
    });
  for (const issue of [...checks.errors, ...checks.warnings, ...t.warnings])
    results.push({
      title: 'Hardware check',
      cause: issue,
      effect:
        'This condition can prevent the intended behavior. The teaching model cannot predict damage, temperature or exact timing.',
      test: 'Resolve the reported condition, then rerun checks and compare.',
      severity: 'check',
    });
  return results;
}
export const faultScenarios = [
  {
    id: 'ground',
    name: 'Disconnect ground',
    description: 'Watch a valid device lose its signal reference.',
  },
  {
    id: 'supply',
    name: 'Weak power wiring',
    description: 'Increase wiring resistance and observe estimated rail drop.',
  },
  {
    id: 'memory',
    name: 'Large display buffers',
    description: 'Try two full-color frames in internal SRAM.',
  },
  {
    id: 'bus',
    name: 'Slow I²C edges',
    description: 'Combine bus capacitance and weak pull-ups at 400 kHz.',
  },
] as const;
export function injectFault(state: LabState, id: string): LabState {
  const next = structuredClone(state);
  next.running = false;
  if (id === 'ground') {
    const wire = next.wires.find((w) =>
      definition(next.devices.find((d) => d.id === w.deviceId)!).terminals.some(
        (t) => t.name === w.terminal && t.type === 'ground',
      ),
    );
    if (!wire) throw Error('Wire a device with a ground terminal first.');
    next.wires = next.wires.filter((w) => w.id !== wire.id);
  } else if (id === 'supply') {
    next.settings.resistance = 5;
    next.settings.voltage = 3.3;
  } else if (id === 'memory') {
    Object.assign(next.settings, {
      width: 1024,
      height: 600,
      bpp: 24,
      buffers: 2,
      psram: 0,
    });
  } else if (id === 'bus') {
    Object.assign(next.settings, { i2c: 400, pullup: 10000, capacitance: 600 });
  } else throw Error('Unknown scenario.');
  return next;
}
