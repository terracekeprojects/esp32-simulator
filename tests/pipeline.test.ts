import test from 'node:test';
import assert from 'node:assert/strict';
import { crc16, encodeFrame, decodeFrame, circuitTrace } from '../lib/pipeline';
import { buildTemplate } from '../lib/templates';

test('UART CRC matches the standard CCITT-FALSE check vector', () => {
  assert.equal(crc16(new TextEncoder().encode('123456789')), 0x29b1);
});
test('UART preserves JSON including UTF-8 and rejects corrupt bytes', () => {
  const payload = { action: 'toggle_device', id: 'lamp "café"', on: 1 };
  const frame = encodeFrame(payload);
  assert.equal(frame[0], 0xa5);
  assert.equal(
    frame[1] | (frame[2] << 8),
    new TextEncoder().encode(JSON.stringify(payload)).length,
  );
  assert.deepEqual(decodeFrame(frame), payload);
  for (let i = 3; i < frame.length; i++) {
    const corrupted = frame.slice();
    corrupted[i] ^= 1;
    assert.throws(() => decodeFrame(corrupted), /CRC/);
  }
  assert.throws(() => decodeFrame(frame.slice(0, -1)), /length/);
  assert.throws(() => encodeFrame({ data: 'x'.repeat(510) }), /509/);
});
test('workbench trace follows actual wires, errors and changed input values', () => {
  const state = buildTemplate('address-collision');
  const sensor = state.devices.find((d) => d.type === 'bme280')!;
  sensor.value = 38;
  const trace = circuitTrace(state, sensor.id, false, 12);
  assert.ok(trace.steps[0].detail.includes('38'));
  assert.ok(trace.steps[1].detail.includes('SDA'));
  assert.match(trace.summary, /tick 12/);
  const before = trace.steps[0].detail;
  sensor.value = 18;
  assert.equal(
    trace.steps[0].detail,
    before,
    'captured trace is an immutable value snapshot',
  );
  state.wires = [];
  assert.ok(circuitTrace(state, sensor.id, false, 13).steps[1].warning);
  assert.ok(
    circuitTrace(state, sensor.id, true, 13, 'Unknown function').steps[3]
      .warning,
  );
});
