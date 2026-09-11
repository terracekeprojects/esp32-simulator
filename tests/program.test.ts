import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileProgram,
  executeProgram,
  freshRuntime,
  programExamples,
} from '../lib/program';
import { buildTemplate } from '../lib/templates';
import { applyActions, normalizeState } from '../lib/lab-state';
import { parsePlan } from '../lib/ollama';
test('all program examples compile and run on matching circuits', () => {
  for (const e of programExamples) {
    const s = buildTemplate(e.template);
    const result = executeProgram(compileProgram(e.source), s, freshRuntime());
    assert.equal(result.runtime.initialized, true, e.id);
    assert.ok(result.runtime.ms > 0, e.id);
  }
});
test('blink changes the actual virtual LED across loop ticks', () => {
  const s = buildTemplate('dimmer'),
    p = compileProgram(programExamples[0].source);
  let r = executeProgram(p, s, freshRuntime());
  assert.equal(r.devices[1].value, 100);
  r = executeProgram(p, { ...s, devices: r.devices }, r.runtime);
  r = executeProgram(p, { ...s, devices: r.devices }, r.runtime);
  assert.equal(r.devices[1].value, 0);
});
test('temperature program reads edited input and drives the fan', () => {
  const s = buildTemplate('greenhouse');
  s.devices[1].value = 35;
  const r = executeProgram(
    compileProgram(programExamples[2].source),
    s,
    freshRuntime(),
  );
  assert.equal(r.devices[3].value, 80);
  assert.ok(r.logs[0].includes('35'));
});
test('failed program does not partially mutate circuit or runtime', () => {
  const s = buildTemplate('dimmer'),
    runtime = freshRuntime(),
    before = JSON.stringify(s);
  assert.throws(() =>
    executeProgram(
      compileProgram('void loop(){ write("led",20); write("missing",10); }'),
      s,
      runtime,
    ),
  );
  assert.equal(JSON.stringify(s), before);
  assert.equal(runtime.initialized, false);
});
test('unsafe and unsupported execution is rejected', () => {
  for (const source of [
    'void loop(){while(true){}}',
    'void loop(){fetch("https://evil.test");}',
    'void loop(){ Serial.println(1 / 0); }',
    'void loop(){ int __proto__ = 7; }',
  ])
    assert.throws(() =>
      executeProgram(
        compileProgram(source),
        buildTemplate('dimmer'),
        freshRuntime(),
      ),
    );
  assert.throws(() =>
    compileProgram('void loop(){' + 'if(1){'.repeat(30) + '}'.repeat(30) + '}'),
  );
});
test('GPIO output access respects input-only pins and wiring', () => {
  const s = buildTemplate('dimmer');
  s.chip = 'ESP32';
  s.wires = s.wires.map((w) =>
    w.terminal === 'WIPER' ? { ...w, pinId: 'GPIO34' } : w,
  );
  s.wires = s.wires.map((w) =>
    w.deviceId === s.devices[1].id && w.terminal !== 'GND'
      ? { ...w, pinId: 'GPIO25' }
      : w,
  );
  assert.throws(() =>
    executeProgram(
      compileProgram('void loop(){ digitalWrite(34,HIGH); }'),
      s,
      freshRuntime(),
    ),
  );
  const r = executeProgram(
    compileProgram('void loop(){ digitalWrite(25,HIGH); }'),
    s,
    freshRuntime(),
  );
  assert.equal(r.devices[1].value, 100);
});
test('program source round trips and AI code actions are syntax checked', () => {
  const s = buildTemplate('dimmer'),
    source = programExamples[1].source;
  const updated = applyActions(s, [{ type: 'set_code', key: source }]);
  assert.equal(
    normalizeState(JSON.parse(JSON.stringify(updated))).program,
    source,
  );
  assert.throws(() => applyActions(s, [{ type: 'set_code', key: 'broken' }]));
});
test('Ollama and manual handoff replies validate before application', () => {
  const s = buildTemplate('dimmer');
  const reply = parsePlan(
    '```json\n{"message":"Ready","actions":[{"type":"set_value","target":"led","value":33}]}\n```',
    s,
  );
  assert.equal(applyActions(s, reply.actions).devices[1].value, 33);
  assert.throws(() =>
    parsePlan('{"message":"Bad","actions":[{"type":"shell"}]}', s),
  );
});
