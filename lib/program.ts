import type { Device } from './simulation';
import { definition, validate } from './simulation';
import { chips } from './hardware';
import { valueSpec, sensed } from './parameters';
import type { LabState } from './lab-state';

type Token = { text: string; line: number };
type Expr =
  | { kind: 'literal'; value: number | string }
  | { kind: 'name'; name: string }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'binary'; op: string; left: Expr; right: Expr }
  | { kind: 'unary'; op: string; expr: Expr };
type Statement =
  | { kind: 'assign'; name: string; expr: Expr; line: number }
  | { kind: 'expr'; expr: Expr; line: number }
  | { kind: 'if'; test: Expr; yes: Statement[]; no: Statement[]; line: number };
export type Program = {
  globals: Statement[];
  setup: Statement[];
  loop: Statement[];
};
export type Runtime = {
  vars: Record<string, number | string>;
  ms: number;
  initialized: boolean;
  delay: number;
};
const precedence: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};
export function compileProgram(source: string): Program {
  if (source.length > 20000) throw Error('Program exceeds 20,000 characters.');
  const tokens: Token[] = [];
  let pos = 0,
    line = 1;
  const pattern =
    /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|\d+(?:\.\d+)?|[A-Za-z_][\w.]*(?!\w)|==|!=|<=|>=|&&|\|\||[{}();,+\-*/%<>=!])/;
  while (pos < source.length) {
    const m = source.slice(pos).match(pattern);
    if (!m)
      throw Error(`Line ${line}: unsupported character '${source[pos]}'.`);
    const text = m[0];
    if (!/^\s|^\/\//.test(text) && !text.startsWith('/*'))
      tokens.push({ text, line });
    line += (text.match(/\n/g) || []).length;
    pos += text.length;
    if (tokens.length > 4000) throw Error('Program exceeds 4,000 tokens.');
  }
  let at = 0,
    depth = 0;
  const peek = () => tokens[at]?.text;
  const fail = (msg: string): never => {
    throw Error(`Line ${tokens[at]?.line ?? line}: ${msg}`);
  };
  const eat = (t?: string) => {
    const v = tokens[at++];
    if (!v || (t && v.text !== t)) fail(`Expected ${t ?? 'token'}.`);
    return v.text;
  };
  function expression(min = 0): Expr {
    if (++depth > 40) fail('Expression nesting exceeds 40.');
    let left: Expr;
    const token = eat();
    if (token === '!' || token === '-')
      left = { kind: 'unary', op: token, expr: expression(7) };
    else if (token === '(') {
      left = expression();
      eat(')');
    } else if (token.startsWith('"'))
      left = { kind: 'literal', value: JSON.parse(token) };
    else if (/^\d/.test(token))
      left = { kind: 'literal', value: Number(token) };
    else if (/^[A-Za-z_]\w*(?:\.\w+)*$/.test(token)) {
      if (peek() === '(') {
        eat('(');
        const args: Expr[] = [];
        if (peek() !== ')')
          do {
            args.push(expression());
            if (peek() !== ',') break;
            eat(',');
          } while (true);
        eat(')');
        left = { kind: 'call', name: token, args };
      } else left = { kind: 'name', name: token };
    } else return fail('Expected an expression.');
    while (precedence[peek()] >= min) {
      const op = eat();
      left = {
        kind: 'binary',
        op,
        left,
        right: expression(precedence[op] + 1),
      };
    }
    depth--;
    return left;
  }
  function block(level = 0): Statement[] {
    if (level > 20) fail('Block nesting exceeds 20.');
    eat('{');
    const result: Statement[] = [];
    while (peek() !== '}') {
      if (!peek()) fail('Missing closing brace.');
      result.push(statement(level));
    }
    eat('}');
    return result;
  }
  function statement(level = 0): Statement {
    const current = tokens[at]?.line ?? line;
    if (peek() === 'if') {
      eat();
      eat('(');
      const test = expression();
      eat(')');
      const yes = block(level + 1);
      let no: Statement[] = [];
      if (peek() === 'else') {
        eat();
        no = block(level + 1);
      }
      return { kind: 'if', test, yes, no, line: current };
    }
    if (peek() === 'const') eat();
    if (
      ['let', 'int', 'float', 'double', 'bool', 'long', 'unsigned'].includes(
        peek(),
      )
    ) {
      eat();
      if (peek() === 'int' || peek() === 'long') eat();
      const name = eat();
      if (!/^[A-Za-z_]\w*$/.test(name)) fail('Invalid variable name.');
      let expr: Expr = { kind: 'literal', value: 0 };
      if (peek() === '=') {
        eat();
        expr = expression();
      }
      eat(';');
      return { kind: 'assign', name, expr, line: current };
    }
    if (tokens[at + 1]?.text === '=') {
      const name = eat();
      eat('=');
      const expr = expression();
      eat(';');
      return { kind: 'assign', name, expr, line: current };
    }
    const expr = expression();
    eat(';');
    return { kind: 'expr', expr, line: current };
  }
  const result: Program = { globals: [], setup: [], loop: [] };
  const functions = new Set<string>();
  while (at < tokens.length) {
    if (peek() === 'void') {
      eat();
      const name = eat();
      if (!['setup', 'loop'].includes(name) || functions.has(name))
        fail('Only one setup() and one loop() are supported.');
      functions.add(name);
      eat('(');
      eat(')');
      result[name as 'setup' | 'loop'] = block();
    } else result.globals.push(statement());
  }
  if (!functions.has('loop')) fail('Add void loop() { ... }.');
  return result;
}
export const freshRuntime = (): Runtime => ({
  vars: Object.create(null),
  ms: 0,
  initialized: false,
  delay: 250,
});
export function executeProgram(
  program: Program,
  state: LabState,
  previous: Runtime,
): { devices: Device[]; runtime: Runtime; logs: string[] } {
  const c = chips.find((c) => c.id === state.chip)!;
  const errors = validate(c, state.devices, state.wires).errors;
  if (errors.length) throw Error(errors.slice(0, 2).join(' '));
  const runtime = structuredClone(previous),
    devices = structuredClone(state.devices),
    logs: string[] = [];
  let budget = 3000;
  const numeric = (x: number | string) => {
    const n = Number(x);
    if (!Number.isFinite(n)) throw Error('Expected a finite number.');
    return n;
  };
  const device = (key: number | string) => {
    const d =
      devices.find((d) => d.id === key) || devices.find((d) => d.type === key);
    if (!d) throw Error(`Device '${key}' is not connected.`);
    return d;
  };
  const pinDevice = (number: number | string, output: boolean) => {
    const pin = c.pins.find((p) => p.id === `GPIO${number}`);
    if (
      !pin ||
      pin.reserved ||
      pin.kind !== 'gpio' ||
      (output && pin.inputOnly)
    )
      throw Error(`GPIO${number} cannot be used for this operation.`);
    const ws = state.wires.filter((w) => w.pinId === pin.id);
    const w = ws.find((w) => {
      const d = devices.find((d) => d.id === w.deviceId)!;
      const t = definition(d).terminals.find((t) => t.name === w.terminal)!;
      return output ? t.type === 'out' : ['in', 'adc'].includes(t.type);
    });
    if (!w)
      throw Error(
        `GPIO${number} has no compatible ${output ? 'output' : 'input'} device terminal.`,
      );
    return { d: device(w.deviceId), pin };
  };
  const set = (d: Device, v: number) => {
    const spec = valueSpec(d.type);
    d.value = Math.max(spec.min, Math.min(spec.max, v));
    return d.value;
  };
  function expr(e: Expr): number | string {
    if (--budget < 0) throw Error('Instruction budget exceeded.');
    switch (e.kind) {
      case 'literal':
        return e.value;
      case 'name': {
        const constants: Record<string, number> = {
          HIGH: 1,
          LOW: 0,
          true: 1,
          false: 0,
          INPUT: 0,
          INPUT_PULLUP: 2,
          OUTPUT: 1,
        };
        if (Object.hasOwn(constants, e.name)) return constants[e.name];
        if (!Object.hasOwn(runtime.vars, e.name))
          throw Error(`Unknown variable ${e.name}.`);
        return runtime.vars[e.name];
      }
      case 'unary':
        return e.op === '!' ? Number(!expr(e.expr)) : -numeric(expr(e.expr));
      case 'binary': {
        const l = expr(e.left);
        if (e.op === '&&') return l ? Number(!!expr(e.right)) : 0;
        if (e.op === '||') return l ? 1 : Number(!!expr(e.right));
        const r = expr(e.right);
        switch (e.op) {
          case '+':
            return typeof l === 'string' || typeof r === 'string'
              ? (String(l) + String(r)).slice(0, 4000)
              : l + r;
          case '-':
            return numeric(l) - numeric(r);
          case '*':
            return numeric(l) * numeric(r);
          case '/':
            if (numeric(r) === 0) throw Error('Division by zero.');
            return numeric(l) / numeric(r);
          case '%':
            if (numeric(r) === 0) throw Error('Modulo by zero.');
            return numeric(l) % numeric(r);
          case '>':
            return Number(l > r);
          case '<':
            return Number(l < r);
          case '>=':
            return Number(l >= r);
          case '<=':
            return Number(l <= r);
          case '==':
            return Number(l === r);
          case '!=':
            return Number(l !== r);
        }
        throw Error('Unknown operator.');
      }
      case 'call': {
        const a = e.args.map(expr),
          n = a.map((x) => Number(x));
        switch (e.name) {
          case 'read':
            return sensed(device(a[0]));
          case 'write':
            return set(device(a[0]), numeric(a[1]));
          case 'millis':
            return runtime.ms;
          case 'delay':
            runtime.delay = Math.max(10, Math.min(10000, numeric(a[0])));
            return 0;
          case 'print':
          case 'Serial.println':
            if (logs.length < 50)
              logs.push(a.map(String).join(' ').slice(0, 1000));
            return 0;
          case 'Serial.begin':
            return 0;
          case 'pinMode': {
            const p = c.pins.find((p) => p.id === `GPIO${a[0]}`);
            if (
              !p ||
              p.reserved ||
              p.kind !== 'gpio' ||
              (n[1] === 1 && p.inputOnly)
            )
              throw Error('Invalid pinMode selection.');
            return 0;
          }
          case 'digitalRead':
            return Number(pinDevice(a[0], false).d.value > 0);
          case 'analogRead': {
            const { d, pin } = pinDevice(a[0], false);
            if (!pin.adc)
              throw Error('analogRead requires an ADC-capable pin.');
            const spec = valueSpec(d.type);
            return Math.round(
              ((d.value - spec.min) / (spec.max - spec.min)) *
                (2 ** state.settings.adcBits - 1),
            );
          }
          case 'digitalWrite': {
            const d = pinDevice(a[0], true).d;
            return set(d, n[1] ? valueSpec(d.type).max : valueSpec(d.type).min);
          }
          case 'analogWrite':
            return set(pinDevice(a[0], true).d, (numeric(a[1]) / 255) * 100);
          case 'min':
            return Math.min(...n);
          case 'max':
            return Math.max(...n);
          case 'abs':
            return Math.abs(numeric(a[0]));
          case 'constrain':
            return Math.max(n[1], Math.min(n[2], n[0]));
          case 'map':
            if (n[2] === n[1]) throw Error('map input range must be nonzero.');
            return n[3] + ((n[0] - n[1]) / (n[2] - n[1])) * (n[4] - n[3]);
          default:
            throw Error(
              `Unsupported function ${e.name}. See the language reference.`,
            );
        }
      }
    }
  }
  function statements(list: Statement[]) {
    for (const s of list) {
      try {
        if (s.kind === 'assign') {
          if (['__proto__', 'prototype', 'constructor'].includes(s.name))
            throw Error('Reserved variable name.');
          const v = expr(s.expr);
          if (typeof v === 'number' && !Number.isFinite(v))
            throw Error('Non-finite result.');
          runtime.vars[s.name] = v;
        } else if (s.kind === 'expr') expr(s.expr);
        else statements(expr(s.test) ? s.yes : s.no);
      } catch (e) {
        throw Error(
          `Line ${s.line}: ${e instanceof Error ? e.message : 'Execution failed'}`,
        );
      }
    }
  }
  if (!runtime.initialized) {
    statements(program.globals);
    statements(program.setup);
    runtime.initialized = true;
  }
  statements(program.loop);
  runtime.ms += runtime.delay;
  return { devices, runtime, logs };
}
export const programExamples = [
  {
    id: 'blink',
    name: 'Blink an LED',
    template: 'dimmer',
    source:
      'void setup() { Serial.begin(115200); }\n\nvoid loop() {\n  if (millis() % 1000 < 500) {\n    write("led", 100);\n  } else {\n    write("led", 0);\n  }\n  Serial.println(millis());\n  delay(250);\n}',
  },
  {
    id: 'dimmer',
    name: 'Potentiometer dimmer',
    template: 'dimmer',
    source:
      'void setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  float level = read("pot");\n  write("led", level);\n  Serial.println("Brightness: " + level);\n  delay(100);\n}',
  },
  {
    id: 'climate',
    name: 'Temperature-controlled fan',
    template: 'greenhouse',
    source:
      'void setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  float temperature = read("sht31");\n  if (temperature > 28) {\n    write("fan", 80);\n  } else {\n    write("fan", 0);\n  }\n  Serial.println("Temperature: " + temperature);\n  delay(250);\n}',
  },
  {
    id: 'servo',
    name: 'Map joystick to servo',
    template: 'servo',
    source:
      'void setup() { }\n\nvoid loop() {\n  float angle = map(read("joystick"), 0, 100, 0, 180);\n  write("servo", constrain(angle, 0, 180));\n  Serial.println(angle);\n  delay(100);\n}',
  },
];
