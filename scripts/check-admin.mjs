import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = process.env.LAB_CHECK_URL || 'http://localhost:3001';
const extra = process.env.LAB_CHECK_BEARER
  ? { 'OAI-Sites-Authorization': 'Bearer ' + process.env.LAB_CHECK_BEARER }
  : {};
const get = (p, cookie) =>
  fetch(base + p, {
    headers: { ...extra, ...(cookie ? { cookie } : {}) },
    redirect: 'manual',
  });
for (const path of [
  'index.html',
  'app.js',
  'manifest.json',
  'firmware.zip',
  'source/s3/src/main.cpp.txt',
  '../.private/secrets.json',
]) {
  const r = await get('/api/admin/content?file=' + encodeURIComponent(path));
  assert.equal(r.status, 401, path);
  assert.match(r.headers.get('cache-control'), /no-store/);
}
for (const path of [
  '/luxot-source/manifest.json',
  '/luxot-firmware-source.zip',
])
  assert.equal((await get(path)).status, 404, path);
const password = (await readFile('.private/admin-login.txt', 'utf8')).match(
  /Password: (.+)/,
)[1];
const login = await fetch(base + '/api/admin/session', {
  method: 'POST',
  headers: { ...extra, Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie').split(';')[0];
assert.equal(
  (await (await get('/api/admin/session', cookie)).json()).admin,
  true,
);
const manifestResponse = await get(
  '/api/admin/content?file=manifest.json',
  cookie,
);
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
assert.equal(manifest.files.length, 139);
for (const file of manifest.files) {
  const r = await get(file.url, cookie);
  assert.equal(r.status, 200, file.path);
  assert.ok((await r.text()).length > 0, file.path);
}
const app = await get('/api/admin/content?file=app.js', cookie);
assert.equal(app.status, 200);
assert.match(await app.text(), /LuxOT/);
const zip = await get('/api/admin/content?file=firmware.zip', cookie);
assert.equal(zip.status, 200);
assert.equal(zip.headers.get('content-type'), 'application/zip');
assert.equal(
  (await get('/api/admin/content?file=../.private/secrets.json', cookie))
    .status,
  404,
);
const reject = await fetch(base + '/api/admin/session', {
  method: 'POST',
  headers: {
    ...extra,
    Origin: 'https://untrusted.example',
    'Content-Type': 'application/json',
  },
  body: '{}',
});
assert.equal(reject.status, 403);
const logout = await fetch(base + '/api/admin/session', {
  method: 'DELETE',
  headers: { ...extra, Origin: base, cookie },
});
assert.equal(logout.status, 200);
assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
assert.equal((await get('/api/admin/content?file=manifest.json')).status, 401);
console.log(
  'Admin HTTP checks passed: anonymous denial, login, 139 protected sources, bundle, ZIP, traversal, origin and logout.',
);
