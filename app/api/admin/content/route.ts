import { env } from 'cloudflare:workers';
import { isAdmin, privateHeaders, type AdminConfig } from '@/lib/admin-auth';
import { vault } from '@/lib/private-vault.generated';
type Entry = { body: string; type: string };
let cached: Promise<Record<string, Entry>> | undefined;
export async function GET(request: Request) {
  const config = env as unknown as AdminConfig;
  if (!(await isAdmin(request, config)))
    return Response.json(
      { error: 'Admin login required.' },
      { status: 401, headers: privateHeaders },
    );
  if (!config.PRIVATE_VAULT_KEY || !vault)
    return Response.json(
      { error: 'Private content is not installed.' },
      { status: 503, headers: privateHeaders },
    );
  try {
    cached ??= (async () => {
      const bytes = Uint8Array.from(atob(vault), (c) => c.charCodeAt(0)),
        key = await crypto.subtle.importKey(
          'raw',
          Uint8Array.from(config.PRIVATE_VAULT_KEY!.match(/../g)!, (b) =>
            parseInt(b, 16),
          ),
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        );
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes.slice(0, 12) },
        key,
        bytes.slice(12),
      );
      return JSON.parse(new TextDecoder().decode(plain));
    })();
    const files = await cached,
      file = new URL(request.url).searchParams.get('file') ?? 'index.html';
    const entry = Object.prototype.hasOwnProperty.call(files, file)
      ? files[file]
      : undefined;
    if (!entry)
      return new Response('Not found', {
        status: 404,
        headers: privateHeaders,
      });
    const bytes = Uint8Array.from(atob(entry.body), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      headers: {
        ...privateHeaders,
        'Content-Type': entry.type,
        'Content-Security-Policy': "frame-ancestors 'self'",
        ...(file.endsWith('.zip')
          ? {
              'Content-Disposition':
                'attachment; filename="private-firmware.zip"',
            }
          : {}),
      },
    });
  } catch {
    cached = undefined;
    return Response.json(
      { error: 'Private content could not be loaded.' },
      { status: 500, headers: privateHeaders },
    );
  }
}
