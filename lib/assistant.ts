import { chips } from './hardware';
import { deviceLibrary, validate } from './simulation';
import { deviceKnobs, settingsSpec, telemetry, valueSpec } from './parameters';
import { templates } from './templates';
import type { Action, LabState } from './lab-state';
export type AssistantReply = {
  message: string;
  actions: Action[];
  mode: 'offline' | 'ai';
};
export function offlineReply(input: string, state: LabState): AssistantReply {
  const q = input.trim().toLowerCase(),
    actions: Action[] = [];
  let message = '';
  const template = templates.find(
    (t) => q.includes(t.id) || q.includes(t.name.toLowerCase()),
  );
  if (/^(load|build|create|make|open)\b/.test(q) && template) {
    actions.push({ type: 'load_template', target: template.id });
    message = `Load ${template.name}: ${template.description}`;
  } else if (/^(add|remove)\b/.test(q)) {
    const term = q.replace(/^(add|remove)\s+(an?\s+)?/, '');
    const def =
      deviceLibrary.find((d) => d.id === term) ||
      deviceLibrary.find((d) => d.name.toLowerCase() === term) ||
      deviceLibrary.find(
        (d) => term.length >= 3 && d.name.toLowerCase().includes(term),
      );
    if (def) {
      actions.push({
        type: q.startsWith('add') ? 'add_device' : 'remove_device',
        target: def.id,
      });
      message = `${q.startsWith('add') ? 'Add' : 'Remove'} ${def.name}.`;
    }
  } else if (/^(auto[- ]?wire|wire all|connect everything)$/.test(q)) {
    actions.push({ type: 'auto_wire' });
    message =
      'Connect unconnected terminals using compatible pins. Review the wiring checks before running.';
  } else if (/^(run|start|pause|stop)$/.test(q)) {
    actions.push({ type: /^(run|start)$/.test(q) ? 'run' : 'pause' });
    message =
      actions[0].type === 'run'
        ? 'Run the validated virtual circuit.'
        : 'Pause the virtual circuit.';
  } else if (q.startsWith('set ')) {
    const match = q.replace(/\s+to\s+/g, ' ').match(
      /^set\s+([\w-]+)(?:\s+([\w]+))?\s+(?:to\s+)?(-?\d+(?:\.\d+)?)$/,
    );
    if (match) {
      const [, target, key, raw] = match;
      const n = Number(raw);
      if (settingsSpec.some((k) => k.key.toLowerCase() === target) && !key) {
        actions.push({
          type: 'set_global',
          key: settingsSpec.find((k) => k.key.toLowerCase() === target)!.key,
          value: n,
        });
      } else {
        actions.push({
          type: key ? 'set_parameter' : 'set_value',
          target,
          key: key ? deviceKnobs(state.devices.find(d=>d.id===target||d.type===target)?.type ?? 'led').find(k=>k.key.toLowerCase()===key)?.key ?? key : undefined,
          value: n,
        });
      }
      message = `Apply ${input}.`;
    }
  } else if (/diagnos|check|wrong|error/.test(q)) {
    const c = chips.find((c) => c.id === state.chip)!;
    const v = validate(c, state.devices, state.wires),
      t = telemetry(c, state.devices, state.settings);
    message =
      [...v.errors, ...v.warnings, ...t.warnings].join('\n') ||
      'All required terminals are connected and the configured resource estimates are within their teaching limits.';
  } else if (/ram|rom|memory|flash/.test(q)) {
    message =
      'SRAM holds live stacks, heap, driver state and DMA buffers. It is volatile. PSRAM is external working memory, typically larger and slower, and only supported by some families. ROM contains factory-programmed routines such as boot support; you cannot turn it into extra heap. Flash stores firmware, partitions, assets and persistent data; it is not ordinary byte-writable RAM. Open Memory for the concepts and Parameters for the current allocation estimates.';
  } else if (/i2c|i²c/.test(q)) {
    message =
      'I²C devices share SDA and SCL with pull-ups to 3.3 V and a common ground. Devices on the same bus need different addresses. In Parameters, tune clock, equivalent pull-up resistance and capacitance; the rise-time estimate shows why long cables or weak pull-ups can fail. Change a device address only when its real address-select mechanism supports it.';
  } else if (/pin|gpio|port/.test(q)) {
    message =
      'Select a board pin to inspect its capabilities. GPIO is a programmable logic signal; 3V3 and GND are supply rails. ADC inputs measure conditioned voltage, PWM outputs represent timed pulses, and I²C/SPI/UART/I²S need the right signal direction. GPIO numbers are not physical header positions. Reserved memory pins and input-only pins are checked by this workbench.';
  }
  if (!message)
    message =
      'Offline command helper: I can execute explicit commands and load templates. Try “load greenhouse”, “add servo”, “auto-wire”, “set servo 120”, “set fan rpm 3000”, “set sampleRate 48000”, “run”, or “diagnose”. Connect local Ollama for open-ended requests, or use the ChatGPT/Codex handoff. Use the Automation editor for sensor-to-output rules.';
  return { message, actions, mode: 'offline' };
}
export const assistantCatalog = () => ({
  chips: chips.map((c) => ({
    id: c.id,
    pins: c.pins.filter((p) => !p.reserved).map((p) => p.id),
  })),
  devices: deviceLibrary.map((d) => ({
    id: d.id,
    name: d.name,
    terminals: d.terminals,
    parameters: deviceKnobs(d.id),
    value: valueSpec(d.id),
  })),
  templates: templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
  })),
  settings: settingsSpec,
});
