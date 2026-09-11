import { createServer } from 'node:http';
import { askOllama } from '../lib/ollama';
const PORT = 11435,
  OLLAMA = 'http://127.0.0.1:11434';
const origins = new Set([
  'https://your-site.example',
  'http://localhost:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
]);
let busy = false;
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const send = (status: number, data: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(data));
  };
  if (!['127.0.0.1:11435', 'localhost:11435'].includes(req.headers.host ?? ''))
    return send(403, { error: 'Unexpected host.' });
  if (!origin || !origins.has(origin))
    return send(403, {
      error: 'This bridge accepts requests only from ESPLAB.',
    });
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    if (req.method === 'GET' && req.url === '/status') {
      const r = await fetch(OLLAMA + '/api/tags', {
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw Error('Cannot read Ollama models.');
      const data = (await r.json()) as {
        models: { name: string; remote_host?: string }[];
      };
      const models = data.models.map((m) => ({
        name: m.name,
        cloud: !!m.remote_host || m.name.includes('cloud'),
      }));
      return send(200, {
        available: true,
        models,
        defaultModel:
          models.find((m) => m.name === 'qwen3:4b')?.name ??
          models.find((m) => !m.cloud)?.name ??
          models.find((m) => m.name === 'gpt-oss:120b-cloud')?.name ??
          '',
      });
    }
    if (req.method === 'POST' && req.url === '/chat') {
      if (busy)
        return send(429, {
          error: 'The local model is answering another request.',
        });
      if (!req.headers['content-type']?.startsWith('application/json'))
        return send(415, { error: 'JSON required.' });
      let raw = '';
      for await (const chunk of req) {
        raw += chunk.toString();
        if (raw.length > 100000)
          return send(413, { error: 'Request too large.' });
      }
      const body = JSON.parse(raw);
      if (
        typeof body.model !== 'string' ||
        !/^[a-zA-Z0-9_.:/-]{1,100}$/.test(body.model)
      )
        throw Error('Choose an installed Ollama model.');
      const tags = (await fetch(OLLAMA + '/api/tags').then((r) =>
        r.json(),
      )) as { models: { name: string; remote_host?: string }[] };
      const installed = tags.models.find((m) => m.name === body.model);
      if (!installed)
        throw Error('That model is not installed. Pull it with Ollama first.');
      if (
        (installed.remote_host || installed.name.includes('cloud')) &&
        !body.allowCloud
      )
        throw Error(
          'Enable cloud explicitly to use your Ollama account allowance.',
        );
      if (busy)
        return send(429, {
          error: 'The local model is answering another request.',
        });
      busy = true;
      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });
      const timer = setTimeout(() => abort.abort(), 180000);
      try {
        return send(
          200,
          await askOllama(body, {
            url: OLLAMA,
            model: body.model,
            cloud: !!installed.remote_host || installed.name.includes('cloud'),
            signal: abort.signal,
            allowPrivate: true, // Processes only the caller-supplied circuit; no private vault access.
          }),
        );
      } finally {
        busy = false;
        clearTimeout(timer);
      }
    }
    send(404, { error: 'Endpoint not found.' });
  } catch (e) {
    send(502, {
      error: e instanceof Error ? e.message : 'Local model failed.',
    });
  }
});
server.listen(PORT, '127.0.0.1', () =>
  console.log(
    'ESPLAB Ollama bridge ready at http://127.0.0.1:11435 (loopback only).',
  ),
);
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
