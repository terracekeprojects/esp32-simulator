'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cpu,
  Box,
  Layers,
  BookOpen,
  Play,
  Pause,
  Search,
  ChevronRight,
  Zap,
  ArrowUpRight,
  Cable,
  Radio,
  MemoryStick,
  Plus,
  X,
  Check,
  CheckCircle2,
  Info,
  Download,
  RotateCcw,
  Save,
  FolderOpen,
  Lightbulb,
  CircleDot,
  Thermometer,
  Monitor,
  AudioLines,
  Gauge,
  CircuitBoard,
  SlidersHorizontal,
  Code2,
  HelpCircle,
  ArrowRight,
  MousePointer2,
  Unplug,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import BoardScene from '@/components/board-scene';
import {
  ComparePanel,
  LearningPanel,
  MemoryPanel,
  ReferencePanel,
} from '@/components/learning-panels';
import { chips, defaultChip, describePin, type Chip } from '@/lib/hardware';
import {
  autoWire,
  compatible,
  definition,
  deviceLibrary,
  generateCode,
  validate,
  wireColors,
  type Device,
  type DeviceType,
  type Wire,
} from '@/lib/simulation';
import { lessons } from '@/lib/lessons';
import { CodeStudio } from '@/components/code-studio';
import { CircuitPipeline } from '@/components/circuit-pipeline';
import { AdminArea } from '@/components/admin-area';
import { FeatureBoundary } from '@/components/feature-boundary';
import { RealityPanel } from '@/components/reality-panel';
import { consequences } from '@/lib/consequences';
import { useCircuitHistory } from '@/components/use-circuit-history';
import { MultiBoardWorkspace } from '@/components/multi-board-workspace';
import { TestingLab } from '@/components/testing-lab';
import {
  compileProgram,
  executeProgram,
  freshRuntime,
  programExamples,
} from '@/lib/program';
import {
  DeviceCard,
  ParametersPanel,
  TemplatesPanel,
  TemplateGuide,
  AutomationPanel,
  ChatPanel,
} from '@/components/advanced-lab';
import {
  defaultSettings,
  newDevice,
  type Settings,
  category,
} from '@/lib/parameters';
import { buildTemplate, type Rule } from '@/lib/templates';
import { normalizeState, stepRules, type LabState } from '@/lib/lab-state';
const deviceIcons: Partial<Record<DeviceType, typeof Lightbulb>> = {
  led: Lightbulb,
  button: CircleDot,
  pot: Gauge,
  oled: Monitor,
  bme280: Thermometer,
  servo: SlidersHorizontal,
  buzzer: AudioLines,
  spi: Monitor,
  uart: Cable,
  i2s: AudioLines,
};
const uid = () => crypto.randomUUID();
function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Home() {
  const [chip, setChip] = useState(defaultChip),
    [query, setQuery] = useState(''),
    [view, setView] = useState('workbench'),
    [tab, setTab] = useState('devices'),
    [selected, setSelected] = useState<string | null>(null),
    [labels, setLabels] = useState(true),
    [exploded, setExploded] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]),
    [wires, setWires] = useState<Wire[]>([]),
    [running, setRunning] = useState(false),
    [tick, setTick] = useState(0),
    [library, setLibrary] = useState(false),
    [deviceSearch, setDeviceSearch] = useState(''),
    [help, setHelp] = useState(false),
    [notice, setNotice] = useState(''),
    [showValidation, setShowValidation] = useState(false),
    [pinFilter, setPinFilter] = useState('all'),
    [pinQuery, setPinQuery] = useState(''),
    [completed, setCompleted] = useState<string[]>([]),
    [pending, setPending] = useState<{
      device: string;
      terminal: string;
    } | null>(null),
    [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<Settings>({ ...defaultSettings }),
    [rules, setRules] = useState<Rule[]>([]),
    [template, setTemplate] = useState<string | null>(null),
    [chat, setChat] = useState(false),
    [deviceCategory, setDeviceCategory] = useState('All');
  const [programSource, setProgramSource] = useState(programExamples[1].source),
    [codeMode, setCodeMode] = useState(false),
    [codeRuntime, setCodeRuntime] = useState(freshRuntime),
    [serialLogs, setSerialLogs] = useState<string[]>([]),
    [codeError, setCodeError] = useState('');
  const runtimeRef = useRef(freshRuntime());
  const [arrange, setArrange] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const state: LabState = {
    ...(restricted ? { restricted: true } : {}),
    program: programSource,
    chip: chip.id,
    devices,
    wires,
    settings,
    rules,
    template,
    running,
  };
  const stateRef = useRef(state);
  const circuitEvents = useCircuitHistory(
    state,
    tick,
    codeMode,
    codeError,
    serialLogs,
  );
  stateRef.current = state;
  useEffect(() => {
    if (!restricted) return;
    let disposed = false;
    const check = async () => {
      try {
        const r = await fetch('/api/admin/session', { cache: 'no-store' });
        const data = (await r.json()) as { admin: boolean };
        if (!data.admin && !disposed) location.reload();
      } catch {
        if (!disposed) location.reload();
      }
    };
    const timer = setInterval(check, 15000);
    const visible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', visible);
    void check();
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [restricted]);
  function resetCode() {
    runtimeRef.current = freshRuntime();
    setCodeRuntime(runtimeRef.current);
    setSerialLogs([]);
    setCodeError('');
    setRunning(false);
  }
  function editCode(source: string) {
    setProgramSource(source);
    resetCode();
  }
  function stepCode() {
    try {
      const result = executeProgram(
        compileProgram(stateRef.current.program ?? ''),
        stateRef.current,
        runtimeRef.current,
      );
      runtimeRef.current = result.runtime;
      setCodeRuntime(result.runtime);
      setDevices(result.devices);
      setSerialLogs((logs) =>
        [
          ...logs,
          ...result.logs.map((l) => `[${result.runtime.ms} ms] ${l}`),
        ].slice(-200),
      );
      setCodeError('');
      setTick((t) => t + 1);
      return true;
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'Program failed');
      setRunning(false);
      return false;
    }
  }
  function runCode() {
    if (running && codeMode) {
      setRunning(false);
      return;
    }
    try {
      compileProgram(programSource);
      setCodeMode(true);
      setRunning(true);
      setCodeError('');
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'Syntax error');
    }
  }
  function loadCodeExample(id: string) {
    const example = programExamples.find((e) => e.id === id);
    if (!example) return;
    applyState({ ...buildTemplate(example.template), program: example.source });
    setTab('code');
  }
  function applyState(s: LabState) {
    setRestricted(!!s.restricted);
    setProgramSource(s.program ?? programExamples[1].source);
    setCodeMode(false);
    resetCode();
    setChip(chips.find((c) => c.id === s.chip)!);
    setDevices(s.devices);
    setWires(s.wires);
    setSettings(s.settings);
    setRules(s.rules);
    setTemplate(s.template);
    setRunning(s.running);
    setSelected(null);
    setPending(null);
    setView('workbench');
    setShowValidation(true);
  }
  function loadTemplate(id: string) {
    applyState(buildTemplate(id));
    setTab('devices');
    setNotice(
      'Project loaded. Review its guide, wiring and automation rules, then run.',
    );
  }
  const importRef = useRef<HTMLInputElement>(null);
  const validation = useMemo(
    () => validate(chip, devices, wires),
    [chip, devices, wires],
  );
  const pin = chip.pins.find((p) => p.id === selected);
  const code = useMemo(
    () => generateCode(chip, devices, wires),
    [chip, devices, wires],
  );
  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem('esplab-progress') || '[]');
      if (Array.isArray(a))
        setCompleted(a.filter((id) => lessons.some((l) => l.id === id)));
    } catch {}
  }, []);
  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    const pump = () => {
      if (codeMode) {
        if (!stepCode()) return;
      } else {
        setTick((t) => t + 1);
        setDevices((ds) => stepRules(ds, rules));
      }
      timer = setTimeout(
        pump,
        (codeMode ? runtimeRef.current.delay : 250) / settings.speed,
      );
    };
    timer = setTimeout(pump, 0);
    return () => clearTimeout(timer);
  }, [running, settings.speed, rules, codeMode]);
  useEffect(() => {
    if (validation.errors.length) setRunning(false);
  }, [validation.errors.length]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  function choose(c: Chip) {
    if (c.id === chip.id) {
      setView('workbench');
      return;
    }
    setChip(c);
    setRestricted(false);
    setRules([]);
    setCodeMode(false);
    resetCode();
    setTemplate(null);
    setSettings({ ...defaultSettings, cpu: c.mhz, psram: c.psram ? 8 : 0 });
    setSelected(null);
    setPending(null);
    setDevices([]);
    setWires([]);
    setRunning(false);
    setTick(0);
    setShowValidation(false);
    setView('workbench');
    setTab('devices');
    if (devices.length)
      setNotice(
        'Changed family. Start a new circuit using its compatible pins.',
      );
  }
  function add(type: DeviceType) {
    if (devices.length >= 12) {
      setNotice(
        'This workbench supports up to twelve devices. Remove a device to add another.',
      );
      return;
    }
    setDevices([...devices, newDevice(type)]);
    setRunning(false);
    setLibrary(false);
    setTab('devices');
    setNotice(
      'Device added. Choose Auto-wire, or select a board pin and click a device terminal.',
    );
  }
  function connect(deviceId: string, terminal: string, pinId = selected) {
    if (!pinId) {
      setPending({ device: deviceId, terminal });
      setNotice(
        'Terminal selected. Choose a compatible board pin to connect it.',
      );
      return;
    }
    const d = devices.find((d) => d.id === deviceId),
      p = chip.pins.find((p) => p.id === pinId),
      t = d && definition(d).terminals.find((t) => t.name === terminal);
    if (!d || !p || !t) return;
    if (!compatible(p, t)) {
      setNotice(
        `${p.id} is not compatible with ${definition(d).name} ${terminal}. Choose ${t.type === 'ground' ? 'GND' : t.type === 'power' ? t.rail : t.type === 'adc' ? 'an ADC-capable GPIO' : 'a suitable GPIO'}.`,
      );
      setPending({ device: deviceId, terminal });
      return;
    }
    setWires([
      ...wires.filter(
        (w) => !(w.deviceId === deviceId && w.terminal === terminal),
      ),
      {
        id: uid(),
        deviceId,
        terminal,
        pinId: p.id,
        color:
          t.type === 'ground'
            ? '#697b82'
            : t.type === 'power'
              ? '#cf7c70'
              : wireColors[wires.length % wireColors.length],
      },
    ]);
    setPending(null);
    setRunning(false);
    setNotice(`${p.id} connected to ${definition(d).name} · ${terminal}.`);
  }
  function pickPin(id: string) {
    setSelected(id);
    if (pending) connect(pending.device, pending.terminal, id);
  }
  function run() {
    if (running) {
      setRunning(false);
      return;
    }
    setShowValidation(true);
    if (validation.errors.length) {
      setNotice('The circuit needs attention. See the wiring checks below.');
      return;
    }
    setRunning(true);
    setTick(0);
    setNotice(
      devices.length
        ? 'Simulation running. Adjust device controls and watch the response.'
        : 'Board is running idle. Add a device to explore a signal.',
    );
  }
  function updateDevice(id: string, value: number) {
    setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, value } : d)));
  }
  function removeDevice(id: string) {
    setDevices((ds) => ds.filter((d) => d.id !== id));
    setRules((rs) => rs.filter((r) => r.source !== id && r.target !== id));
    setWires((ws) => ws.filter((w) => w.deviceId !== id));
    if (pending?.device === id) setPending(null);
    setRunning(false);
  }
  function loadExperiment(experiment: string) {
    setRules([]);
    setCodeMode(false);
    resetCode();
    setTemplate(null);
    setView('workbench');
    setRunning(false);
    setSelected(null);
    setPending(null);
    setShowValidation(false);
    let c = chip;
    if (
      chip.id === 'ESP32-E22' ||
      (experiment === 'pot' && !chip.pins.some((p) => p.adc))
    ) {
      c = defaultChip;
      setChip(c);
    }
    if (experiment === 'memory') {
      setTab('memory');
      return;
    }
    const types: DeviceType[] =
      experiment === 'i2c'
        ? ['bme280', 'oled']
        : experiment === 'pot'
          ? ['pot', 'led']
          : [experiment as DeviceType];
    const ds = types.map((type) => ({
      id: uid(),
      type,
      value:
        type === 'bme280'
          ? 24
          : type === 'servo'
            ? 90
            : type === 'button'
              ? 0
              : 50,
    }));
    setDevices(ds);
    setWires(autoWire(c, ds, []));
    setTab('devices');
    setNotice(
      'Guided circuit loaded and wired. Inspect each connection, then run the simulation.',
    );
  }
  function save() {
    if (restricted) {
      setNotice(
        'Private projects stay in this admin session. Export a personal copy if needed.',
      );
      return;
    }
    try {
      localStorage.setItem(
        'esplab-circuit',
        JSON.stringify({ schema: 2, ...state, running: false }),
      );
      setNotice(
        'Circuit saved in this browser. Export JSON to keep a portable copy.',
      );
    } catch {
      setNotice('Browser storage is unavailable. Use Export JSON instead.');
    }
  }
  function restore(data: unknown) {
    if (
      !data ||
      typeof data !== 'object' ||
      ![1, 2].includes((data as { schema: number }).schema)
    )
      throw Error('Unsupported circuit format.');
    applyState(normalizeState(data));
    setTab('devices');
    setNotice(
      'Circuit, parameters and automation restored. Review the wiring before running.',
    );
  }
  function openSaved() {
    try {
      const raw = localStorage.getItem('esplab-circuit');
      if (!raw) {
        setNotice(
          'No circuit saved in this browser yet. Build one and choose Save.',
        );
        return;
      }
      restore(JSON.parse(raw));
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : 'Could not load this circuit.',
      );
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100000) throw Error('Circuit file is too large.');
      restore(JSON.parse(await file.text()));
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : 'Could not import this circuit.',
      );
    }
    if (importRef.current) importRef.current.value = '';
  }
  const filteredPins = chip.pins.filter(
    (p) =>
      (p.id + ' ' + p.label).toLowerCase().includes(pinQuery.toLowerCase()) &&
      (pinFilter === 'all' ||
        (pinFilter === 'adc' && p.adc) ||
        (pinFilter === 'digital' && p.kind === 'gpio' && !p.reserved) ||
        (pinFilter === 'power' && ['power', 'ground'].includes(p.kind)) ||
        (pinFilter === 'special' &&
          (p.warning || p.reserved || p.usb || p.touch || p.dac))),
  );
  const sensor = devices.find((d) => d.type === 'bme280');
  return (
    <main className="lab">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ESPLAB home">
          <span className="brand-icon">
            <Cpu size={21} />
          </span>
          ESP<span className="brand-light">LAB</span>
          <span className="edition">INTERACTIVE ATLAS</span>
        </a>
        <nav aria-label="Main navigation">
          {[
            ['admin', 'Admin login', CircuitBoard],
            ['workspace', 'System canvas', Layers],
            ['workbench', 'Workbench', Box],
            ['testing', 'Test lab', Activity],
            ['templates', 'Templates', CircuitBoard],
            ['compare', 'Compare chips', Layers],
            ['learn', 'Learning path', BookOpen],
            ['reference', 'Reference', HelpCircle],
          ].map(([id, name, Icon]) => {
            const I = Icon as typeof Box;
            return (
              <Button
                key={String(id)}
                variant="ghost"
                className={view === id ? 'active' : ''}
                onClick={() => setView(String(id))}
              >
                <I />
                {String(name)}
              </Button>
            );
          })}
        </nav>
        <span className="version">
          <i className="status-dot" />
          Learning by doing
        </span>
        <Button
          className="help-button"
          variant="ghost"
          size="icon"
          aria-label="How to use the lab"
          onClick={() => setHelp(true)}
        >
          <HelpCircle />
        </Button>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="eyebrow">YOUR HARDWARE</div>
          <h2>
            Board library <span>14</span>
          </h2>
          <div className="search">
            <Search size={15} />
            <Input
              placeholder="Find a chip family…"
              aria-label="Search chip families"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="section-label">ESP32 FAMILIES</p>
          <div className="family-list">
            {chips
              .filter((c) =>
                (
                  c.name +
                  ' ' +
                  c.specialty +
                  ' ' +
                  c.wifi +
                  ' ' +
                  (c.mesh ? 'Thread Zigbee' : '')
                )
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => choose(c)}
                  aria-pressed={chip.id === c.id}
                  className={'family ' + (chip.id === c.id ? 'selected' : '')}
                >
                  <Cpu size={17} />
                  <span>
                    {c.name}
                    <small>{c.specialty}</small>
                  </span>
                  {chip.id === c.id ? (
                    <span className="selected-dot" />
                  ) : (
                    <ChevronRight size={13} />
                  )}
                </button>
              ))}
          </div>
          {!chips.some((c) =>
            (
              c.name +
              ' ' +
              c.specialty +
              ' ' +
              c.wifi +
              ' ' +
              (c.mesh ? 'Thread Zigbee' : '')
            )
              .toLowerCase()
              .includes(query.toLowerCase()),
          ) && <p className="empty">No families match this search.</p>}
          <button className="compare-link" onClick={() => setView('compare')}>
            <Layers size={14} />
            Compare all families
            <ArrowUpRight size={13} />
          </button>
          <div className="side-note">
            <Zap size={17} />
            <strong>Start with a little curiosity.</strong>
            <p>Pick a pin. Make a connection. See what happens.</p>
            <Button variant="link" onClick={() => setView('learn')}>
              Start learning
              <ArrowRight />
            </Button>
          </div>
          <p className="sidebar-foot">
            14 families · 12 guided lessons
            <br />
            Research checked Sep 9, 2026
          </p>
        </aside>
        <section className="main-area">
          <MultiBoardWorkspace
            active={view === 'workspace'}
            current={state}
            onEdit={applyState}
            onTest={() => setView('testing')}
          />
          {view === 'workspace' ? null : view === 'testing' ? (
            <TestingLab
              state={state}
              onLoad={loadTemplate}
              onApply={(id, value) => {
                setRunning(false);
                setDevices((ds) =>
                  ds.map((d) => (d.id === id ? { ...d, value } : d)),
                );
              }}
            />
          ) : view === 'admin' ? (
            <AdminArea
              onLoad={applyState}
              onLogout={() => {
                localStorage.removeItem('esplab-circuit');
                localStorage.removeItem('esplab-workspace');
                location.reload();
              }}
            />
          ) : view === 'templates' ? (
            <TemplatesPanel onLoad={loadTemplate} />
          ) : view === 'compare' ? (
            <ComparePanel onSelect={choose} />
          ) : view === 'learn' ? (
            <LearningPanel
              completed={completed}
              onComplete={(id) => {
                const next = [...new Set([...completed, id])];
                setCompleted(next);
                try {
                  localStorage.setItem('esplab-progress', JSON.stringify(next));
                } catch {}
              }}
              onExperiment={loadExperiment}
            />
          ) : view === 'reference' ? (
            <ReferencePanel />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    THE INTERACTIVE ELECTRONICS WORKBENCH
                  </div>
                  <h1>Small chip. Endless possibilities.</h1>
                  <p>Explore the ESP32, one connection at a time.</p>
                </div>
                <div className="heading-actions">
                  <Button
                    variant="outline"
                    size="icon"
                    title="Save circuit in this browser"
                    aria-label="Save circuit"
                    onClick={save}
                  >
                    <Save />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Load saved circuit"
                    aria-label="Load saved circuit"
                    onClick={openSaved}
                  >
                    <FolderOpen />
                  </Button>
                  <Button
                    className={running ? 'run-button running' : 'run-button'}
                    onClick={run}
                  >
                    {running ? <Pause size={14} /> : <Play size={14} />}{' '}
                    {running ? 'Pause simulation' : 'Run simulation'}
                  </Button>
                </div>
              </div>
              <div className="bench-layout">
                <section className="workbench">
                  <div className="bench-header">
                    <span>
                      <span className="tiny-chip">
                        <Cpu size={15} />
                      </span>
                      <strong>{chip.name}</strong>
                      <span className="badge">3D EXPLORER</span>
                    </span>
                    <span className={'sim-status ' + (running ? 'on' : '')}>
                      <i />
                      {running ? 'RUNNING' : 'READY TO EXPLORE'}
                    </span>
                  </div>
                  <BoardScene
                    chip={chip}
                    devices={devices}
                    wires={wires}
                    selected={selected}
                    onPin={pickPin}
                    onTerminal={connect}
                    running={running}
                    tick={tick}
                    labels={labels}
                    exploded={exploded}
                    arrange={arrange}
                    onMove={(id, position) =>
                      setDevices((ds) =>
                        ds.map((d) => (d.id === id ? { ...d, position } : d)),
                      )
                    }
                  />
                  <div className="bench-footer">
                    <div className="view-toggles">
                      <label>
                        <Switch
                          size="sm"
                          checked={arrange}
                          onCheckedChange={setArrange}
                          aria-label="Arrange devices by dragging"
                        />
                        Arrange devices
                      </label>
                      <label>
                        <Switch
                          size="sm"
                          checked={labels}
                          onCheckedChange={setLabels}
                          aria-label="Show pin labels"
                        />
                        Pin labels
                      </label>
                      <label>
                        <Switch
                          size="sm"
                          checked={exploded}
                          onCheckedChange={setExploded}
                          aria-label="Show exploded board view"
                        />
                        Exploded view
                      </label>
                    </div>
                    <span>
                      <Cable size={12} />
                      {wires.length} connections
                    </span>
                  </div>
                  <div className="spec-strip">
                    {[
                      [Cpu, `${chip.cores} × ${chip.mhz} MHz`, chip.cpu],
                      [MemoryStick, `${chip.sram} KB`, 'INTERNAL SRAM'],
                      [
                        DatabaseIcon,
                        chip.id === 'ESP32-S3'
                          ? '8 MB + 8 MB'
                          : chip.psram
                            ? 'Optional PSRAM'
                            : 'Flash varies',
                        chip.id === 'ESP32-S3'
                          ? 'FLASH + PSRAM PROFILE'
                          : 'MODULE DEPENDENT',
                      ],
                      [
                        Radio,
                        chip.wifi === 'None'
                          ? 'No Wi-Fi'
                          : chip.wifi.includes('6')
                            ? 'Wi-Fi 6' + (chip.id === 'ESP32-E22' ? 'E' : '')
                            : 'Wi-Fi 4',
                        chip.mesh
                          ? '802.15.4 + BLE'
                          : chip.bluetooth === 'None'
                            ? 'NO BLUETOOTH'
                            : 'BLUETOOTH CAPABLE',
                      ],
                    ].map(([Icon, value, label], i) => {
                      const I = Icon as typeof Cpu;
                      return (
                        <div key={i}>
                          <I size={15} />
                          <span>
                            <strong>{String(value)}</strong>
                            <small>{String(label)}</small>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <aside className="inspector">
                  <div className="inspector-top">
                    <span className="eyebrow">
                      {pin ? 'PIN INSPECTOR' : 'MEET YOUR BOARD'}
                    </span>
                    {pin ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Close pin details"
                        onClick={() => setSelected(null)}
                      >
                        <X />
                      </Button>
                    ) : (
                      <Cpu size={15} />
                    )}
                  </div>
                  {pin ? (
                    <>
                      <div className="pin-title">
                        <span className={'pin-symbol ' + pin.kind}>
                          {pin.kind === 'gpio' ? <Cable /> : <Zap />}
                        </span>
                        <div>
                          <h2>{pin.id}</h2>
                          <p>
                            {pin.gpio === undefined
                              ? 'Learning carrier terminal'
                              : `Chip signal · not header position ${pin.gpio}`}
                          </p>
                        </div>
                      </div>
                      <div className="capabilities">
                        <span>{pin.kind.toUpperCase()}</span>
                        {pin.adc && <span>ADC</span>}
                        {pin.touch && <span>TOUCH</span>}
                        {pin.dac && <span>DAC</span>}
                        {pin.inputOnly && <span>INPUT ONLY</span>}
                      </div>
                      <p className="inspector-description">
                        {describePin(pin)}
                      </p>
                      {pin.reserved && (
                        <p className="notice danger">{pin.reserved}</p>
                      )}
                      {pin.warning && (
                        <p className="notice warning">{pin.warning}</p>
                      )}
                      {pin.usb && <p className="notice warning">{pin.usb}</p>}
                      <div className="pin-level">
                        <span>Logic voltage</span>
                        <strong>
                          {pin.kind === 'ground'
                            ? '0 V'
                            : pin.id === '5V'
                              ? '5 V rail'
                              : '3.3 V'}
                        </strong>
                      </div>
                      <div className="inspector-hint">
                        <MousePointer2 size={15} />
                        <p>
                          Click a compatible device terminal to connect this
                          pin. Use the Pin explorer below for keyboard access.
                        </p>
                      </div>
                      {wires
                        .filter((w) => w.pinId === pin.id)
                        .map((w) => (
                          <div className="pin-connection" key={w.id}>
                            <span style={{ background: w.color }} />
                            <div>
                              {
                                definition(
                                  devices.find((d) => d.id === w.deviceId)!,
                                ).name
                              }
                              <small>{w.terminal}</small>
                            </div>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              aria-label={`Disconnect ${w.terminal}`}
                              onClick={() => {
                                setWires(wires.filter((v) => v.id !== w.id));
                                setRunning(false);
                              }}
                            >
                              <Unplug size={13} />
                            </Button>
                          </div>
                        ))}
                    </>
                  ) : (
                    <>
                      <div className="family-mark">
                        <Cpu size={28} />
                        <span>
                          {chip.name}
                          <small>{chip.specialty}</small>
                        </span>
                      </div>
                      <p className="inspector-description">
                        {chip.description}
                      </p>
                      <div className="best-for">
                        <span className="eyebrow">MADE FOR EXPLORING</span>
                        {chip.uses.map((u) => (
                          <p key={u}>
                            <Check size={12} />
                            {u}
                          </p>
                        ))}
                      </div>
                      <div className="inspector-hint">
                        <MousePointer2 size={16} />
                        <p>
                          <strong>Go ahead, pick a pin.</strong>
                          <br />
                          Click any gold header pin to uncover its capabilities.
                        </p>
                      </div>
                      <div className="board-notes">
                        <strong>Know your hardware</strong>
                        <p>{chip.caveats[0]}</p>
                        <p>{chip.caveats[1]}</p>
                      </div>
                    </>
                  )}
                  <a
                    className="datasheet-link"
                    href={chip.source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <BookOpen size={14} />
                    Official {chip.name} reference
                    <ArrowUpRight size={13} />
                  </a>
                </aside>
              </div>
              <div className="detail-panel">
                {running && (
                  <div className="live-outcome">
                    <strong>On real hardware</strong>
                    <p>
                      {(
                        consequences(state, tick).find(
                          (o) => o.severity === 'risk',
                        ) ??
                        consequences(state, tick).find((o) =>
                          o.title.includes('LED'),
                        ) ??
                        consequences(state, tick)[0]
                      )?.effect ??
                        'Add a device to observe a physical signal path.'}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTab('reality')}
                    >
                      Explore consequences & faults
                    </Button>
                  </div>
                )}
                <div
                  className="detail-tabs"
                  role="tablist"
                  aria-label="Workbench tools"
                >
                  {[
                    ['devices', 'Devices & wiring', Cable],
                    ['parameters', 'Parameters', SlidersHorizontal],
                    ['automation', 'Automation', Activity],
                    ['pins', 'Pin explorer', Cpu],
                    ['memory', 'Memory map', MemoryStick],
                    ['code', 'Code studio', Code2],
                    ['pipeline', 'Pipeline & video', Play],
                    ['reality', 'Real-world scenarios', Zap],
                  ].map(([id, title, Icon]) => {
                    const I = Icon as typeof Cpu;
                    return (
                      <button
                        key={String(id)}
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => setTab(String(id))}
                        className={tab === id ? 'active' : ''}
                      >
                        <I size={14} />
                        {String(title)}
                        {id === 'devices' && <span>{devices.length}</span>}
                      </button>
                    );
                  })}
                  <span className="detail-right">
                    LEARN THROUGH EXPERIMENTS
                  </span>
                </div>
                {tab === 'reality' ? (
                  <RealityPanel
                    state={state}
                    tick={tick}
                    onApply={applyState}
                  />
                ) : tab === 'pipeline' ? (
                  <CircuitPipeline
                    state={state}
                    tick={tick}
                    codeMode={codeMode}
                    codeError={codeError || undefined}
                    events={circuitEvents}
                  />
                ) : tab === 'parameters' ? (
                  <ParametersPanel
                    chip={chip}
                    devices={devices}
                    settings={settings}
                    onChange={setSettings}
                  />
                ) : tab === 'automation' ? (
                  <AutomationPanel
                    devices={devices}
                    rules={rules}
                    running={running && !codeMode}
                    onChange={setRules}
                  />
                ) : tab === 'devices' ? (
                  <div className="device-area">
                    {template && (
                      <TemplateGuide
                        id={template}
                        onClose={() => setTemplate(null)}
                      />
                    )}
                    <div className="device-toolbar">
                      <div>
                        <h3>
                          Your circuit{' '}
                          <span>{devices.length} / 12 devices</span>
                        </h3>
                        <p>
                          {pending
                            ? `Connecting ${definition(devices.find((d) => d.id === pending.device)!).name} · ${pending.terminal}. Choose a board pin.`
                            : 'Add a device, connect its terminals, and bring your circuit to life.'}
                        </p>
                      </div>
                      <div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setWires(autoWire(chip, devices, wires));
                            setRunning(false);
                            setShowValidation(true);
                            setNotice(
                              'Compatible unconnected terminals have been wired. Review the circuit checks.',
                            );
                          }}
                          disabled={!devices.length}
                        >
                          <Zap />
                          Auto-wire
                        </Button>
                        <Button
                          onClick={() => setLibrary(true)}
                          disabled={
                            chip.id === 'ESP32-E22' || devices.length >= 12
                          }
                        >
                          <Plus />
                          Add device
                        </Button>
                      </div>
                    </div>
                    {chip.id === 'ESP32-E22' ? (
                      <div className="empty-circuit">
                        <Radio size={30} />
                        <h3>A different kind of ESP32.</h3>
                        <p>
                          E22 is a host connectivity coprocessor. Explore
                          PCIe/SDIO, Wi-Fi 6E, and its memory architecture in
                          the reference. General-purpose GPIO experiments are
                          intentionally unavailable.
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => setView('reference')}
                        >
                          Explore the reference
                          <ArrowRight />
                        </Button>
                      </div>
                    ) : devices.length === 0 ? (
                      <div className="starter-circuits">
                        <div className="starter-intro">
                          <span className="soft-icon">
                            <CircuitBoard size={21} />
                          </span>
                          <h3>What will you connect first?</h3>
                          <p>Try a guided circuit or build your own.</p>
                        </div>
                        {[
                          [
                            'led',
                            'Blink & dim',
                            'A first step into GPIO and PWM.',
                            Lightbulb,
                          ],
                          [
                            'i2c',
                            'A tiny weather station',
                            'One bus. A sensor and a display.',
                            Thermometer,
                          ],
                          [
                            'pot',
                            'Turn a voltage into data',
                            'Explore analog input with a dial.',
                            Gauge,
                          ],
                        ].map(([id, title, desc, Icon]) => {
                          const I = Icon as typeof Cpu;
                          return (
                            <button
                              className="experiment-card"
                              key={String(id)}
                              onClick={() => loadExperiment(String(id))}
                            >
                              <I size={19} />
                              <strong>{String(title)}</strong>
                              <small>{String(desc)}</small>
                              <span>
                                LOAD EXPERIMENT
                                <ArrowUpRight size={12} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        <div className="connected-devices">
                          {devices.map((d) => (
                            <DeviceCard
                              key={d.id}
                              device={d}
                              wires={wires}
                              settings={settings}
                              tick={tick}
                              running={running}
                              onChange={(next) =>
                                setDevices((ds) =>
                                  ds.map((x) => (x.id === next.id ? next : x)),
                                )
                              }
                              onRemove={() => removeDevice(d.id)}
                              onConnect={(terminal) => connect(d.id, terminal)}
                              onUnwire={(id) => {
                                setWires((ws) => ws.filter((w) => w.id !== id));
                                setRunning(false);
                              }}
                            />
                          ))}
                        </div>
                        <div className="signal-panel">
                          <div>
                            <Activity size={15} />
                            <strong>Signal monitor</strong>
                            <span>
                              {running ? 'LIVE TEACHING MODEL' : 'PAUSED'}
                            </span>
                          </div>
                          <svg
                            viewBox="0 0 700 55"
                            role="img"
                            aria-label="Conceptual signal trace; not a cycle-accurate logic analyzer"
                            preserveAspectRatio="none"
                          >
                            <defs>
                              <pattern
                                id="signalGrid"
                                width="35"
                                height="14"
                                patternUnits="userSpaceOnUse"
                              >
                                <path
                                  d="M 35 0 L 0 0 0 14"
                                  fill="none"
                                  stroke="#e2ece7"
                                  strokeWidth=".5"
                                />
                              </pattern>
                            </defs>
                            <rect
                              width="700"
                              height="55"
                              fill="url(#signalGrid)"
                            />
                            {(() => {
                              const d =
                                devices.find((d) =>
                                  [
                                    'led',
                                    'pot',
                                    'button',
                                    'buzzer',
                                    'servo',
                                  ].includes(d.type),
                                ) ?? devices[0];
                              if (!running)
                                return (
                                  <path
                                    d="M0 42 H700"
                                    stroke="#a9bbb5"
                                    fill="none"
                                  />
                                );
                              if (d.type === 'pot') {
                                const y = 44 - d.value * 0.34;
                                return (
                                  <path
                                    d={`M0 ${y} H700`}
                                    fill="none"
                                    stroke="#9b81b2"
                                    strokeWidth="2"
                                  />
                                );
                              }
                              if (d.type === 'button')
                                return (
                                  <path
                                    d={`M0 ${d.value ? 44 : 10} H700`}
                                    fill="none"
                                    stroke="#518fac"
                                    strokeWidth="2"
                                  />
                                );
                              const duty =
                                d.type === 'led'
                                  ? d.value / 100
                                  : d.type === 'servo'
                                    ? (1 + d.value / 180) / 20
                                    : 0.5;
                              if (duty === 0 || duty === 1)
                                return (
                                  <path
                                    d={`M0 ${duty ? 10 : 44} H700`}
                                    fill="none"
                                    stroke="#218f74"
                                    strokeWidth="2"
                                  />
                                );
                              let path = 'M0 44';
                              for (let x = 0; x < 700; x += 70)
                                path += ` H${x} V10 H${x + 70 * duty} V44 H${x + 70}`;
                              return (
                                <path
                                  d={path}
                                  fill="none"
                                  stroke="#218f74"
                                  strokeWidth="2"
                                />
                              );
                            })()}
                          </svg>
                          <p>
                            {devices.some((d) => d.type === 'led')
                              ? 'PWM duty cycle changes pulse width. '
                              : ''}
                            Waveform is conceptual and not to scale.{' '}
                            {running
                              ? `Elapsed simulation: ${(tick / 4).toFixed(1)} s.`
                              : 'Run the circuit to show its signal.'}
                          </p>
                        </div>
                      </>
                    )}
                    {(showValidation || pending) && (
                      <div className="wiring-checks">
                        <div className="checks-heading">
                          <strong>
                            <CheckCircle2 size={15} />
                            Circuit checks
                          </strong>
                          {pending && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => setPending(null)}
                            >
                              Cancel connection
                            </Button>
                          )}
                        </div>
                        {validation.errors.length ? (
                          validation.errors.map((e) => (
                            <p className="check-error" key={e}>
                              <span>!</span>
                              {e}
                            </p>
                          ))
                        ) : (
                          <p className="check-pass">
                            <Check size={14} />
                            {devices.length
                              ? 'All required device terminals are connected with compatible pins.'
                              : 'Board is idle. Add devices to validate a circuit.'}
                          </p>
                        )}
                        {validation.warnings.map((w) => (
                          <p className="check-warning" key={w}>
                            <Info size={13} />
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="circuit-footer">
                      <span>
                        <Info size={12} />
                        3.3 V logic · virtual components include the support
                        circuitry described above
                      </span>
                      <div>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            download(
                              'esplab-circuit.json',
                              JSON.stringify(
                                { schema: 2, ...state, running: false },
                                null,
                                2,
                              ),
                              'application/json',
                            )
                          }
                        >
                          <Download />
                          Export JSON
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => importRef.current?.click()}
                        >
                          <FolderOpen />
                          Import
                        </Button>
                        <input
                          type="file"
                          accept=".json,application/json"
                          ref={importRef}
                          hidden
                          onChange={(e) => importFile(e.target.files?.[0])}
                        />
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={!devices.length}
                          onClick={() => {
                            setDevices([]);
                            setRules([]);
                            setTemplate(null);
                            setWires([]);
                            setRunning(false);
                            setPending(null);
                            setShowValidation(false);
                          }}
                        >
                          <RotateCcw />
                          Clear circuit
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : tab === 'pins' ? (
                  <div className="pin-explorer">
                    <div className="section-heading">
                      <div>
                        <h2>Every signal has a purpose.</h2>
                        <p>
                          Click a pin to inspect or connect it. This is a signal
                          catalog, not the physical board header order.
                        </p>
                      </div>
                      <Input
                        value={pinQuery}
                        onChange={(e) => setPinQuery(e.target.value)}
                        placeholder="Search GPIO…"
                        aria-label="Search pins"
                      />
                    </div>
                    <div className="filter-tabs">
                      {[
                        ['all', 'All terminals'],
                        ['digital', 'Digital I/O'],
                        ['adc', 'Analog / ADC'],
                        ['power', 'Power & ground'],
                        ['special', 'Special functions'],
                      ].map(([k, v]) => (
                        <Button
                          size="sm"
                          key={k}
                          variant={pinFilter === k ? 'default' : 'outline'}
                          onClick={() => setPinFilter(k)}
                        >
                          {v}
                        </Button>
                      ))}
                    </div>
                    {chip.reference && (
                      <p className="notice warning">
                        Reference profile: IO labels are abstract learning
                        terminals, not numbered physical GPIOs. See the official
                        reference before wiring real hardware.
                      </p>
                    )}
                    <div className="pin-grid">
                      {filteredPins.map((p) => (
                        <button
                          key={p.id}
                          className={
                            'pin-card ' +
                            (selected === p.id ? 'selected ' : '') +
                            (p.reserved ? 'reserved' : '')
                          }
                          onClick={() => pickPin(p.id)}
                          aria-pressed={selected === p.id}
                        >
                          <span
                            className={'pin-dot ' + (p.adc ? 'analog' : p.kind)}
                          />
                          <strong>{p.id}</strong>
                          <small>
                            {p.reserved
                              ? 'MEMORY RESERVED'
                              : p.kind === 'gpio'
                                ? p.inputOnly
                                  ? 'INPUT ONLY'
                                  : p.adc
                                    ? 'GPIO · ADC'
                                    : 'DIGITAL I/O'
                                : p.kind.toUpperCase()}
                          </small>
                          {(p.warning || p.usb) && <Info size={12} />}
                        </button>
                      ))}
                    </div>
                    {filteredPins.length === 0 && (
                      <p className="empty">
                        No pins match this filter on this profile.
                      </p>
                    )}
                    <div className="pin-notes">
                      {chip.caveats.map((p) => (
                        <p key={p}>
                          <Info size={13} />
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : tab === 'memory' ? (
                  <MemoryPanel key={chip.id} chip={chip} devices={devices} />
                ) : (
                  <CodeStudio
                    state={state}
                    source={programSource}
                    onSource={editCode}
                    onExample={loadCodeExample}
                    onRun={runCode}
                    onStep={() => {
                      setCodeMode(true);
                      stepCode();
                    }}
                    onReset={resetCode}
                    runtime={codeRuntime}
                    logs={serialLogs}
                    error={codeError}
                    codeMode={codeMode}
                    firmware={code}
                  />
                )}
              </div>
              <div className="learning-banner">
                <span className="soft-icon">
                  <BookOpen size={20} />
                </span>
                <div>
                  <strong>A little understanding goes a long way.</strong>
                  <p>
                    Follow 12 hands-on lessons, from your first LED to memory,
                    buses, and connected systems.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setView('learn')}>
                  Explore learning path
                  <ArrowRight />
                </Button>
              </div>
              <footer className="lab-footer">
                <span>
                  ESPLAB <span> / </span> A space to understand what you build.
                </span>
                <button onClick={() => setView('reference')}>
                  Simulation scope & sources
                  <ArrowUpRight size={12} />
                </button>
              </footer>
            </>
          )}
        </section>
      </div>
      <Dialog open={library} onOpenChange={setLibrary}>
        <DialogContent className="device-dialog">
          <DialogTitle>Add a little possibility.</DialogTitle>
          <DialogDescription>
            Choose a virtual device. Each one includes a wiring guide and an
            explanation.
          </DialogDescription>
          <div className="search">
            <Search size={15} />
            <Input
              aria-label="Search devices"
              placeholder="Find a device or protocol…"
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
            />
          </div>
          <div className="filter-tabs">
            {['All', ...new Set(deviceLibrary.map((d) => category(d.id)))].map(
              (c) => (
                <button
                  key={c}
                  className={deviceCategory === c ? 'active' : ''}
                  onClick={() => setDeviceCategory(c)}
                >
                  {c}
                </button>
              ),
            )}
          </div>
          <div className="device-library">
            {deviceLibrary
              .filter(
                (d) =>
                  deviceCategory === 'All' || category(d.id) === deviceCategory,
              )
              .filter((d) =>
                (d.name + ' ' + d.protocol + ' ' + d.subtitle)
                  .toLowerCase()
                  .includes(deviceSearch.toLowerCase()),
              )
              .map((d) => {
                const Icon = deviceIcons[d.id] ?? CircuitBoard;
                const unsupported =
                  (d.terminals.some((t) => t.type === 'i2s') &&
                    chip.id === 'ESP32-C2') ||
                  (d.terminals.some((t) => t.type === 'adc') &&
                    !chip.pins.some((p) => p.adc)) ||
                  (d.id === 'p4panel' && chip.id !== 'ESP32-P4');
                return (
                  <button
                    key={d.id}
                    disabled={unsupported}
                    onClick={() => add(d.id)}
                  >
                    <span
                      className="device-icon"
                      style={{ color: d.color, background: d.color + '15' }}
                    >
                      <Icon size={24} />
                    </span>
                    <strong>{d.name}</strong>
                    <small>
                      {unsupported ? 'Unavailable on this profile' : d.subtitle}
                    </small>
                    <span className="device-protocol">
                      {d.protocol}
                      <Plus size={13} />
                    </span>
                  </button>
                );
              })}
          </div>
          <p className="micro-copy">
            Virtual circuits · up to twelve devices per workbench · actual
            device modules can have different electrical requirements
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogTitle>Welcome to your workbench.</DialogTitle>
          <DialogDescription>
            A few small steps from curiosity to a working circuit.
          </DialogDescription>
          <ol className="help-steps">
            <li>
              <strong>Choose a chip family.</strong>
              <p>
                Browse the library or compare architectures and wireless
                capabilities.
              </p>
            </li>
            <li>
              <strong>Explore in 3D.</strong>
              <p>
                Drag to orbit, scroll to zoom, or use the camera buttons. Pick a
                pin to inspect it; keyboard users can use Pin explorer.
              </p>
            </li>
            <li>
              <strong>Make a connection.</strong>
              <p>
                Add a device. Click its terminal and then a compatible board
                pin, or select a pin first. Auto-wire fills unconnected
                terminals.
              </p>
            </li>
            <li>
              <strong>Run and experiment.</strong>
              <p>
                Resolve circuit checks, run the simulation, and adjust device
                inputs. Memory map shows hypothetical allocation budgets.
              </p>
            </li>
            <li>
              <strong>Keep learning.</strong>
              <p>
                Save circuits in this browser, export JSON, and work through
                lessons. The Reference explains what is modeled and links to
                official documentation.
              </p>
            </li>
          </ol>
          <Button onClick={() => setHelp(false)}>
            Let's explore
            <ArrowRight />
          </Button>
        </DialogContent>
      </Dialog>
      <Button className="assistant-launch" onClick={() => setChat(true)}>
        <SparklesIcon /> Ask the lab assistant
      </Button>
      {chat && (
        <FeatureBoundary name="Coding assistant">
          <ChatPanel
            key={restricted ? 'private' : 'public'}
            state={state}
            onApply={applyState}
            onClose={() => setChat(false)}
          />
        </FeatureBoundary>
      )}
      {notice && (
        <div className="toast" role="status">
          <Info size={17} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
function DatabaseIcon(props: { size?: number }) {
  return <MemoryStick {...props} />;
}

function SparklesIcon() {
  return <CircuitBoard size={17} />;
}
