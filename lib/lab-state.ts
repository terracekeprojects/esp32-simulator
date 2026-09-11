import { compileProgram } from './program';
import { chips } from './hardware';
import {
  autoWire,
  compatible,
  definition,
  deviceLibrary,
  validate,
  type Device,
  type Wire,
} from './simulation';
import {
  defaultSettings,
  deviceKnobs,
  newDevice,
  sensed,
  settingsSpec,
  valueSpec,
  type Settings,
} from './parameters';
import { buildTemplate, type Rule } from './templates';
export type LabState = {
  restricted?: boolean;
  chip: string;
  devices: Device[];
  wires: Wire[];
  rules: Rule[];
  settings: Settings;
  template: string | null;
  running: boolean;
  program?: string;
};
export type Action = {
  type:
    | 'set_code'
    | 'load_template'
    | 'add_device'
    | 'remove_device'
    | 'set_value'
    | 'set_parameter'
    | 'set_global'
    | 'auto_wire'
    | 'connect'
    | 'add_rule'
    | 'run'
    | 'pause'
    | 'clear';
  target?: string;
  key?: string;
  value?: number;
  pin?: string;
  rule?: Rule;
};
const numeric = (value: unknown, min: number, max: number) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
export function normalizeState(
  data: unknown,
  allowRestricted = false,
): LabState {
  if (!data || typeof data !== 'object') throw Error('Invalid circuit.');
  const a = data as LabState;
  if (
    !allowRestricted &&
    (a.restricted ||
      (typeof a.template === 'string' && a.template.startsWith('luxot-')))
  )
    throw Error(
      'Private projects must be opened from an authenticated admin session.',
    );
  if (
    a.program !== undefined &&
    (typeof a.program !== 'string' || a.program.length > 20000)
  )
    throw Error('Invalid program.');
  const chip = chips.find((c) => c.id === a.chip);
  if (
    !chip ||
    !Array.isArray(a.devices) ||
    a.devices.length > 12 ||
    !Array.isArray(a.wires) ||
    a.wires.length > 120
  )
    throw Error('Unsupported circuit or device count.');
  const devices = a.devices.map((d) => {
    if (
      !d ||
      typeof d.id !== 'string' ||
      d.id.length > 100 ||
      !deviceLibrary.some((x) => x.id === d.type)
    )
      throw Error('Unknown device.');
    const v = valueSpec(d.type);
    if (!numeric(d.value, v.min, v.max))
      throw Error(`Invalid value for ${d.type}.`);
    const params: Settings = {};
    for (const k of deviceKnobs(d.type)) {
      const n = d.params?.[k.key] ?? k.value;
      if (
        !numeric(n, k.min, k.max) ||
        (k.key === 'address' && !Number.isInteger(n))
      )
        throw Error(`Invalid ${k.label}.`);
      params[k.key] = n;
    }
    if (
      d.position &&
      ![d.position.x, d.position.z].every((n) => numeric(n, -20, 20))
    )
      throw Error('Device position is outside the workspace.');
    return {
      ...newDevice(d.type, d.id),
      value: d.value,
      params,
      ...(d.position ? { position: { x: d.position.x, z: d.position.z } } : {}),
    };
  });
  if (new Set(devices.map((d) => d.id)).size !== devices.length)
    throw Error('Duplicate device IDs.');
  const wires = a.wires.map((w) => {
    if (!w) throw Error('Invalid wire.');
    const d = devices.find((d) => d.id === w.deviceId);
    if (
      !w ||
      typeof w.id !== 'string' ||
      !d ||
      !definition(d).terminals.some((t) => t.name === w.terminal) ||
      !chip.pins.some((p) => p.id === w.pinId) ||
      typeof w.color !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(w.color)
    )
      throw Error('Invalid wire.');
    return {
      id: w.id,
      deviceId: w.deviceId,
      terminal: w.terminal,
      pinId: w.pinId,
      color: w.color,
    };
  });
  if (
    new Set(wires.map((w) => w.deviceId + ':' + w.terminal)).size !==
    wires.length
  )
    throw Error('Duplicate terminal wiring.');
  const settings = { ...defaultSettings };
  for (const k of settingsSpec) {
    const n = a.settings?.[k.key] ?? k.value;
    if (!numeric(n, k.min, k.max)) throw Error(`Invalid ${k.label}.`);
    settings[k.key] = n;
  }
  if (a.rules !== undefined && !Array.isArray(a.rules))
    throw Error('Invalid rules.');
  const rules = (a.rules ?? []).map((r) => {
    if (!r) throw Error('Invalid rule.');
    const target = devices.find((d) => d.id === r.target);
    if (
      !r ||
      typeof r.id !== 'string' ||
      !target ||
      !devices.some((d) => d.id === r.source) ||
      r.source === r.target ||
      !['above', 'below', 'map'].includes(r.mode) ||
      !numeric(r.threshold, -100000, 100000) ||
      typeof r.enabled !== 'boolean'
    )
      throw Error('Invalid automation rule.');
    const v = valueSpec(target.type);
    if (!numeric(r.output, v.min, v.max) || !numeric(r.otherwise, v.min, v.max))
      throw Error('Rule output outside device range.');
    return { ...r };
  });
  if (
    rules.length > 24 ||
    new Set(rules.filter((r) => r.enabled).map((r) => r.target)).size !==
      rules.filter((r) => r.enabled).length
  )
    throw Error('Only one enabled rule per output is supported.');
  if (chip.id === 'ESP32-E22' && devices.length)
    throw Error('E22 is a reference architecture.');
  return {
    ...(a.restricted ? { restricted: true } : {}),
    ...(a.program !== undefined ? { program: a.program } : {}),
    chip: chip.id,
    devices,
    wires,
    rules,
    settings,
    template: typeof a.template === 'string' ? a.template : null,
    running: false,
  };
}
export function stepRules(devices: Device[], rules: Rule[]): Device[] {
  return devices.map((d) => {
    const r = rules.find((r) => r.enabled && r.target === d.id);
    const source = r && devices.find((x) => x.id === r.source);
    if (!r || !source) return d;
    const input = sensed(source),
      spec = valueSpec(source.type);
    const v =
      r.mode === 'map'
        ? r.otherwise +
          Math.max(0, Math.min(1, (input - spec.min) / (spec.max - spec.min))) *
            (r.output - r.otherwise)
        : (r.mode === 'above' ? input > r.threshold : input < r.threshold)
          ? r.output
          : r.otherwise;
    return v === d.value ? d : { ...d, value: v };
  });
}
export function applyActions(initial: LabState, actions: Action[]): LabState {
  if (!Array.isArray(actions) || actions.length > 32)
    throw Error('Too many actions.');
  let state = structuredClone(initial);
  for (const a of actions) {
    const chip = chips.find((c) => c.id === state.chip)!;
    const resolve = () => {
      const d =
        state.devices.find((d) => d.id === a.target) ||
        state.devices.find((d) => d.type === a.target);
      if (!d) throw Error(`Device not found: ${a.target}`);
      return d;
    };
    switch (a.type) {
      case 'set_code': {
        if (typeof a.key !== 'string') throw Error('Missing program source.');
        compileProgram(a.key);
        state.program = a.key;
        state.running = false;
        break;
      }
      case 'load_template':
        state = buildTemplate(a.target ?? '');
        break;
      case 'add_device': {
        const def = deviceLibrary.find((d) => d.id === a.target);
        if (!def) throw Error('Unknown device type.');
        if (state.devices.length >= 12)
          throw Error('Workbench limit: 12 devices.');
        state.devices.push(newDevice(def.id));
        state.running = false;
        break;
      }
      case 'remove_device': {
        const d = resolve();
        state.devices = state.devices.filter((x) => x.id !== d.id);
        state.wires = state.wires.filter((w) => w.deviceId !== d.id);
        state.rules = state.rules.filter(
          (r) => r.source !== d.id && r.target !== d.id,
        );
        state.running = false;
        break;
      }
      case 'set_value': {
        const d = resolve(),
          k = valueSpec(d.type);
        if (!numeric(a.value, k.min, k.max))
          throw Error(`${k.label} must be ${k.min}–${k.max}.`);
        d.value = a.value!;
        break;
      }
      case 'set_parameter': {
        const d = resolve(),
          k = deviceKnobs(d.type).find((k) => k.key === a.key);
        if (!k || !numeric(a.value, k.min, k.max))
          throw Error('Unknown parameter or value outside range.');
        d.params = { ...d.params, [k.key]: a.value! };
        break;
      }
      case 'set_global': {
        const k = settingsSpec.find((k) => k.key === a.key);
        if (!k || !numeric(a.value, k.min, k.max))
          throw Error('Unknown setting or value outside range.');
        state.settings[k.key] = a.value!;
        break;
      }
      case 'auto_wire':
        state.wires = autoWire(chip, state.devices, state.wires);
        break;
      case 'connect': {
        const d = resolve(),
          t = definition(d).terminals.find((t) => t.name === a.key),
          p = chip.pins.find((p) => p.id === a.pin);
        if (!t || !p || !compatible(p, t))
          throw Error('Incompatible pin and terminal.');
        state.wires = state.wires.filter(
          (w) => !(w.deviceId === d.id && w.terminal === t.name),
        );
        state.wires.push({
          id: crypto.randomUUID(),
          deviceId: d.id,
          terminal: t.name,
          pinId: p.id,
          color: '#448ea2',
        });
        state.running = false;
        break;
      }
      case 'add_rule':
        if (!a.rule) throw Error('Missing rule.');
        state.rules.push(a.rule);
        break;
      case 'run': {
        const result = validate(chip, state.devices, state.wires);
        if (result.errors.length)
          throw Error(result.errors.slice(0, 3).join(' '));
        state.running = true;
        break;
      }
      case 'pause':
        state.running = false;
        break;
      case 'clear':
        state = {
          ...state,
          devices: [],
          wires: [],
          rules: [],
          template: null,
          running: false,
        };
        break;
      default:
        throw Error('Unsupported action.');
    }
  }
  const running = state.running;
  return {
    ...normalizeState(state, !!initial.restricted),
    running:
      running &&
      validate(
        chips.find((c) => c.id === state.chip)!,
        state.devices,
        state.wires,
      ).errors.length === 0,
  };
}
