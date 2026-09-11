'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  X,
  Play,
  SlidersHorizontal,
  CircuitBoard,
  ArrowRight,
  Undo2,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { chips, type Chip } from '@/lib/hardware';
import { definition, type Device, type Wire } from '@/lib/simulation';
import {
  category,
  deviceKnobs,
  param,
  readout,
  settingsSpec,
  telemetry,
  valueSpec,
  type Knob,
  type Settings,
} from '@/lib/parameters';
import { templates, type Rule } from '@/lib/templates';
import { applyActions, type Action, type LabState } from '@/lib/lab-state';
import { offlineReply, type AssistantReply } from '@/lib/assistant';

export function KnobControl({
  spec,
  value,
  onChange,
}: {
  spec: Knob;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="lab-knob">
      <span>
        {spec.label}
        <strong>
          {Number(value.toFixed(2))} <small>{spec.unit}</small>
        </strong>
      </span>
      <div>
        <input
          aria-label={spec.label}
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          aria-label={`${spec.label} exact value`}
          type="number"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={Number(value.toFixed(2))}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (
              e.target.value !== '' &&
              Number.isFinite(n) &&
              n >= spec.min &&
              n <= spec.max
            )
              onChange(n);
          }}
        />
      </div>
      <small>{spec.help}</small>
    </label>
  );
}
export function DeviceCard({
  device: d,
  wires,
  settings,
  tick,
  running,
  onChange,
  onRemove,
  onConnect,
  onUnwire,
}: {
  device: Device;
  wires: Wire[];
  settings: Settings;
  tick: number;
  running: boolean;
  onChange: (d: Device) => void;
  onRemove: () => void;
  onConnect: (terminal: string) => void;
  onUnwire: (id: string) => void;
}) {
  const def = definition(d),
    connected = def.terminals.every((t) =>
      wires.some((w) => w.deviceId === d.id && w.terminal === t.name),
    );
  return (
    <article className="device-card advanced-device">
      <div className="device-card-header">
        <span
          className="device-icon"
          style={{ color: def.color, background: def.color + '18' }}
        >
          <CircuitBoard size={20} />
        </span>
        <div>
          <strong>{def.name}</strong>
          <small>
            {category(d.type)} · {def.protocol}
          </small>
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Remove ${def.name}`}
          onClick={onRemove}
        >
          <X size={14} />
        </Button>
      </div>
      <div className={'device-readout ' + (running && connected ? 'live' : '')}>
        <span>{readout(d, settings, tick)}</span>
        <small>
          {!connected
            ? 'NEEDS WIRING'
            : running
              ? 'SIMULATED READING'
              : 'PREVIEW · PAUSED'}
        </small>
      </div>
      <KnobControl
        spec={valueSpec(d.type)}
        value={d.value}
        onChange={(value) => onChange({ ...d, value })}
      />
      <details className="device-tuning">
        <summary>
          <SlidersHorizontal size={13} /> Device parameters{' '}
          <span>{deviceKnobs(d.type).length}</span>
        </summary>
        {deviceKnobs(d.type).map((k) => (
          <KnobControl
            key={k.key}
            spec={k}
            value={param(d, k.key)}
            onChange={(value) =>
              onChange({ ...d, params: { ...d.params, [k.key]: value } })
            }
          />
        ))}
      </details>
      <div className="device-terminals">
        {def.terminals.map((t) => {
          const w = wires.find(
            (w) => w.deviceId === d.id && w.terminal === t.name,
          );
          return (
            <div className="terminal-line" key={t.name}>
              <button
                onClick={() => onConnect(t.name)}
                aria-label={`Connect ${def.name} ${t.name}`}
              >
                <i style={{ background: w?.color ?? '#ccd7d2' }} />
                {t.name}
                <span>{w?.pinId ?? 'Connect +'}</span>
              </button>
              {w && (
                <button
                  aria-label={`Remove ${t.name} wire`}
                  className="remove-wire"
                  onClick={() => onUnwire(w.id)}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <details>
        <summary>How this device works</summary>
        <p>{def.description}</p>
        <p>
          Driver budget: {def.memory} KiB. Readings and motion are educational
          approximations. The current and response settings are estimates you
          supply for the circuit.
        </p>
      </details>
    </article>
  );
}
export function ParametersPanel({
  chip,
  devices,
  settings,
  onChange,
}: {
  chip: Chip;
  devices: Device[];
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const t = telemetry(chip, devices, settings),
    [group, setGroup] = useState('Runtime');
  const metrics = [
    ['Response latency', `${(settings.sampleMs+settings.latency+Math.max(0,...devices.map(d=>param(d,'response')))).toFixed(0)} ms`, 'Sample interval + network + slowest device'],
    [
      'CPU work',
      `${t.cpuLoad.toFixed(2)}%`,
      `${t.cpu} MHz effective · one core`,
    ],
    [
      '3.3 V load',
      `${t.current.toFixed(0)} mA`,
      `${t.voltage.toFixed(2)} V after wire loss`,
    ],
    [
      'External 5 V loads',
      `${t.extCurrent.toFixed(0)} mA`,
      'Separate supply current estimate',
    ],
    [
      'Internal SRAM',
      `${t.internal.toFixed(1)} KiB`,
      `${chip.sram} KiB total, before real SDK overhead`,
    ],
    [
      'PSRAM allocation',
      `${t.psram.toFixed(1)} KiB`,
      `${chip.psram ? settings.psram : 0} MiB installed / supported`,
    ],
    [
      'I²C rise time',
      `${t.rise.toFixed(0)} ns`,
      `${settings.i2c > 100 ? 300 : 1000} ns mode target`,
    ],
    [
      'UART payload ceiling',
      `${t.uart.toFixed(0)} B/s`,
      '8N1, before protocol overhead',
    ],
    [
      'SPI raw ceiling',
      `${(t.spi / 1e6).toFixed(2)} MB/s`,
      'Ideal, not measured throughput',
    ],
    [
      'Frame allocation',
      `${t.frame.toFixed(1)} KiB`,
      `${settings.width} × ${settings.height} × ${settings.bpp} bit × ${settings.buffers}`,
    ],
    [
      'Audio DMA buffer',
      `${t.audio.toFixed(1)} KiB`,
      `${(t.pcm / 1000).toFixed(1)} kB/s packed PCM`,
    ],
    [
      'Audio delivery estimate',
      `${(t.goodput / 1000).toFixed(1)} kB/s`,
      `${settings.loss}% packet loss model`,
    ],
    [
      'PWM period',
      `${(1e6 / settings.pwm).toFixed(1)} µs`,
      `${2 ** settings.pwmBits - 1} duty steps`,
    ],
  ];
  return (
    <div className="advanced-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">ENGINEERING SANDBOX</span>
          <h2>Change a parameter. Follow the consequence.</h2>
          <p>
            These equations expose tradeoffs. They estimate resource use; they
            do not replace measurements on your selected board.
          </p>
        </div>
      </div>
      <div className="telemetry-grid">
        {metrics.map(([label, value, sub]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
            <span>{sub}</span>
          </div>
        ))}
      </div>
      {t.warnings.length > 0 && (
        <div className="resource-warnings">
          {t.warnings.map((w) => (
            <p key={w}>⚠ {w}</p>
          ))}
        </div>
      )}
      <div className="filter-tabs">
        {[...new Set(settingsSpec.map((k) => k.group))].map((g) => (
          <button
            className={group === g ? 'active' : ''}
            onClick={() => setGroup(g!)}
            key={g}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="knob-grid">
        {settingsSpec
          .filter((k) => k.group === group)
          .map((k) => (
            <KnobControl
              key={k.key}
              spec={k}
              value={settings[k.key]}
              onChange={(v) => onChange({ ...settings, [k.key]: v })}
            />
          ))}
      </div>
      <p className="model-note">
        Framebuffers go to PSRAM when available; audio DMA, stacks and
        application heap remain in SRAM in this model. 96 KiB is an illustrative
        system reservation. ROM and flash are not counted as writable heap.
        Knobs model common concepts, not every chip’s legal register settings.
      </p>
    </div>
  );
}
export function TemplatesPanel({ onLoad }: { onLoad: (id: string) => void }) {
  const [filter, setFilter] = useState('All'),
    [search, setSearch] = useState('');
  return (
    <div className="advanced-panel template-page">
      <span className="eyebrow">BUILD SOMETHING THAT WORKS TOGETHER</span>
      <h1>Project templates</h1>
      <p className="template-intro">
        Explore {templates.length} complete starting points. Each includes a
        device list, wiring, a learning path, and project-specific settings.
        Automation templates respond to your inputs while running.
      </p>
      <Input
        aria-label="Search project templates"
        placeholder="Search projects, devices or concepts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="filter-tabs">
        {['All', ...new Set(templates.map((t) => t.category))].map((c) => (
          <button
            className={filter === c ? 'active' : ''}
            onClick={() => setFilter(c)}
            key={c}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="template-grid">
        {templates
          .filter(
            (t) =>
              (filter === 'All' || filter === t.category) &&
              `${t.name} ${t.description} ${t.types.join(' ')}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((t) => (
            <article
              className={
                'template-card'
              }
              key={t.id}
            >
              <div className="template-tags">
                <span>{t.category}</span>
                <span>{t.level}</span>
              </div>
              <h2>{t.name}</h2>
              <small>
                {t.chip} · {t.types.length} devices · {t.rules?.length ?? 0}{' '}
                automation rules
              </small>
              <p>{t.description}</p>
              <div className="bom">
                {t.types.map((type, i) => (
                  <span key={i}>
                    {definition({ id: '', type, value: 0 }).name}
                  </span>
                ))}
              </div>
              <details>
                <summary>Learning path & source</summary>
                <ol>
                  {t.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {t.source && (
                  <p className="source-note">
                    Project source: {t.source}. Snapshot from your
                    workspace; templates contain no credentials or private
                    network addresses.
                  </p>
                )}
              </details>
              <Button onClick={() => onLoad(t.id)}>
                Load project <ArrowRight size={14} />
              </Button>
            </article>
          ))}
      </div>
    </div>
  );
}
export function TemplateGuide({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const t = templates.find((t) => t.id === id);
  if (!t) return null;
  return (
    <details className="template-guide" open>
      <summary>{t.name} · guided project</summary>
      <p>{t.description}</p>
      <ol>
        {t.steps.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ol>
      <Button variant="ghost" size="xs" onClick={onClose}>
        Dismiss guide
      </Button>
    </details>
  );
}
export function AutomationPanel({
  devices,
  rules,
  onChange,
  running,
}: {
  devices: Device[];
  rules: Rule[];
  onChange: (r: Rule[]) => void;
  running: boolean;
}) {
  const [error, setError] = useState('');
  const label = (id: string) => {
    const d = devices.find((d) => d.id === id);
    return d
      ? `${definition(d).name} (${devices.indexOf(d) + 1})`
      : 'Removed device';
  };
  function update(id: string, patch: Partial<Rule>) {
    const next = rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
    const active = next.filter((r) => r.enabled);
    if (new Set(active.map((r) => r.target)).size !== active.length) {
      setError('Use only one enabled rule per output.');
      return;
    }
    setError('');
    onChange(next);
  }
  return (
    <div className="advanced-panel">
      <span className="eyebrow">SENSOR → DECISION → OUTPUT</span>
      <h2>Automation rules</h2>
      <p>
        Rules run when the circuit runs. “Map range” scales the source’s full
        input range between the two output values. Threshold rules select one
        output value. Calibration gain and offset apply before comparison. Rules
        read the previous tick together; feedback takes effect on the next tick.
      </p>
      <Button
        disabled={devices.length < 2 || rules.length >= 24}
        onClick={() => {
          const target = devices.find(
            (d) =>
              !rules.some((r) => r.enabled && r.target === d.id) &&
              d.id !== devices[0].id,
          );
          if (!target) {
            setError('Add a device with no existing output rule.');
            return;
          }
          const v = valueSpec(target.type);
          onChange([
            ...rules,
            {
              id: crypto.randomUUID(),
              source: devices[0].id,
              target: target.id,
              mode: 'above',
              threshold: valueSpec(devices[0].type).value,
              output: v.max,
              otherwise: v.min,
              enabled: true,
            },
          ]);
        }}
      >
        Add rule
      </Button>
      <span className="rule-status">
        {running ? '● Evaluating' : '○ Paused'} ·{' '}
        {rules.filter((r) => r.enabled).length} enabled
      </span>
      {error && <p role="alert">{error}</p>}
      <div className="rule-list">
        {rules.map((r) => {
          const source = devices.find((d) => d.id === r.source),
            target = devices.find((d) => d.id === r.target);
          if (!source || !target) return null;
          const out = valueSpec(target.type);
          return (
            <article className="rule-card" key={r.id}>
              <div className="rule-title">
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(enabled) => update(r.id, { enabled })}
                  aria-label="Enable rule"
                />
                <strong>
                  {label(r.source)} → {label(r.target)}
                </strong>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Delete rule"
                  onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="rule-fields">
                <label>
                  Source
                  <select
                    value={r.source}
                    onChange={(e) => update(r.id, { source: e.target.value })}
                  >
                    {devices
                      .filter((d) => d.id !== r.target)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {label(d.id)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Condition
                  <select
                    value={r.mode}
                    onChange={(e) =>
                      update(r.id, { mode: e.target.value as Rule['mode'] })
                    }
                  >
                    <option value="above">Above threshold</option>
                    <option value="below">Below threshold</option>
                    <option value="map">Map range</option>
                  </select>
                </label>
                <label>
                  Output
                  <select
                    value={r.target}
                    onChange={(e) => {
                      const d = devices.find((d) => d.id === e.target.value)!;
                      update(r.id, {
                        target: d.id,
                        output: valueSpec(d.type).max,
                        otherwise: valueSpec(d.type).min,
                      });
                    }}
                  >
                    {devices
                      .filter((d) => d.id !== r.source)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {label(d.id)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="knob-grid">
                {r.mode !== 'map' && (
                  <KnobControl
                    spec={{
                      ...valueSpec(source.type),
                      key: 'threshold',
                      label: 'Threshold',
                      help: 'Strict comparison. Equality selects the otherwise value.',
                    }}
                    value={r.threshold}
                    onChange={(threshold) => update(r.id, { threshold })}
                  />
                )}
                <KnobControl
                  spec={{
                    ...out,
                    label:
                      r.mode === 'map'
                        ? 'Output at source maximum'
                        : 'Output when true',
                    help: 'Value written to the target.',
                  }}
                  value={r.output}
                  onChange={(output) => update(r.id, { output })}
                />
                <KnobControl
                  spec={{
                    ...out,
                    label:
                      r.mode === 'map'
                        ? 'Output at source minimum'
                        : 'Output otherwise',
                    help: 'Value written for the other state.',
                  }}
                  value={r.otherwise}
                  onChange={(otherwise) => update(r.id, { otherwise })}
                />
              </div>
            </article>
          );
        })}
      </div>
      {!rules.length && (
        <p className="model-note">
          Load Greenhouse, Night light, room sensors, or build your own
          rule with two connected devices.
        </p>
      )}
    </div>
  );
}

export { ChatPanel } from './chat-panel';
