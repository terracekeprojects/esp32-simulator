import test from 'node:test';
import assert from 'node:assert/strict';
import { consequences, injectFault, faultScenarios } from '../lib/consequences';
import { buildTemplate } from '../lib/templates';
import { normalizeState } from '../lib/lab-state';
test('scenarios change actual circuit conditions without mutating their saved state', () => {
  const state = buildTemplate('dimmer'),
    before = JSON.stringify(state);
  for (const scenario of faultScenarios) {
    const next = injectFault(state, scenario.id);
    normalizeState(next);
    assert.equal(next.running, false);
    assert.notEqual(JSON.stringify(next), before);
    assert.ok(consequences(next).some((o) => o.severity !== 'normal'));
  }
  assert.equal(JSON.stringify(state), before);
  assert.ok(
    consequences(injectFault(state, 'ground')).some((o) =>
      o.effect.includes('shared reference'),
    ),
  );
  assert.ok(
    consequences(injectFault(state, 'memory')).some((o) =>
      o.title.includes('Memory allocation'),
    ),
  );
  assert.ok(
    consequences(injectFault(state, 'supply')).some((o) =>
      o.title.includes('Supply drop'),
    ),
  );
});
