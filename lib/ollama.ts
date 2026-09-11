import { deviceLibrary } from './simulation';
import { templates } from './templates';
import { settingsSpec, deviceKnobs, valueSpec } from './parameters';
import {
  applyActions,
  normalizeState,
  type LabState,
  type Action,
} from './lab-state';
// Local Ollama can enforce a schema; cloud responses still require validation.
export const replySchema = {
  type: 'object',
  required: ['message', 'actions'],
  additionalProperties: false,
  properties: {
    message: { type: 'string' },
    actions: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        required: ['type'],
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            enum: [
              'set_code',
              'load_template',
              'add_device',
              'remove_device',
              'set_value',
              'set_parameter',
              'set_global',
              'auto_wire',
              'connect',
              'run',
              'pause',
              'clear',
            ],
          },
          target: { type: 'string' },
          key: { type: 'string' },
          value: { type: 'number' },
          pin: { type: 'string' },
        },
      },
    },
  },
};
export function assistantContext(state: LabState) {
  return {
    chip: state.chip,
    devices: state.devices,
    wires: state.wires.map((w) => ({
      deviceId: w.deviceId,
      terminal: w.terminal,
      pinId: w.pinId,
    })),
    rules: state.rules,
    settings: state.settings,
    program: state.program,
  };
}
export function tutorInstructions(state: LabState) {
  return `You are ESPLAB, an ESP32 teacher and virtual circuit assistant. Answer briefly and accurately. This is a behavioral teaching simulator, not a real MCU emulator. Return ONLY JSON: {"message":"your answer","actions":[]}. Questions need no actions. For circuit tasks use at most 12 ordered actions. Valid actions: {"type":"load_template","target":"template id"}, {"type":"add_device","target":"device type"}, {"type":"set_value","target":"device id or type","value":number}, {"type":"set_global","key":"setting key","value":number}, {"type":"set_parameter","target":"device id or type","key":"parameter","value":number}, {"type":"auto_wire"}, {"type":"run"}, {"type":"pause"}, {"type":"set_code","key":"program source"}. Only replace a circuit when requested. Prefer load_template for projects. Templates: ${JSON.stringify(templates.map((t) => ({ id: t.id, name: t.name })))}. Devices and value ranges: ${JSON.stringify(deviceLibrary.map((d) => ({ id: d.id, name: d.name, min: valueSpec(d.id).min, max: valueSpec(d.id).max })))}. Settings: ${JSON.stringify(settingsSpec.map((s) => ({ key: s.key, min: s.min, max: s.max })))}. Current device parameters: ${JSON.stringify(state.devices.map((d) => ({ id: d.id, parameters: deviceKnobs(d.type).map((k) => ({ key: k.key, min: k.min, max: k.max })) })))}. Code is a restricted Arduino-style interpreter: void setup(){}, void loop(){}, int/float/bool/let variables, assignments, if(condition){...}else{...}, arithmetic, comparisons, read("device-type") in physical units, write("device-type",number), millis(), delay(ms), Serial.begin(115200), Serial.println(expression), map(v,inMin,inMax,outMin,outMax), constrain(v,min,max), min,max,abs. No arrays, includes, libraries, user functions, while/for, ternary or JavaScript. End statements with semicolons. After set_code the user runs code in Code studio. Never access files, execute shell commands or expose secrets.`;
}
export function parsePlan(text: string, state: LabState) {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let plan: { message: string; actions: Action[] };
  try {
    plan = JSON.parse(clean);
  } catch {
    throw Error(
      'The model did not return a complete JSON plan. Try a shorter request.',
    );
  }
  if (
    !plan ||
    typeof plan.message !== 'string' ||
    plan.message.length > 20000 ||
    !Array.isArray(plan.actions) ||
    plan.actions.length > 24
  )
    throw Error('Invalid assistant reply.');
  applyActions(state, plan.actions);
  return { ...plan, mode: 'ai' as const };
}
export async function askOllama(
  body: unknown,
  options: {
    url: string;
    model: string;
    key?: string;
    cloud?: boolean;
    signal?: AbortSignal;
    repair?: boolean;
    allowPrivate?: boolean;
  },
): Promise<{
  message: string;
  actions: Action[];
  mode: 'ai';
  provider: string;
  model: string;
}> {
  const b = body as {
    state: LabState;
    message: string;
    history?: { role: string; content: string }[];
  };
  const state = normalizeState(b.state, options.allowPrivate);
  if (
    typeof b.message !== 'string' ||
    !b.message.trim() ||
    b.message.length > 4000
  )
    throw Error('Enter a message between 1 and 4,000 characters.');
  const history = Array.isArray(b.history)
    ? b.history
        .slice(-4)
        .filter(
          (m) =>
            m &&
            ['assistant', 'user'].includes(m.role) &&
            typeof m.content === 'string',
        )
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];
  const response = await fetch(options.url + '/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.key ? { Authorization: `Bearer ${options.key}` } : {}),
    },
    signal: options.signal ?? AbortSignal.timeout(180000),
    body: JSON.stringify({
      model: options.model,
      stream: false,
      ...(!options.cloud ? { format: replySchema, think: false } : {}),
      keep_alive: '5m',
      options: {
        temperature: 0.1,
        num_ctx: 8192,
        num_predict: 1800,
        num_batch: 64,
      },
      messages: [
        {
          role: 'system',
          content:
            tutorInstructions(state) +
            '\nExample of correct code JSON encoding: ' +
            JSON.stringify({
              message: 'Proposed program',
              actions: [
                {
                  type: 'set_code',
                  key: 'void setup() { }\nvoid loop() { write("led", 50); delay(250); }',
                },
              ],
            }) +
            ' The key field contains source code itself. Escape JSON once, not twice. Never say changes are applied before the user reviews them.',
        },
        ...history,
        {
          role: 'user',
          content: JSON.stringify({
            request: b.message,
            circuit: assistantContext(state),
          }),
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw Error(
      response.status === 401
        ? 'Ollama cloud requires sign-in. Run ollama signin on this computer.'
        : response.status === 429
          ? 'Ollama cloud allowance reached. Switch to a local model; no upgrade is required.'
          : `Ollama returned ${response.status}: ${detail}`,
    );
  }
  const result = (await response.json()) as {
    message?: { content?: string };
    error?: string;
  };
  if (!result.message?.content)
    throw Error(result.error || 'Ollama returned an empty response.');
  let plan;
  try {
    plan = parsePlan(result.message.content, state);
  } catch (error) {
    if (options.repair) throw error;
    return askOllama(
      {
        ...b,
        message: (
          'Repair the preceding proposed plan for my request: ' +
          b.message +
          ' Validation failed: ' +
          (error instanceof Error ? error.message : 'Invalid plan') +
          '. Return corrected JSON only. Code must have void setup() and void loop(). The key field is source code, not a filename. Use ordinary quoted device names in decoded source, with JSON escaped exactly once.'
        ).slice(0, 4000),
        history: [
          ...history,
          { role: 'assistant', content: result.message.content },
        ],
      },
      { ...options, repair: true },
    );
  }
  return {
    ...plan,
    provider: options.cloud ? 'ollama-cloud' : 'ollama-local',
    model: options.model,
  };
}
