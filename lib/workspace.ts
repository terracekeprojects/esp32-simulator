import { chips } from './hardware';
import { normalizeState, stepRules, type LabState } from './lab-state';
import { defaultSettings } from './parameters';
import { validate } from './simulation';
import { encodeFrame, decodeFrame } from './pipeline';
import { buildTemplate } from './templates';

export type BoardNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  locked: boolean;
  lab: LabState;
};
export type BoardLink = {
  id: string;
  from: string;
  to: string;
  tx: string;
  rx: string;
  baud: number;
  peerBaud: number;
  ground: boolean;
  connected: boolean;
  corrupt: boolean;
};
export type Workspace = {
  schema: 1;
  nodes: BoardNode[];
  links: BoardLink[];
  grid: number;
  snap: boolean;
};
export function blankLab(chip: string): LabState {
  return {
    chip,
    devices: [],
    wires: [],
    rules: [],
    settings: { ...defaultSettings },
    template: null,
    running: false,
  };
}
export function initialWorkspace(): Workspace {
  return {
    schema: 1,
    nodes: [
      {
        id: 's3-main',
        name: 'Sensor controller',
        x: 120,
        y: 180,
        color: '#245849',
        locked: false,
        lab: blankLab('ESP32-S3'),
      },
      {
        id: 'p4-display',
        name: 'Display controller',
        x: 600,
        y: 180,
        color: '#375c80',
        locked: false,
        lab: blankLab('ESP32-P4'),
      },
    ],
    links: [
      {
        id: 'demo-uart',
        from: 's3-main',
        to: 'p4-display',
        tx: 'GPIO12',
        rx: 'GPIO13',
        baud: 115200,
        peerBaud: 115200,
        ground: true,
        connected: true,
        corrupt: false,
      },
    ],
    grid: 20,
    snap: true,
  };
}
export function normalizeWorkspace(raw: unknown): Workspace {
  const w = raw as Workspace;
  if (
    !w ||
    w.schema !== 1 ||
    !Array.isArray(w.nodes) ||
    !Array.isArray(w.links) ||
    w.nodes.length < 1 ||
    w.nodes.length > 8 ||
    w.links.length > 24
  )
    throw Error('Workspace needs 1–8 boards and at most 24 links.');
  const nodes = w.nodes.map((n) => {
    if (
      !n ||
      typeof n.id !== 'string' ||
      n.id.length > 100 ||
      typeof n.name !== 'string' ||
      n.name.length > 80 ||
      ![n.x, n.y].every(Number.isFinite) ||
      n.x < 0 ||
      n.x > 2160 ||
      n.y < 0 ||
      n.y > 1440 ||
      !/^#[a-f0-9]{6}$/i.test(n.color)
    )
      throw Error('Invalid board layout.');
    return { ...n, locked: !!n.locked, lab: normalizeState(n.lab) };
  });
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length)
    throw Error('Duplicate board IDs.');
  const links = w.links.map((l) => {
    const from = nodes.find((n) => n.id === l.from),
      to = nodes.find((n) => n.id === l.to);
    if (
      !l ||
      typeof l.id !== 'string' ||
      l.id.length > 100 ||
      !from ||
      !to ||
      from === to ||
      ![l.baud, l.peerBaud].every(
        (v) => Number.isInteger(v) && v >= 300 && v <= 2000000,
      ) ||
      !['tx', 'rx'].every((k) => typeof l[k as 'tx' | 'rx'] === 'string') ||
      !chips
        .find((c) => c.id === from.lab.chip)
        ?.pins.some((p) => p.id === l.tx) ||
      !chips.find((c) => c.id === to.lab.chip)?.pins.some((p) => p.id === l.rx)
    )
      throw Error('Invalid board link.');
    return {
      ...l,
      ground: !!l.ground,
      connected: !!l.connected,
      corrupt: !!l.corrupt,
    };
  });
  if (new Set(links.map((l) => l.id)).size !== links.length)
    throw Error('Duplicate link IDs.');
  return {
    schema: 1,
    nodes,
    links,
    grid: [10, 20, 40].includes(w.grid) ? w.grid : 20,
    snap: !!w.snap,
  };
}
export function testBoardLink(w: Workspace, l: BoardLink, payload: object) {
  const from = w.nodes.find((n) => n.id === l.from),
    to = w.nodes.find((n) => n.id === l.to);
  if (!from || !to) throw Error('A board was removed.');
  if (!l.connected) throw Error('Cable disconnected: no data delivered.');
  if (!l.ground) throw Error('Connect a shared ground reference first.');
  if (l.baud !== l.peerBaud)
    throw Error('Baud mismatch: configure both UARTs at the same speed.');
  if (
    w.links.some(
      (other) =>
        other.id !== l.id &&
        other.connected &&
        other.to === l.to &&
        other.rx === l.rx,
    )
  )
    throw Error(
      'Two transmitters share this RX pin. Give each link a separate UART input.',
    );
  for (const [node, pinId, output] of [
    [from, l.tx, true],
    [to, l.rx, false],
  ] as const) {
    const pin = chips
      .find((c) => c.id === node.lab.chip)
      ?.pins.find((p) => p.id === pinId);
    if (
      !pin ||
      pin.kind !== 'gpio' ||
      pin.reserved ||
      pin.usb ||
      (output && pin.inputOnly)
    )
      throw Error(`${node.name}: ${pinId} cannot serve this UART endpoint.`);
    const assigned = node.lab.wires.filter((w) => w.pinId === pinId);
    if (
      assigned.some(
        (w) =>
          node.lab.devices.find((d) => d.id === w.deviceId)?.type !==
            'displaylink' || !w.terminal.startsWith(output ? 'RX' : 'TX'),
      )
    )
      throw Error(
        `${node.name}: ${pinId} is already connected to a peripheral.`,
      );
  }
  const frame = encodeFrame(payload);
  if (l.corrupt) frame[4] ^= 1;
  const decoded = decodeFrame(frame);
  return {
    decoded,
    bytes: frame.length,
    wireMs: ((frame.length * 10) / l.baud) * 1000,
    hex: Array.from(frame, (b) => b.toString(16).padStart(2, '0')).join(' '),
  };
}
export function stepWorkspace(w: Workspace) {
  const reports: string[] = [];
  const nodes = w.nodes.map((n) => {
    const checks = validate(
      chips.find((c) => c.id === n.lab.chip)!,
      n.lab.devices,
      n.lab.wires,
    );
    if (checks.errors.length) {
      reports.push(`${n.name}: blocked · ${checks.errors[0]}`);
      return n;
    }
    reports.push(
      `${n.name}: ${n.lab.rules.filter((r) => r.enabled).length} automation rules stepped.`,
    );
    return {
      ...n,
      lab: { ...n.lab, devices: stepRules(n.lab.devices, n.lab.rules) },
    };
  });
  return { workspace: { ...w, nodes }, reports };
}
