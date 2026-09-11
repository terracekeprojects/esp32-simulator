// Optional owner-only content. Input and output are ignored by Git.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, createCipheriv, createHash } from 'node:crypto';
import path from 'node:path';
const root = process.cwd();
await mkdir('.private/build', { recursive: true });
let secrets;
try {
  secrets = JSON.parse(await readFile('.private/secrets.json', 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
  const password = randomBytes(24).toString('base64url');
  secrets = {
    ADMIN_PASSWORD_HASH: createHash('sha256').update(password).digest('hex'),
    ADMIN_SESSION_KEY: randomBytes(32).toString('hex'),
    PRIVATE_VAULT_KEY: randomBytes(32).toString('hex'),
  };
  await writeFile('.private/secrets.json', JSON.stringify(secrets));
  await writeFile(
    '.private/admin-login.txt',
    'ESPLAB admin login\nUsername: admin\nPassword: ' +
      password +
      '\n\nKeep this file private. Session duration: 8 hours. Rotate ADMIN_SESSION_KEY to invalidate all sessions.\n',
  );
}
// Preserve unrelated local environment bindings.
let vars = '';
try {
  vars = await readFile('.dev.vars', 'utf8');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
vars = vars
  .split(/\r?\n/)
  .filter((l) => !Object.keys(secrets).some((k) => l.startsWith(k + '=')))
  .join('\n');
await writeFile(
  '.dev.vars',
  vars.trim() +
    '\n' +
    Object.entries(secrets)
      .map(([k, v]) => k + '=' + JSON.stringify(v))
      .join('\n') +
    '\n',
);
await build({
  entryPoints: ['.private/entry.tsx'],
  outfile: '.private/build/app.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  minify: true,
  jsx: 'automatic',
  alias: { '@': root },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const entries = {};
const add = (name, data, type) =>
  (entries[name] = { body: Buffer.from(data).toString('base64'), type });
add(
  'index.html',
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Private projects</title></head><body><div id="root"></div><script type="module" src="/api/admin/content?file=app.js"></script></body></html>',
  'text/html; charset=utf-8',
);
add(
  'app.js',
  await readFile('.private/build/app.js'),
  'text/javascript; charset=utf-8',
);
add('firmware.zip', await readFile('.private/firmware.zip'), 'application/zip');
const manifest = JSON.parse(
  await readFile('.private/source/manifest.json', 'utf8'),
);
for (const f of manifest.files) {
  const name = 'source/' + f.path + '.txt',
    resolved = path.resolve('.private', name);
  if (!resolved.startsWith(path.resolve('.private/source') + path.sep))
    throw Error('Invalid source path');
  add(name, await readFile(resolved), 'text/plain; charset=utf-8');
  f.url = '/api/admin/content?file=' + encodeURIComponent(name);
}
add(
  'manifest.json',
  JSON.stringify(manifest),
  'application/json; charset=utf-8',
);
const iv = randomBytes(12),
  cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(secrets.PRIVATE_VAULT_KEY, 'hex'),
    iv,
  );
const encrypted = Buffer.concat([
  iv,
  cipher.update(JSON.stringify(entries)),
  cipher.final(),
  cipher.getAuthTag(),
]);
await writeFile(
  'lib/private-vault.generated.ts',
  '// Server-only encrypted deployment data. Never add this file to public source.\nexport const vault = ' +
    JSON.stringify(encrypted.toString('base64')) +
    ';\n',
);
console.log(
  'Built private content vault: ' +
    manifest.files.length +
    ' source files. Credentials saved in .private/admin-login.txt.',
);
