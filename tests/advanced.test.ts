import test from 'node:test';
import assert from 'node:assert/strict';
import { chips, defaultChip } from '../lib/hardware';
import { deviceLibrary, validate, autoWire } from '../lib/simulation';
import { templates, buildTemplate } from '../lib/templates';
import { applyActions, normalizeState, stepRules } from '../lib/lab-state';
import {
  defaultSettings,
  newDevice,
  telemetry,
  readout,
} from '../lib/parameters';
import { offlineReply } from '../lib/assistant';

test('every project has valid wiring except the deliberate address challenge', () => {
  for (const t of templates) {
    const s = buildTemplate(t.id);
    normalizeState(s);
    const errors = validate(
      chips.find((c) => c.id === s.chip)!,
      s.devices,
      s.wires,
    ).errors;
    if (t.id === 'address-collision')
      assert.match(errors.join(' '), /same address/);
    else assert.deepEqual(errors, [], t.id);
  }
});
test('greenhouse rules respond to independent temperature and moisture inputs', () => {
  const s = buildTemplate('greenhouse');
  s.devices[0].value = 10;
  s.devices[1].value = 35;
  let d = stepRules(s.devices, s.rules);
  assert.equal(d[2].value, 1);
  assert.equal(d[3].value, 80);
  d[0].value = 80;
  d[1].value = 20;
  d = stepRules(d, s.rules);
  assert.equal(d[2].value, 0);
  assert.equal(d[3].value, 0);
});
test('mapped values follow target range and preserve non-target parameters', () => {
  const s = buildTemplate('servo');
  s.devices[0].value = 25;
  const d = stepRules(s.devices, s.rules);
  assert.equal(d[1].value, 45);
  assert.deepEqual(d[1].params, s.devices[1].params);
});
test('cross-type I2C address collision can be resolved with a supported alternate address', () => {
  const s = buildTemplate('address-collision');
  const fixed = applyActions(s, [
    { type: 'set_parameter', target: 'bmp280', key: 'address', value: 119 },
    { type: 'run' },
  ]);
  assert.equal(fixed.running, true);
});
test('invalid assistant plan is atomic and never mutates its input', () => {
  const s = buildTemplate('dimmer'),
    before = JSON.stringify(s);
  assert.throws(() =>
    applyActions(s, [
      { type: 'add_device', target: 'servo' },
      { type: 'set_value', target: 'servo', value: 999 },
    ]),
  );
  assert.equal(JSON.stringify(s), before);
  assert.throws(() =>
    applyActions(s, [
      {
        type: 'connect',
        target: 'led',
        key: s.wires.find(
          (w) => w.deviceId === s.devices[1].id && w.terminal !== 'GND',
        )!.terminal,
        pin: 'GPIO46',
      },
    ]),
  );
});
test('offline task commands create and adjust real circuit state', () => {
  let s = buildTemplate('dimmer');
  for (const prompt of [
    'load greenhouse',
    'set fan rpm 3000',
    'set sht31 35',
    'auto-wire',
    'run',
  ]) {
    const reply = offlineReply(prompt, s);
    assert.ok(reply.actions.length, prompt);
    s = applyActions(s, reply.actions);
  }
  assert.equal(s.template, 'greenhouse');
  assert.equal(s.devices.find((d) => d.type === 'fan')?.params?.rpm, 3000);
  assert.equal(s.running, true);
  assert.equal(
    stepRules(s.devices, s.rules).find((d) => d.type === 'fan')?.value,
    80,
  );
});
test('serialization preserves settings and rules, rejects malformed or out-of-range data', () => {
  const s = buildTemplate('greenhouse');
  s.settings.noise = 50;
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))), s);
  assert.throws(() =>
    normalizeState({ ...s, devices: [{ ...s.devices[0], value: NaN }] }),
  );
  assert.throws(() =>
    normalizeState({ ...s, settings: { ...s.settings, pullup: 0 } }),
  );
  assert.throws(() =>
    normalizeState({ ...s, rules: [...s.rules, s.rules[0]] }),
  );
  assert.throws(() =>
    normalizeState({ ...s, wires: [...s.wires, s.wires[0]] }),
  );
});
test('power, bus, CPU, frame and audio parameters change derived telemetry', () => {
  const ds = [newDevice('neopixel')],
    a = telemetry(defaultChip, ds, defaultSettings),
    b = telemetry(defaultChip, ds, {
      ...defaultSettings,
      buffers: 2,
      audioMs: 80,
      resistance: 2,
      capacitance: 600,
      cycles: 1000000,
    });
  assert.equal(b.frame, a.frame * 2);
  assert.equal(b.audio, a.audio * 2);
  assert.ok(b.voltage < a.voltage);
  assert.ok(b.rise > a.rise);
  assert.ok(b.cpuLoad > a.cpuLoad);
  assert.ok(b.warnings.some((w) => w.includes('rise time')));
  ds[0].params!.pixels = 32;
  assert.ok(
    telemetry(defaultChip, ds, defaultSettings).extCurrent > a.extCurrent,
  );
});
test('memory challenge exceeds internal SRAM and can be relieved by smaller buffers', () => {
  const s = buildTemplate('ram-pressure'),
    c = chips.find((c) => c.id === s.chip)!;
  assert.ok(telemetry(c, s.devices, s.settings).internal > c.sram);
  s.settings.width = 128;
  s.settings.height = 64;
  s.settings.bpp = 1;
  s.settings.buffers = 1;
  assert.ok(telemetry(c, s.devices, s.settings).internal < c.sram);
});
test('device library is unique, extensive, and every model has adjustable readouts', () => {
  assert.ok(deviceLibrary.length >= 47);
  assert.equal(
    new Set(deviceLibrary.map((d) => d.id)).size,
    deviceLibrary.length,
  );
  for (const def of deviceLibrary) {
    const d = newDevice(def.id);
    assert.ok(Object.keys(d.params!).length >= 2);
    assert.ok(readout(d, defaultSettings).length > 0);
  }
});
test('twelve-device cap and rule output ranges are enforced', () => {
  const s = buildTemplate('dimmer');
  assert.throws(() =>
    applyActions(
      s,
      Array.from({ length: 11 }, () => ({
        type: 'add_device' as const,
        target: 'led',
      })),
    ),
  );
  assert.throws(() =>
    normalizeState({ ...s, rules: [{ ...s.rules[0], output: 500 }] }),
  );
});
