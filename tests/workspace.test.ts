import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialWorkspace,
  normalizeWorkspace,
  testBoardLink,
  stepWorkspace,
} from '../lib/workspace';
import { buildTemplate } from '../lib/templates';
import { normalizeState } from '../lib/lab-state';
import { voiceAction, runCircuitTests, wav16 } from '../lib/testing';

test('multi-board layout round trips independent circuits and positions', () => {
  const w = initialWorkspace();
  w.nodes[0].lab = buildTemplate('dimmer');
  w.nodes[0].lab.devices[0].position = { x: -3.5, z: 7 };
  const restored = normalizeWorkspace(JSON.parse(JSON.stringify(w)));
  assert.equal(restored.nodes.length, 2);
  assert.deepEqual(restored.nodes[0].lab.devices[0].position, {
    x: -3.5,
    z: 7,
  });
  assert.notEqual(restored.nodes[0].lab.chip, restored.nodes[1].lab.chip);
  const bad = structuredClone(w);
  bad.nodes[0].lab.devices[0].position = { x: 100, z: 0 };
  assert.throws(() => normalizeWorkspace(bad), /position/);
  bad.nodes[0].lab.devices[0].position = undefined;
  bad.nodes[1].id = bad.nodes[0].id;
  assert.throws(() => normalizeWorkspace(bad), /Duplicate/);
});
test('Board link delivers exact JSON and rejects electrical/protocol faults', () => {
  const w = initialWorkspace(),
    l = w.links[0],
    payload = { t: 'hb', tc: 28 };
  assert.deepEqual(testBoardLink(w, l, payload).decoded, payload);
  for (const fault of [
    { ground: false },
    { connected: false },
    { peerBaud: 9600 },
    { corrupt: true },
    { tx: '3V3' },
    { tx: 'GPIO26' },
  ])
    assert.throws(() => testBoardLink(w, { ...l, ...fault }, payload));
});
test('workspace automation changes only its own board state', () => {
  const w = initialWorkspace();
  w.nodes[0].lab = buildTemplate('greenhouse');
  w.nodes[0].lab.devices[1].value = 40;
  const before = JSON.stringify(w.nodes[1]),
    result = stepWorkspace(w);
  assert.equal(JSON.stringify(result.workspace.nodes[1]), before);
  assert.notEqual(
    result.workspace.nodes[0].lab.devices[3].value,
    w.nodes[0].lab.devices[3].value,
  );
});
test('reviewable voice grammar rejects negation, ambiguity and out-of-range values', () => {
  const s = buildTemplate('dimmer'),
    led = s.devices.find((d) => d.type === 'led')!;
  assert.deepEqual(voiceAction('turn on the LED', s), {
    message: 'Set LED + resistor to 100. Review before applying.',
    deviceId: led.id,
    value: 100,
  });
  assert.equal(voiceAction('switch the light off', s).value, 0);
  for (const text of [
    'do not turn on the LED',
    'turn on the LED and fan',
    'set led to 500 percent',
    'turn on the microwave',
  ])
    assert.equal(voiceAction(text, s).deviceId, undefined);
  s.devices.push({ ...led, id: 'second-led' });
  assert.equal(voiceAction('turn on the LED', s).deviceId, undefined);
});
test('circuit checks dry-run code without mutating devices or layout', () => {
  const s = buildTemplate('dimmer');
  s.program = 'void setup() {} void loop() { write("led", 60); delay(100); }';
  const before = JSON.stringify(s),
    report = runCircuitTests(s);
  assert.equal(JSON.stringify(s), before);
  assert.ok(
    report.some((r) => r.name === 'One-loop dry run' && r.status === 'pass'),
  );
  s.wires = [];
  assert.ok(
    runCircuitTests(s).some(
      (r) => r.name === 'Wiring & electrical rules' && r.status === 'fail',
    ),
  );
});
test('WAV export has mono 16 kHz metadata and clamps PCM safely', () => {
  const v = new DataView(wav16(new Float32Array([-2, 0, 2])));
  assert.equal(v.getUint32(24, true), 16000);
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(40, true), 6);
  assert.equal(v.getInt16(44, true), -32768);
  assert.equal(v.getInt16(48, true), 32767);
});
