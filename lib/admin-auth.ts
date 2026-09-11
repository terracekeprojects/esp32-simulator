export type AdminConfig = {
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SESSION_KEY?: string;
  PRIVATE_VAULT_KEY?: string;
};
const encoder = new TextEncoder();
export const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), (v) => v.toString(16).padStart(2, '0')).join(
    '',
  );
export async function digest(text: string) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}
export function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function sign(payload: string, key: string) {
  const k = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', k, encoder.encode(payload)));
}
export async function makeSession(config: AdminConfig, now = Date.now()) {
  if (!config.ADMIN_SESSION_KEY) throw Error('Admin login is not configured.');
  const payload = `${now + 8 * 60 * 60 * 1000}.${crypto.randomUUID()}`;
  return payload + '.' + (await sign(payload, config.ADMIN_SESSION_KEY));
}
export async function isAdmin(
  request: Request,
  config: AdminConfig,
  now = Date.now(),
) {
  if (!config.ADMIN_SESSION_KEY) return false;
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('esplab_admin='))
    ?.slice(13);
  if (!token || token.length > 200) return false;
  const parts = token.split('.');
  if (
    parts.length !== 3 ||
    !Number.isFinite(+parts[0]) ||
    +parts[0] < now ||
    +parts[0] > now + 8 * 60 * 60 * 1000
  )
    return false;
  return equal(
    parts[2],
    await sign(parts.slice(0, 2).join('.'), config.ADMIN_SESSION_KEY),
  );
}
export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export function cookie(request: Request, value: string, age = 28800) {
  return `esplab_admin=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
};
