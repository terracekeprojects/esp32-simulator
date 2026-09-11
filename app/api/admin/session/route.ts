import { env } from 'cloudflare:workers';
import {
  isAdmin,
  makeSession,
  digest,
  equal,
  cookie,
  sameOrigin,
  privateHeaders,
  type AdminConfig,
} from '@/lib/admin-auth';
const config = () => env as unknown as AdminConfig;
const attempts = new Map<string, { n: number; until: number }>();
export async function GET(request: Request) {
  return Response.json(
    {
      admin: await isAdmin(request, config()),
      configured: !!config().ADMIN_PASSWORD_HASH,
    },
    { headers: privateHeaders },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: 'Origin rejected.' },
      { status: 403, headers: privateHeaders },
    );
  const c = config();
  if (!c.ADMIN_PASSWORD_HASH || !c.ADMIN_SESSION_KEY)
    return Response.json(
      { error: 'Admin login is not configured.' },
      { status: 503, headers: privateHeaders },
    );
  const ip = request.headers.get('cf-connecting-ip') || 'local',
    now = Date.now();
  for (const [key, value] of attempts)
    if (value.until < now) attempts.delete(key);
  if (attempts.size > 1000) attempts.clear();
  const entry = attempts.get(ip) ?? { n: 0, until: now + 15 * 60 * 1000 };
  if (entry.n >= 8)
    return Response.json(
      { error: 'Too many attempts. Try again in 15 minutes.' },
      { status: 429, headers: privateHeaders },
    );
  entry.n++;
  attempts.set(ip, entry);
  try {
    const raw = await request.text();
    if (raw.length > 1024) throw Error();
    const data = JSON.parse(raw);
    if (
      data.username !== 'admin' ||
      typeof data.password !== 'string' ||
      !equal(await digest(data.password), c.ADMIN_PASSWORD_HASH)
    )
      throw Error();
    attempts.delete(ip);
    return Response.json(
      { admin: true },
      {
        headers: {
          ...privateHeaders,
          'Set-Cookie': cookie(request, await makeSession(c)),
        },
      },
    );
  } catch {
    return Response.json(
      { error: 'Invalid admin credentials.' },
      { status: 401, headers: privateHeaders },
    );
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  return Response.json(
    { admin: false },
    { headers: { ...privateHeaders, 'Set-Cookie': cookie(request, '', 0) } },
  );
}
