import test from 'node:test';
import assert from 'node:assert/strict';
import { chips, defaultChip } from '../lib/hardware';
import {
  autoWire,
  compatible,
  deviceLibrary,
  generateCode,
  memoryBudget,
  validate,
  type Device,
  type Wire,
} from '../lib/simulation';
const device = (type: Device['type'], id: string = type): Device => ({
  id,
  type,
  value: 50,
});
test('every non-E22 profile can complete a valid LED circuit', () => {
  for (const chip of chips.filter((c) => c.id !== 'ESP32-E22')) {
    const ds = [device('led')],
      ws = autoWire(chip, ds, []);
    assert.equal(ws.length, 2, chip.id);
    assert.deepEqual(validate(chip, ds, ws).errors, [], chip.id);
  }
});
test('each enabled peripheral can be auto-wired independently on each supported profile', () => {
  for (const c of chips.filter((c) => c.id !== 'ESP32-E22'))
    for (const def of deviceLibrary) {
      if (
        (def.terminals.some((t) => t.type === 'i2s') && c.id === 'ESP32-C2') ||
        (def.terminals.some((t) => t.type === 'adc') &&
          !c.pins.some((p) => p.adc)) ||
        (def.id === 'p4panel' && c.id !== 'ESP32-P4')
      )
        continue;
      const ds = [device(def.id)],
        ws = autoWire(c, ds, []);
      assert.deepEqual(validate(c, ds, ws).errors, [], `${c.id}/${def.id}`);
    }
});
test('I2C sensor and display share two signals and pass validation', () => {
  const ds = [device('bme280'), device('oled')],
    ws = autoWire(defaultChip, ds, []);
  assert.equal(ws.length, 8);
  for (const t of ['SDA', 'SCL'])
    assert.equal(
      new Set(ws.filter((w) => w.terminal === t).map((w) => w.pinId)).size,
      1,
    );
  assert.deepEqual(validate(defaultChip, ds, ws).errors, []);
  assert.deepEqual(autoWire(defaultChip, ds, ws), ws);
});
test('missing ground blocks execution', () => {
  const ds = [device('led')],
    ws = autoWire(defaultChip, ds, []).filter((w) => w.terminal !== 'GND');
  assert.match(validate(defaultChip, ds, ws).errors.join(' '), /connect GND/);
});
test('input-only and memory pins cannot drive an LED; ground cannot replace a signal', () => {
  const c = chips[0],
    terminal = deviceLibrary[0].terminals[0];
  for (const id of ['GPIO34', 'GPIO6', 'GND', 'EN', '5V'])
    assert.equal(
      compatible(
        c.pins.find((p) => p.id === id)!,
        terminal,
      ),
      false,
      id,
    );
  assert.equal(
    compatible(
      c.pins.find((p) => p.id === 'GPIO25')!,
      terminal,
    ),
    true,
  );
});
test('5V is rejected for a 3.3V peripheral and a non-ADC pin for the wiper', () => {
  const v = deviceLibrary.find((d) => d.id === 'pot')!;
  assert.equal(
    compatible(
      defaultChip.pins.find((p) => p.id === '5V')!,
      v.terminals[0],
    ),
    false,
  );
  assert.equal(
    compatible(
      defaultChip.pins.find((p) => p.id === 'GPIO38')!,
      v.terminals[1],
    ),
    false,
  );
});
test('shorting clock and data or sharing a digital output produces a conflict', () => {
  const ds = [device('oled')],
    ws = autoWire(defaultChip, ds, []);
  const sda = ws.find((w) => w.terminal === 'SDA')!;
  const bad = ws.map((w) =>
    w.terminal === 'SCL' ? { ...w, pinId: sda.pinId } : w,
  );
  assert.match(validate(defaultChip, ds, bad).errors.join(' '), /conflict/);
  const leds = [device('led', 'a'), device('led', 'b')];
  const lw = autoWire(defaultChip, leds, []);
  const out = lw.find((w) => w.deviceId === 'a' && w.terminal !== 'GND')!;
  assert.match(
    validate(
      defaultChip,
      leds,
      lw.map((w) =>
        w.deviceId === 'b' && w.terminal !== 'GND'
          ? { ...w, pinId: out.pinId }
          : w,
      ),
    ).errors.join(' '),
    /conflict/,
  );
});
test('duplicate I2C addresses cannot share a bus', () => {
  const ds = [device('oled', 'a'), device('oled', 'b')];
  assert.match(
    validate(defaultChip, ds, autoWire(defaultChip, ds, [])).errors.join(' '),
    /same address/,
  );
});
test('memory overflow can be relieved by supported external RAM', () => {
  const a = memoryBudget(defaultChip, [], true, true, 0, 1024);
  assert.equal(a.overflow, true);
  const b = memoryBudget(defaultChip, [], true, true, 8, 1024);
  assert.equal(b.overflow, false);
  assert.equal(b.external, 1174);
  assert.equal(b.internal, 168);
  assert.equal(b.free, 344);
});
test('generated C uses the selected pin and leaves missing pins explicit', () => {
  const ds = [device('led')],
    ws = autoWire(defaultChip, ds, []);
  const pin = ws.find((w) => w.terminal !== 'GND')!.pinId.slice(4);
  assert.ok(
    generateCode(defaultChip, ds, ws).includes(`gpio_set_level(${pin}, 1)`),
  );
  assert.ok(generateCode(defaultChip, ds, []).includes('/* assign GPIO */ -1'));
});
test('catalog pins are unique and every quiz has a valid answer', async () => {
  for (const c of chips)
    assert.equal(new Set(c.pins.map((p) => p.id)).size, c.pins.length, c.id);
  const { lessons } = await import('../lib/lessons');
  assert.equal(lessons.length, 12);
  for (const l of lessons)
    assert.ok(l.correct >= 0 && l.correct < l.answers.length);
});
