import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, makeSession, cookie, sameOrigin } from '../lib/admin-auth';
import { normalizeState } from '../lib/lab-state';
import { buildTemplate, templates } from '../lib/templates';
test('admin sessions reject absence, tampering, expiry and key rotation', async () => {
  const config = { ADMIN_SESSION_KEY: 'a'.repeat(64) },
    now = Date.now(),
    token = await makeSession(config, now);
  const request = (t: string) =>
    new Request('https://lab.example/api/admin/content', {
      headers: { cookie: 'esplab_admin=' + t },
    });
  assert.equal(await isAdmin(request(token), config, now), true);
  for (const t of ['', token + 'x', token.replace(/^./, '0')])
    assert.equal(await isAdmin(request(t), config, now), false);
  assert.equal(
    await isAdmin(request(token), config, now + 8 * 3600000 + 1),
    false,
  );
  assert.equal(
    await isAdmin(request(token), { ADMIN_SESSION_KEY: 'b'.repeat(64) }, now),
    false,
  );
  assert.equal(await isAdmin(request(token), {}, now), false);
  assert.match(
    cookie(request(token), token),
    /HttpOnly; SameSite=Strict; Max-Age=28800; Secure/,
  );
  assert.equal(
    sameOrigin(
      new Request('https://lab.example/api/admin/session', {
        headers: { Origin: 'https://evil.example' },
      }),
    ),
    false,
  );
});
test('public catalogs and imports reject restricted projects', () => {
  assert.equal(
    templates.some((t) => t.id.startsWith('luxot-')),
    false,
  );
  const state = { ...buildTemplate('dimmer'), restricted: true };
  assert.throws(() => normalizeState(state), /authenticated/);
  assert.equal(normalizeState(state, true).restricted, true);
  assert.throws(() => buildTemplate('luxot-voice'), /Unknown/);
});
