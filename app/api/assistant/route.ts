import { env } from 'cloudflare:workers';
import { askOllama } from '@/lib/ollama';
import { isAdmin } from '@/lib/admin-auth';
const config = () => env as unknown as Record<string, string | undefined>;
export async function GET() {
  return Response.json({
    available: !!config().OLLAMA_API_KEY,
    provider: config().OLLAMA_API_KEY ? 'ollama-cloud' : 'local-bridge',
    mode: config().OLLAMA_API_KEY ? 'ai' : 'offline',
    model: config().OLLAMA_MODEL || null,
  });
}
const recent: number[] = [];
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: 'Cross-origin requests are not allowed.' },
      { status: 403 },
    );
  const key = config().OLLAMA_API_KEY;
  if (!key)
    return Response.json(
      {
        error:
          'Use Connect local Ollama in the assistant. No cloud key is configured.',
      },
      { status: 503 },
    );
  const now = Date.now();
  while (recent.length && recent[0] < now - 60000) recent.shift();
  if (recent.length >= 10)
    return Response.json(
      { error: 'Please wait before sending more requests.' },
      { status: 429 },
    );
  recent.push(now);
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 100000)
      throw Error('Request too large.');
    const raw = await request.text();
    if (raw.length > 100000) throw Error('Request too large.');
    return Response.json(
      await askOllama(JSON.parse(raw), {
        url: 'https://ollama.com',
        model: config().OLLAMA_MODEL || 'gpt-oss:120b',
        key,
        cloud: true,
        allowPrivate: await isAdmin(request, config()),
      }),
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Assistant request failed.' },
      { status: 400 },
    );
  }
}
