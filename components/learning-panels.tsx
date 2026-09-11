'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Cpu,
  Database,
  BookOpen,
  ArrowRight,
  Info,
  Radio,
  Layers,
  CheckCircle2,
  X,
  FlaskConical,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { chips, type Chip } from '@/lib/hardware';
import { lessons, resources } from '@/lib/lessons';
import { memoryBudget, type Device } from '@/lib/simulation';
export function MemoryPanel({
  chip,
  devices,
  onOverflow,
}: {
  chip: Chip;
  devices: Device[];
  onOverflow?: (v: boolean) => void;
}) {
  const [wifi, setWifi] = useState(false),
    [frame, setFrame] = useState(false),
    [psram, setPsram] = useState(chip.id === 'ESP32-S3' ? 8 : 0),
    [extra, setExtra] = useState(0),
    [flash, setFlash] = useState(8),
    [firmware, setFirmware] = useState(1200),
    [sleep, setSleep] = useState(false);
  const b = memoryBudget(
    chip,
    devices,
    wifi,
    frame,
    chip.psram ? psram : 0,
    extra,
  );
  const [focus, setFocus] = useState('SRAM');
  const entries = [
    {
      id: 'SRAM',
      size: `${chip.sram} KB`,
      tag: 'FAST · VOLATILE',
      description:
        'Working memory shared by code, static data, task stacks, heap, and system use. This meter is an illustrative allocation model—not a measured heap. Real free memory also depends on cache reservations, linker configuration, and allocation capabilities.',
      value: Math.min((b.internal / chip.sram) * 100, 100),
      color: '#278c75',
    },
    {
      id: 'ROM',
      size: chip.rom ? `${chip.rom} KB` : 'Not specified',
      tag: 'FACTORY PROGRAMMED',
      description:
        'Mask ROM contains boot and low-level functions. Ordinary firmware uploads do not rewrite it. It is not a pool you allocate with malloc. P4 additionally has separate LP ROM; see the family notes.',
      value: 100,
      color: '#8392a5',
    },
    {
      id: 'Flash',
      size: `${flash} MB`,
      tag: 'NONVOLATILE STORAGE',
      description:
        'Stores firmware, bootloader, partition table, OTA slots, and NVS/filesystems. The chosen capacity is a hypothetical installed-flash budget, not a claim about your board. This model reserves 512 KB and two equal app slots; real partition tables vary.',
      value: Math.min(((512 + firmware * 2) / (flash * 1024)) * 100, 100),
      color: '#c7a26c',
    },
    {
      id: 'PSRAM',
      size: chip.psram ? `${psram} MB` : 'Unsupported',
      tag: 'EXTERNAL · VOLATILE',
      description:
        'Large external working memory for framebuffers and buffers. Enabled only on families with supported external RAM. Capacity here is a scenario setting. It does not change your physical module. Cache, latency, DMA, and execution constraints depend on the target.',
      value: psram ? Math.min((b.external / (psram * 1024)) * 100, 100) : 0,
      color: '#9c87b1',
    },
    {
      id: 'RTC / LP',
      size: chip.rtc ? `${chip.rtc} KB` : 'See datasheet',
      tag: 'CONFIGURABLE RETENTION',
      description:
        'Selected low-power or RTC RAM domains can remain powered during deep sleep. Retaining memory requires the appropriate power-domain configuration. All volatile memory is lost if power is removed. Unspecified capacity is intentionally not inferred.',
      value: sleep ? 20 : 0,
      color: '#698eae',
    },
  ];
  const selected = entries.find((x) => x.id === focus)!;
  return (
    <div className="memory-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">INSIDE {chip.name}</span>
          <h2>A home for every byte.</h2>
          <p>Change a workload. Understand where its memory goes.</p>
        </div>
        <span className="badge">ILLUSTRATIVE BUDGET</span>
      </div>
      <div className="memory-cards">
        {entries.map((e) => (
          <button
            key={e.id}
            onClick={() => setFocus(e.id)}
            className={'memory-card ' + (focus === e.id ? 'chosen' : '')}
            style={{ '--memory-color': e.color } as React.CSSProperties}
          >
            <span>
              {e.id}
              <Database size={14} />
            </span>
            <strong>{e.size}</strong>
            <small>{e.tag}</small>
            <div className="memory-bar">
              <i style={{ width: e.value + '%' }} />
            </div>
          </button>
        ))}
      </div>
      <div className="memory-explain">
        <Info size={17} />
        <div>
          <strong>{selected.id}</strong>
          <p>{selected.description}</p>
        </div>
      </div>
      <div className="memory-detail">
        <div className="budget-controls">
          <h3>Workload playground</h3>
          <label className="toggle-row">
            <span>
              Wi-Fi stack <small>+72 KB internal SRAM, teaching estimate</small>
            </span>
            <Switch
              checked={wifi}
              disabled={chip.wifi === 'None'}
              onCheckedChange={setWifi}
              aria-label="Enable Wi-Fi memory workload"
            />
          </label>
          <label className="toggle-row">
            <span>
              320 × 240 RGB565 frame <small>320 × 240 × 2 bytes = 150 KB</small>
            </span>
            <Switch
              checked={frame}
              onCheckedChange={setFrame}
              aria-label="Allocate camera framebuffer"
            />
          </label>
          <label className="field-row">
            PSRAM scenario
            <select
              value={psram}
              disabled={!chip.psram}
              onChange={(e) => setPsram(Number(e.target.value))}
            >
              {[0, 2, 8, 16].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'Not installed' : `${n} MB installed`}
                </option>
              ))}
            </select>
          </label>
          <label className="range-label">
            <span>
              Additional buffer <strong>{extra} KB</strong>
            </span>
            <input
              aria-label="Additional memory buffer in KB"
              type="range"
              min="0"
              max="2048"
              step="16"
              value={extra}
              onChange={(e) => setExtra(Number(e.target.value))}
            />
          </label>
          <p className="micro-copy">
            With PSRAM enabled, this model sends the frame and additional buffer
            there. Driver allocations stay internal.
          </p>
          <label className="toggle-row">
            <span>
              Deep-sleep thought experiment
              <small>Main execution stops; configured retention remains.</small>
            </span>
            <Switch
              checked={sleep}
              onCheckedChange={setSleep}
              aria-label="Show deep sleep memory behavior"
            />
          </label>
        </div>
        <div className="allocation">
          <h3>
            Internal SRAM allocation{' '}
            <span>
              {b.internal} / {chip.sram} KB
            </span>
          </h3>
          <div className="stacked-bar">
            {[
              [b.system, '#93aaa3'],
              [b.radio, '#70b7a2'],
              [b.drivers, '#b4cf95'],
              [psram ? 0 : b.frameKB + extra, '#b59bbe'],
            ].map(([n, c], i) => (
              <span
                key={i}
                style={{
                  width: Math.min((Number(n) / chip.sram) * 100, 100) + '%',
                  background: String(c),
                }}
              />
            ))}
          </div>
          {[
            ['System, stacks & static data', b.system],
            ['Radio workload', b.radio],
            ['Connected device buffers', b.drivers],
            ['Frame + additional buffer', psram ? 0 : b.frameKB + extra],
            ['Remaining modeled capacity', b.free],
          ].map(([l, n]) => (
            <div className="allocation-row" key={l}>
              <span>{l}</span>
              <strong>{n} KB</strong>
            </div>
          ))}
          <p className={b.overflow ? 'notice danger' : 'notice success'}>
            {b.overflow
              ? 'Allocation exceeds the modeled capacity. Reduce buffers or use a suitable PSRAM-equipped module.'
              : `Fits this budget. External buffers: ${b.external} KB. This is not a guarantee of successful allocation on hardware.`}
          </p>
          {sleep && (
            <p className="notice">
              In deep sleep, ordinary heap/stack contents should not be assumed
              to survive. Use supported RTC/LP retention or persist data to
              flash. A full power loss clears all RAM.
            </p>
          )}
          <h3 className="flash-title">Flash & OTA budget</h3>
          <label className="field-row">
            Flash capacity
            <select
              value={flash}
              onChange={(e) => setFlash(Number(e.target.value))}
            >
              {[4, 8, 16].map((v) => (
                <option key={v} value={v}>
                  {v} MB
                </option>
              ))}
            </select>
          </label>
          <label className="range-label">
            <span>
              Application image<strong>{firmware} KB</strong>
            </span>
            <input
              aria-label="Application image size in KB"
              type="range"
              min="200"
              max="8000"
              step="100"
              value={firmware}
              onChange={(e) => setFirmware(Number(e.target.value))}
            />
          </label>
          <p
            className={
              firmware * 2 + 512 > flash * 1024 ? 'notice danger' : 'micro-copy'
            }
          >
            Two OTA slots + 512 KB reserved = {firmware * 2 + 512} KB.{' '}
            {firmware * 2 + 512 > flash * 1024
              ? 'This scenario does not fit.'
              : 'Fits the selected flash budget.'}
          </p>
        </div>
      </div>
    </div>
  );
}
export function ComparePanel({ onSelect }: { onSelect: (c: Chip) => void }) {
  const [filter, setFilter] = useState('all');
  const shown = chips.filter(
    (c) =>
      filter === 'all' ||
      (filter === 'wifi' && c.wifi !== 'None') ||
      (filter === 'mesh' && c.mesh) ||
      (filter === 'ram' && c.psram) ||
      (filter === 'usb' && c.usb.includes('OTG')),
  );
  return (
    <section className="compare-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">FIND YOUR STARTING POINT</span>
          <h2>One family. Many personalities.</h2>
          <p>
            Compare 14 ESP32 families by the capabilities that matter to your
            project.
          </p>
        </div>
      </div>
      <div className="filter-tabs">
        {[
          ['all', 'All families'],
          ['wifi', 'Wi-Fi'],
          ['mesh', 'Thread / Zigbee'],
          ['ram', 'PSRAM support'],
          ['usb', 'USB OTG'],
        ].map(([k, v]) => (
          <Button
            key={k}
            variant={filter === k ? 'default' : 'outline'}
            onClick={() => setFilter(k)}
          >
            {v}
          </Button>
        ))}
      </div>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              {[
                'Chip family',
                'Application CPU',
                'SRAM / ROM',
                'Wi-Fi',
                'Bluetooth',
                '802.15.4',
                'PSRAM',
                'Explore',
              ].map((v) => (
                <th key={v}>{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <small>
                    {c.specialty}
                    {c.reference ? ' · reference' : ''}
                  </small>
                </td>
                <td>
                  {c.cores} × {c.mhz} MHz<small>{c.cpu}</small>
                </td>
                <td>
                  {c.sram} / {c.rom ?? '—'} KB
                </td>
                <td>{c.wifi}</td>
                <td>{c.bluetooth}</td>
                <td>{c.mesh ? <Check size={17} className="teal" /> : '—'}</td>
                <td>{c.psram ? <Check size={17} className="teal" /> : '—'}</td>
                <td>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Explore ${c.name}`}
                    onClick={() => onSelect(c)}
                  >
                    <ArrowUpRight />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="notice">
        <Info size={15} />
        CPU counts describe application cores; LP coprocessors are listed
        separately. SRAM figures are chip totals, not free heap. External
        memory, exposed GPIO, optional features, and SDK support depend on the
        exact part. Catalog checked September 9, 2026; follow each datasheet for
        updates.
      </p>
      <div className="recommendations">
        {[
          [
            'Start exploring',
            'ESP32-S3',
            'A flexible starting point for display, voice, and USB experiments.',
          ],
          [
            'Build a Thread device',
            'ESP32-C6',
            'Explore Wi-Fi 6 and IEEE 802.15.4 on one family.',
          ],
          [
            'Drive a rich display',
            'ESP32-P4',
            'Explore multimedia acceleration with a wireless companion if needed.',
          ],
        ].map(([t, id, p]) => (
          <article key={id}>
            <span className="eyebrow">{t}</span>
            <h3>{id}</h3>
            <p>{p}</p>
            <Button
              variant="link"
              onClick={() => onSelect(chips.find((c) => c.id === id)!)}
            >
              Open workbench <ArrowRight />
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
export function LearningPanel({
  completed,
  onComplete,
  onExperiment,
}: {
  completed: string[];
  onComplete: (id: string) => void;
  onExperiment: (id: string) => void;
}) {
  const [current, setCurrent] = useState(0),
    [answer, setAnswer] = useState<number | null>(null);
  const lesson = lessons[current];
  return (
    <section className="learning-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">FROM FIRST BLINK TO CONNECTED SYSTEMS</span>
          <h2>Learn it. Wire it. Understand it.</h2>
          <p>
            A practical path through hardware, firmware, and everything between.
          </p>
        </div>
        <div className="course-progress">
          <strong>
            {completed.length} / {lessons.length}
          </strong>
          <span>lessons completed</span>
          <Progress value={(completed.length / lessons.length) * 100} />
        </div>
      </div>
      <div className="course-layout">
        <aside className="lesson-nav">
          {lessons.map((l, i) => (
            <button
              className={current === i ? 'current' : ''}
              key={l.id}
              onClick={() => {
                setCurrent(i);
                setAnswer(null);
              }}
            >
              <span className={completed.includes(l.id) ? 'done' : ''}>
                {completed.includes(l.id) ? (
                  <Check size={13} />
                ) : (
                  String(i + 1).padStart(2, '0')
                )}
              </span>
              <div>
                <small>{l.category}</small>
                <strong>{l.title}</strong>
              </div>
              <ChevronRight size={14} />
            </button>
          ))}
        </aside>
        <article className="lesson">
          <div className="lesson-meta">
            <span>{lesson.category}</span>
            <span>{lesson.time} read & explore</span>
          </div>
          <h2>{lesson.title}</h2>
          <p className="lesson-lead">{lesson.summary}</p>
          {lesson.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {lesson.experiment && (
            <Button
              onClick={() => onExperiment(lesson.experiment!)}
              variant="secondary"
              className="lesson-experiment"
            >
              <FlaskConical />
              Try this on the workbench
              <ArrowRight />
            </Button>
          )}
          <div className="quiz">
            <span className="eyebrow">CHECK YOUR UNDERSTANDING</span>
            <h3>{lesson.question}</h3>
            {lesson.answers.map((a, i) => (
              <button
                key={a}
                className={
                  'answer ' +
                  (answer === i
                    ? i === lesson.correct
                      ? 'correct'
                      : 'incorrect'
                    : '')
                }
                onClick={() => {
                  setAnswer(i);
                  if (i === lesson.correct) onComplete(lesson.id);
                }}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {a}
                {answer === i &&
                  (i === lesson.correct ? (
                    <Check size={16} />
                  ) : (
                    <X size={16} />
                  ))}
              </button>
            ))}
            {answer !== null && (
              <p
                role="status"
                className={
                  'quiz-feedback ' + (answer === lesson.correct ? 'teal' : '')
                }
              >
                <strong>
                  {answer === lesson.correct ? 'Exactly. ' : 'Try again. '}
                </strong>
                {lesson.explanation}
              </p>
            )}
          </div>
          <div className="lesson-bottom">
            <span>
              {completed.includes(lesson.id)
                ? '✓ Completed · saved in this browser'
                : 'Answer the question correctly to complete this lesson.'}
            </span>
            <Button
              variant="outline"
              disabled={current === lessons.length - 1}
              onClick={() => {
                setCurrent(current + 1);
                setAnswer(null);
              }}
            >
              Next lesson
              <ArrowRight />
            </Button>
          </div>
        </article>
      </div>
    </section>
  );
}
export function ReferencePanel() {
  const [query, setQuery] = useState('');
  const glossary = [
    [
      'GPIO matrix',
      'Routes many digital peripheral signals to compatible GPIOs. Analog, USB, memory, and other dedicated functions still have fixed restrictions.',
    ],
    [
      'ADC',
      'Analog-to-digital converter. Samples an input voltage; range and accuracy depend on configuration and calibration.',
    ],
    [
      'DAC',
      'Digital-to-analog converter. Produces a real analog voltage; support differs across ESP32 families.',
    ],
    [
      'PWM / LEDC',
      'Pulse-width modulation varies a digital waveform’s duty cycle. LEDC is a hardware PWM peripheral, not just an LED-specific software function.',
    ],
    [
      'I²C',
      'Addressed serial bus using open-drain SDA and SCL with pull-up resistors.',
    ],
    [
      'SPI',
      'Synchronous serial bus with clock, data, and chip-select signals. Often faster than I²C, with more wires.',
    ],
    [
      'UART',
      'Asynchronous serial transmitter and receiver. Match baud rate and framing; cross TX and RX.',
    ],
    [
      'I²S',
      'Synchronous digital audio interface using bit clock, word-select, and serial data.',
    ],
    [
      'TWAI / CAN',
      'A controller for CAN-style networks. Real bus connections require a compatible external transceiver and termination; GPIO is not the CAN bus voltage.',
    ],
    [
      'RMT',
      'Remote-control peripheral that generates or captures timed pulses, useful for IR or addressable LED protocols on supported targets.',
    ],
    [
      'JTAG',
      'Hardware debugging interface for breakpoints, stepping, and inspection. USB Serial/JTAG is a fixed-function interface, distinct from USB OTG.',
    ],
    [
      'DMA',
      'Direct memory access moves data between peripherals and memory with less CPU copying. Buffer constraints are target-specific.',
    ],
    [
      'SRAM',
      'Fast, volatile internal working memory for code, data, stacks, and heap.',
    ],
    [
      'ROM',
      'Factory-programmed, nonvolatile code/data memory that ordinary firmware uploads cannot rewrite.',
    ],
    [
      'Flash / NVS',
      'Nonvolatile storage. NVS is a key/value storage system in a flash partition, not a separate memory chip.',
    ],
    [
      'PSRAM',
      'External pseudo-static RAM for larger working buffers, accessed through the target’s memory interface/cache.',
    ],
    [
      'IRAM / DRAM',
      'Instruction and data memory uses/address regions. They are not extra memory capacities to add to the advertised SRAM.',
    ],
    [
      'RTC / LP memory',
      'Memory in configurable low-power domains that can retain selected state through supported sleep modes.',
    ],
    [
      'Stack / heap',
      'The stack holds task-local call frames; the heap provides dynamic allocations. Fragmentation can prevent large contiguous allocations.',
    ],
    [
      'eFuse',
      'One-time-programmable bits for identity, configuration, and security. Some changes are irreversible.',
    ],
    [
      'Strapping pin',
      'A pin sampled during reset to select boot or other configuration. External pull levels matter.',
    ],
    [
      'Matter / Thread',
      'Matter is an application protocol. Thread is an IPv6 mesh over IEEE 802.15.4. They are not synonyms for Wi-Fi or Bluetooth.',
    ],
    [
      'Brownout / watchdog',
      'A brownout reset responds to inadequate supply voltage; a watchdog reset responds to stalled or unresponsive execution.',
    ],
  ];
  return (
    <section className="reference-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">KEEP THE DATASHEET CLOSE</span>
          <h2>Your electronics field guide.</h2>
          <p>Plain-language concepts and links to the source material.</p>
        </div>
      </div>
      <div className="scope-note">
        <Info />
        <div>
          <strong>What this lab models</strong>
          <p>
            Interactive 3D educational carriers, digital wiring rules, idealized
            device responses, conceptual signals, and illustrative memory
            budgets. It does not emulate ESP32 instructions, compile arbitrary
            firmware, model real RF traffic, or solve analog circuits. Pin views
            are not physical header maps.
          </p>
          <p>
            Fourteen chip families are cataloged. H21 and H4 use abstract
            virtual terminals; E22 is an architecture reference with no general
            GPIO simulation. Other families expose documented learning subsets.
            Commercial board layouts, all package SKUs, and dedicated high-speed
            buses are linked through their official references, not reproduced
            exhaustively.
          </p>
        </div>
      </div>
      <div className="resource-grid">
        {resources.map(([title, url, desc]) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            <BookOpen size={18} />
            <h3>
              {title}
              <ArrowUpRight size={15} />
            </h3>
            <p>{desc}</p>
            <small>ESPRESSIF DOCUMENTATION</small>
          </a>
        ))}
      </div>
      <h3 className="glossary-heading">Speak the language</h3>
      <Input
        aria-label="Search the electronics glossary"
        placeholder="Find a concept, e.g. PSRAM, UART, strapping…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="glossary">
        {glossary
          .filter(([t, p]) =>
            (t + ' ' + p).toLowerCase().includes(query.toLowerCase()),
          )
          .map(([t, p]) => (
            <article key={t}>
              <h4>{t}</h4>
              <p>{p}</p>
            </article>
          ))}
      </div>
      {!glossary.some(([t, p]) =>
        (t + ' ' + p).toLowerCase().includes(query.toLowerCase()),
      ) && <p className="empty">No matching concepts. Try a shorter search.</p>}
    </section>
  );
}
