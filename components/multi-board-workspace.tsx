'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Save,
  Upload,
  Download,
  Play,
  Cpu,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { chips } from '@/lib/hardware';
import type { LabState } from '@/lib/lab-state';
import {
  initialWorkspace,
  normalizeWorkspace,
  blankLab,
  testBoardLink,
  stepWorkspace,
  type Workspace,
  type BoardNode,
  type BoardLink,
} from '@/lib/workspace';
import { saveBlob } from './pipeline-player';
export function MultiBoardWorkspace({
  active,
  current,
  onEdit,
  onTest,
}: {
  active: boolean;
  current: LabState;
  onEdit: (s: LabState) => void;
  onTest: () => void;
}) {
  const [space, setSpace] = useState(initialWorkspace),
    [selected, setSelected] = useState('s3-main'),
    [editing, setEditing] = useState<string | null>(null);
  const [family, setFamily] = useState('ESP32-S3'),
    [zoom, setZoom] = useState(0.75),
    [pan, setPan] = useState({ x: 10, y: 10 });
  const [message, setMessage] = useState(
    'Drag a board by its heading. Open 3D to wire devices and write code for that board.',
  );
  const [logs, setLogs] = useState<string[]>([]),
    [payload, setPayload] = useState('{"sensor":"temperature","value":27}');
  const [linkId, setLinkId] = useState('demo-uart'),
    [from, setFrom] = useState('s3-main'),
    [to, setTo] = useState('p4-display');
  const [running, setRunning] = useState(false),
    [interval, setIntervalMs] = useState(500),
    [help, setHelp] = useState(true);
  const drag = useRef<{
      id: string;
      x: number;
      y: number;
      clientX: number;
      clientY: number;
    } | null>(null),
    importer = useRef<HTMLInputElement>(null),
    latest = useRef(space);
  latest.current = space;
  const board = space.nodes.find((n) => n.id === selected),
    link = space.links.find((l) => l.id === linkId);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('esplab-workspace');
      if (saved) {
        const parsed = normalizeWorkspace(JSON.parse(saved));
        setSpace(parsed);
        setSelected(parsed.nodes[0].id);
      }
    } catch {
      setMessage(
        'Saved workspace could not be restored. The starter layout is available.',
      );
    }
  }, []);
  const signature = JSON.stringify(current);
  useEffect(() => {
    if (editing && !current.restricted)
      setSpace((w) => {
        const n = w.nodes.find((n) => n.id === editing);
        if (!n || JSON.stringify(n.lab) === signature) return w;
        return {
          ...w,
          nodes: w.nodes.map((n) =>
            n.id === editing
              ? { ...n, lab: { ...current, running: false } }
              : n,
          ),
        };
      });
  }, [signature, editing]);
  useEffect(() => {
    if (!active) setRunning(false);
  }, [active]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const result = stepWorkspace(latest.current);
      setSpace(result.workspace);
      setLogs((l) => [...l, ...result.reports].slice(-60));
    }, interval);
    return () => clearInterval(timer);
  }, [running, interval]);
  function updateNode(p: Partial<BoardNode>) {
    setSpace((w) => ({
      ...w,
      nodes: w.nodes.map((n) => (n.id === selected ? { ...n, ...p } : n)),
    }));
  }
  function updateLink(p: Partial<BoardLink>) {
    setSpace((w) => ({
      ...w,
      links: w.links.map((l) => (l.id === linkId ? { ...l, ...p } : l)),
    }));
  }
  function add() {
    if (space.nodes.length >= 8) return;
    const id = crypto.randomUUID();
    setSpace((w) => ({
      ...w,
      nodes: [
        ...w.nodes,
        {
          id,
          name: family + ' · ' + (w.nodes.length + 1),
          x: 120 + (w.nodes.length % 3) * 360,
          y: 180 + Math.floor(w.nodes.length / 3) * 230,
          color: chips.find((c) => c.id === family)!.color,
          locked: false,
          lab: blankLab(family),
        },
      ],
    }));
    setSelected(id);
  }
  function duplicate() {
    if (!board || space.nodes.length >= 8) return;
    const n = structuredClone(board);
    n.id = crypto.randomUUID();
    n.name = (n.name + ' copy').slice(0, 80);
    n.x = Math.min(2160, n.x + 60);
    n.y = Math.min(1440, n.y + 100);
    n.locked = false;
    setSpace((w) => ({ ...w, nodes: [...w.nodes, n] }));
    setSelected(n.id);
  }
  function remove() {
    if (!board || space.nodes.length === 1) return;
    setSpace((w) => ({
      ...w,
      nodes: w.nodes.filter((n) => n.id !== selected),
      links: w.links.filter((l) => l.from !== selected && l.to !== selected),
    }));
    if (editing === selected) setEditing(null);
    setSelected(space.nodes.find((n) => n.id !== selected)!.id);
  }
  function save() {
    try {
      localStorage.setItem('esplab-workspace', JSON.stringify(space));
      setMessage(
        'All boards, circuits, links and positions saved in this browser.',
      );
    } catch {
      setMessage('Browser storage unavailable. Export workspace JSON instead.');
    }
  }
  function addLink() {
    try {
      if (from === to) throw Error('Choose two different boards.');
      if (space.links.length >= 24) throw Error('Link limit reached.');
      const source = space.nodes.find((n) => n.id === from),
        target = space.nodes.find((n) => n.id === to);
      if (!source || !target) throw Error('Choose both boards.');
      const pin = (n: BoardNode, out: boolean) =>
        chips
          .find((c) => c.id === n.lab.chip)!
          .pins.find(
            (p) =>
              p.kind === 'gpio' &&
              !p.reserved &&
              !p.usb &&
              (!out || !p.inputOnly),
          )?.id;
      if (!pin(source, true) || !pin(target, false))
        throw Error('This reference profile has no suitable pins.');
      const l: BoardLink = {
        id: crypto.randomUUID(),
        from,
        to,
        tx: pin(source, true)!,
        rx: pin(target, false)!,
        baud: 115200,
        peerBaud: 115200,
        ground: true,
        connected: true,
        corrupt: false,
      };
      setSpace((w) => ({ ...w, links: [...w.links, l] }));
      setLinkId(l.id);
      setMessage(
        'Link added. Choose free TX/RX pins below and send a test packet.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function send() {
    if (!link) return;
    try {
      const json = JSON.parse(payload);
      if (!json || typeof json !== 'object' || Array.isArray(json))
        throw Error('Enter a JSON object.');
      const result = testBoardLink(space, link, json);
      setLogs((l) =>
        [
          ...l,
          `${new Date().toLocaleTimeString()} ${space.nodes.find((n) => n.id === link.to)?.name} RX: ${JSON.stringify(result.decoded)} · ${result.bytes} bytes / ${result.wireMs.toFixed(2)} ms`,
          result.hex,
        ].slice(-60),
      );
      setMessage(
        'Packet delivered to the simulated receiver. UART transport does not execute a command automatically.',
      );
    } catch (e) {
      setLogs((l) => [...l, `DROP: ${(e as Error).message}`].slice(-60));
      setMessage((e as Error).message);
    }
  }
  function pointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.id === 'pan') {
      setPan({
        x: d.x + e.clientX - d.clientX,
        y: d.y + e.clientY - d.clientY,
      });
      return;
    }
    let x = d.x + (e.clientX - d.clientX) / zoom,
      y = d.y + (e.clientY - d.clientY) / zoom;
    if (space.snap) {
      x = Math.round(x / space.grid) * space.grid;
      y = Math.round(y / space.grid) * space.grid;
    }
    setSpace((w) => ({
      ...w,
      nodes: w.nodes.map((n) =>
        n.id === d.id
          ? {
              ...n,
              x: Math.max(0, Math.min(2160, x)),
              y: Math.max(0, Math.min(1440, y)),
            }
          : n,
      ),
    }));
  }
  if (!active) return null;
  return (
    <div className="network-workspace">
      <div className="master-section-heading">
        <div>
          <div className="eyebrow">SYSTEM WORKSPACE</div>
          <h1>Build with more than one ESP.</h1>
          <p>Each board keeps its own devices, wiring, code and parameters.</p>
        </div>
        <div className="master-actions">
          <Button variant="outline" onClick={save}>
            <Save />
            Save
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              saveBlob(
                'esplab-workspace.json',
                new Blob([JSON.stringify(space, null, 2)], {
                  type: 'application/json',
                }),
              )
            }
          >
            <Download />
            Export
          </Button>
          <Button variant="outline" onClick={() => importer.current?.click()}>
            <Upload />
            Import
          </Button>
          <input
            ref={importer}
            hidden
            type="file"
            accept=".json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                if (file.size > 1500000)
                  throw Error('Workspace file exceeds 1.5 MB.');
                const next = normalizeWorkspace(JSON.parse(await file.text()));
                setEditing(null);
                setRunning(false);
                setSpace(next);
                setSelected(next.nodes[0].id);
                setMessage(
                  'Workspace imported. Use Save to keep it in this browser.',
                );
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          />
        </div>
      </div>
      <div className="network-toolbar">
        <select
          aria-label="ESP family to add"
          value={family}
          onChange={(e) => setFamily(e.target.value)}
        >
          {chips.map((c) => (
            <option key={c.id}>{c.id}</option>
          ))}
        </select>
        <Button disabled={space.nodes.length >= 8} onClick={add}>
          <Plus />
          Add ESP ({space.nodes.length}/8)
        </Button>
        <label>
          <input
            type="checkbox"
            checked={space.snap}
            onChange={(e) => setSpace({ ...space, snap: e.target.checked })}
          />
          Snap
        </label>
        <select
          aria-label="Grid spacing"
          value={space.grid}
          onChange={(e) => setSpace({ ...space, grid: +e.target.value })}
        >
          {[10, 20, 40].map((n) => (
            <option key={n} value={n}>
              {n}px grid
            </option>
          ))}
        </select>
        <Button
          size="icon"
          variant="outline"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
        >
          <ZoomOut />
        </Button>
        <span>{Math.round(zoom * 100)}%</span>
        <Button
          size="icon"
          variant="outline"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
        >
          <ZoomIn />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Reset canvas view"
          onClick={() => {
            setZoom(0.75);
            setPan({ x: 10, y: 10 });
          }}
        >
          <RotateCcw />
        </Button>
        <Button variant="outline" onClick={() => setHelp(!help)}>
          Beginner guide
        </Button>
      </div>
      {help && (
        <div className="network-guide">
          <b>1. Add boards</b>
          <span>Drag headings to arrange them.</span>
          <b>2. Open 3D</b>
          <span>Connect devices and edit code per board.</span>
          <b>3. Link & test</b>
          <span>Send packets, check faults, then try your microphone.</span>
        </div>
      )}
      <div className="network-layout">
        <div
          className="network-canvas"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('[data-board],button'))
              return;
            drag.current = {
              id: 'pan',
              x: pan.x,
              y: pan.y,
              clientX: e.clientX,
              clientY: e.clientY,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={pointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <div
            className="network-world"
            style={{
              transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              backgroundSize: `${space.grid}px ${space.grid}px`,
            }}
          >
            <svg
              className="network-links"
              width="2400"
              height="1600"
              aria-label="Board links"
            >
              <defs>
                <marker
                  id="network-arrow"
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L6,3 z" fill="#3d8367" />
                </marker>
              </defs>
              {space.links.map((l) => {
                const a = space.nodes.find((n) => n.id === l.from)!,
                  b = space.nodes.find((n) => n.id === l.to)!;
                return (
                  <g key={l.id}>
                    <path
                      d={`M${a.x + 240},${a.y + 80} C${a.x + 310},${a.y + 80} ${b.x - 70},${b.y + 80} ${b.x},${b.y + 80}`}
                      fill="none"
                      stroke={l.connected ? '#3d8367' : '#be9173'}
                      strokeWidth={l.id === linkId ? 4 : 2}
                      strokeDasharray={l.connected ? '' : '8 5'}
                      markerEnd="url(#network-arrow)"
                    />
                    <text
                      x={(a.x + b.x + 240) / 2}
                      y={(a.y + b.y) / 2 + 68}
                      fill="#426954"
                      fontSize="11"
                    >
                      {l.tx} → {l.rx}
                    </text>
                  </g>
                );
              })}
            </svg>
            {space.nodes.map((n) => (
              <article
                data-board
                key={n.id}
                className={`network-board ${n.id === selected ? 'selected' : ''}`}
                style={{ left: n.x, top: n.y, borderTopColor: n.color }}
                onClick={() => setSelected(n.id)}
              >
                <header
                  tabIndex={0}
                  role="button"
                  aria-label={`Move ${n.name}; arrow keys move by grid spacing`}
                  onKeyDown={(e) => {
                    const dx =
                        e.key === 'ArrowRight'
                          ? space.grid
                          : e.key === 'ArrowLeft'
                            ? -space.grid
                            : 0,
                      dy =
                        e.key === 'ArrowDown'
                          ? space.grid
                          : e.key === 'ArrowUp'
                            ? -space.grid
                            : 0;
                    if ((dx || dy) && !n.locked) {
                      e.preventDefault();
                      setSpace((w) => ({
                        ...w,
                        nodes: w.nodes.map((b) =>
                          b.id === n.id
                            ? {
                                ...b,
                                x: Math.max(0, Math.min(2160, b.x + dx)),
                                y: Math.max(0, Math.min(1440, b.y + dy)),
                              }
                            : b,
                        ),
                      }));
                    }
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelected(n.id);
                    if (n.locked) return;
                    drag.current = {
                      id: n.id,
                      x: n.x,
                      y: n.y,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                >
                  <Cpu size={18} />
                  <strong>{n.name}</strong>
                  <span>{n.locked ? 'LOCK' : 'MOVE'}</span>
                </header>
                <p>
                  {n.lab.chip} · {n.lab.devices.length} devices ·{' '}
                  {n.lab.wires.length} wires
                </p>
                <div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setRunning(false);
                      setEditing(n.id);
                      onEdit(n.lab);
                    }}
                  >
                    Open 3D & code
                  </Button>
                  <small>{editing === n.id ? 'Linked to workbench' : ''}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
        <aside className="network-inspector">
          <h2>Board inspector</h2>
          {board && (
            <>
              <label>
                Name
                <input
                  maxLength={80}
                  value={board.name}
                  onChange={(e) => updateNode({ name: e.target.value })}
                />
              </label>
              <label>
                Color
                <input
                  type="color"
                  value={board.color}
                  onChange={(e) => updateNode({ color: e.target.value })}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={board.locked}
                  onChange={(e) => updateNode({ locked: e.target.checked })}
                />
                Lock position
              </label>
              <div className="master-actions">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={duplicate}
                  disabled={space.nodes.length >= 8}
                >
                  <Copy />
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={remove}
                  disabled={space.nodes.length === 1}
                >
                  <Trash2 />
                  Remove
                </Button>
              </div>
              <p>
                Board code runs in its 3D workbench. Step all below runs each
                board’s automation rules once; UART packets are inspected
                separately.
              </p>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => {
              const r = stepWorkspace(space);
              setSpace(r.workspace);
              setLogs((l) => [...l, ...r.reports].slice(-60));
            }}
          >
            Step all automation
          </Button>
          <Button variant="outline" onClick={() => setRunning(!running)}>
            {running ? 'Pause automation' : 'Run all automation'}
          </Button>
          <label>
            Step interval
            <select
              value={interval}
              onChange={(e) => setIntervalMs(+e.target.value)}
            >
              {[250, 500, 1000, 2000].map((v) => (
                <option key={v} value={v}>
                  {v} ms
                </option>
              ))}
            </select>
          </label>
          <Button onClick={onTest}>Open test lab</Button>
        </aside>
      </div>
      <p role="status" className="network-message">
        {message}
      </p>
      <section className="network-link-editor">
        <h2>Board-to-board UART testing</h2>
        <div className="master-actions">
          <select
            aria-label="Sending board"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            {space.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <span>→</span>
          <select
            aria-label="Receiving board"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            {space.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={addLink}>
            <Plus />
            Add directed link
          </Button>
          <select
            aria-label="Selected link"
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
          >
            <option value="">Select link</option>
            {space.links.map((l, i) => (
              <option key={l.id} value={l.id}>
                Link {i + 1} · {space.nodes.find((n) => n.id === l.from)?.name}
              </option>
            ))}
          </select>
        </div>
        {link && (
          <>
            <div className="network-link-fields">
              {(['tx', 'rx'] as const).map((k) => {
                const n = space.nodes.find(
                  (n) => n.id === (k === 'tx' ? link.from : link.to),
                )!;
                return (
                  <label key={k}>
                    {n.name} {k.toUpperCase()}
                    <select
                      value={link[k]}
                      onChange={(e) => updateLink({ [k]: e.target.value })}
                    >
                      {chips
                        .find((c) => c.id === n.lab.chip)!
                        .pins.filter(
                          (p) =>
                            p.kind === 'gpio' &&
                            !p.reserved &&
                            !p.usb &&
                            (k === 'rx' || !p.inputOnly),
                        )
                        .map((p) => (
                          <option key={p.id}>{p.id}</option>
                        ))}
                    </select>
                  </label>
                );
              })}
              {(['baud', 'peerBaud'] as const).map((k) => (
                <label key={k}>
                  {k === 'baud' ? 'Sender baud' : 'Receiver baud'}
                  <select
                    value={link[k]}
                    onChange={(e) => updateLink({ [k]: +e.target.value })}
                  >
                    {[9600, 57600, 115200, 230400].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              ))}
              {(['ground', 'connected', 'corrupt'] as const).map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={link[k]}
                    onChange={(e) => updateLink({ [k]: e.target.checked })}
                  />
                  {k === 'ground'
                    ? 'Shared GND'
                    : k === 'connected'
                      ? 'Cable connected'
                      : 'Corrupt one byte'}
                </label>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSpace((w) => ({
                    ...w,
                    links: w.links.filter((l) => l.id !== link.id),
                  }))
                }
              >
                <Trash2 />
                Remove link
              </Button>
            </div>
            <textarea
              aria-label="UART JSON payload"
              maxLength={2000}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
            <Button onClick={send}>Send & validate packet</Button>
          </>
        )}
        <p>
          Uses CRC-protected JSON teaching frames. Add a second directed link
          for the return path. This models transport, not Wi-Fi, electrical
          timing or firmware execution.
        </p>
        <pre className="test-console" aria-live="polite">
          {logs.join('\n') || 'No packets or automation steps yet.'}
        </pre>
        <Button size="sm" variant="ghost" onClick={() => setLogs([])}>
          Clear log
        </Button>
      </section>
    </div>
  );
}
