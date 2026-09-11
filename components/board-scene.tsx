'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw, Scan, ZoomIn, ZoomOut, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { category, param } from '@/lib/parameters';
import type { Chip } from '@/lib/hardware';
import { definition, type Device, type Wire } from '@/lib/simulation';
type Props = {
  chip: Chip;
  devices: Device[];
  wires: Wire[];
  selected: string | null;
  onPin: (id: string) => void;
  onTerminal: (device: string, terminal: string) => void;
  running: boolean;
  tick: number;
  labels: boolean;
  exploded: boolean;
  arrange?: boolean;
  onMove?: (id: string, position: { x: number; z: number }) => void;
};
export default function BoardScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    live = useRef(props),
    cameraControl = useRef<{
      reset: () => void;
      zoom: (factor: number) => void;
      top: () => void;
    } | null>(null);
  live.current = props;
  const [error, setError] = useState(false);
  const cameraSnapshot = useRef<{
    chip: string;
    count: number;
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      setError(true);
      return;
    }
    setError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D ESP32 board. Drag to orbit, scroll to zoom. Use the pin list for keyboard navigation.',
    );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f5f4');
    scene.fog = new THREE.Fog('#f1f5f4', 40, 80);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(8, 12, 13);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 5;
    controls.maxDistance = 65;
    controls.maxPolarAngle = Math.PI * 0.49;
    const fit = () => {
      const count = live.current.devices.length;
      const large = count > 4;
      camera.position.set(
        count ? (large ? 22 : 12) : 8,
        count ? (large ? 28 : 16) : 12,
        count ? (large ? 29 : 17) : 13,
      );
      controls.target.set(count ? (large ? 5 : 3) : 0, 0, large ? 1 : 0);
      controls.update();
    };
    fit();
    if (
      cameraSnapshot.current?.chip === props.chip.id &&
      cameraSnapshot.current?.count === props.devices.length
    ) {
      camera.position.copy(cameraSnapshot.current.position);
      controls.target.copy(cameraSnapshot.current.target);
      controls.update();
    }
    cameraControl.current = {
      reset: fit,
      zoom: (f) => {
        camera.position
          .sub(controls.target)
          .multiplyScalar(f)
          .add(controls.target);
        controls.update();
      },
      top: () => {
        const large = live.current.devices.length > 4;
        const x = live.current.devices.length ? (large ? 5 : 3) : 0;
        camera.position.set(
          x + 0.001,
          live.current.devices.length ? (large ? 36 : 23) : 17,
          0.001,
        );
        controls.target.set(x, 0, 0);
        controls.update();
      },
    };
    scene.add(new THREE.HemisphereLight('#ffffff', '#83978c', 2.5));
    const sun = new THREE.DirectionalLight('#ffffff', 3);
    sun.position.set(-5, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -12,
      right: 12,
      top: 12,
      bottom: -12,
    });
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: '#eef3f1', roughness: 1 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.25;
    plane.receiveShadow = true;
    scene.add(plane);
    const grid = new THREE.GridHelper(50, 100, '#d7e3dd', '#e0e9e4');
    grid.position.y = -0.24;
    scene.add(grid);
    const root = new THREE.Group();
    scene.add(root);
    const pickables: THREE.Object3D[] = [];
    const textures: THREE.Texture[] = [];
    const animated: {
      mesh: THREE.Mesh;
      device: Device;
      kind: string;
      ctx?: CanvasRenderingContext2D;
      texture?: THREE.CanvasTexture;
      lastText?: string;
    }[] = [];
    const material = (color: string, metalness = 0, roughness = 0.6) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness });
    function box(
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      color: string,
      metalness = 0,
    ) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material(color, metalness),
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    }
    function cylinder(
      r: number,
      h: number,
      x: number,
      y: number,
      z: number,
      color: string,
    ) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 24),
        material(color, 0.5),
      );
      m.position.set(x, y, z);
      m.castShadow = true;
      root.add(m);
      return m;
    }
    function label(
      text: string,
      x: number,
      y: number,
      z: number,
      size = 0.3,
      color = '#54726a',
      world = false,
    ) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 512, 100);
      ctx.font = '500 42px monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 50);
      const texture = new THREE.CanvasTexture(canvas);
      textures.push(texture);
      if (world) {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(size * 5.12, size),
          new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, y, z);
        root.add(mesh);
        return mesh;
      }
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
        }),
      );
      sprite.position.set(x, y, z);
      sprite.scale.set(size * 5.12, size, 1);
      root.add(sprite);
      return sprite;
    }
    function curve(points: THREE.Vector3[], color: string, r = 0.025) {
      const geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        40,
        r,
        6,
        false,
      );
      const mesh = new THREE.Mesh(geometry, material(color, 0.15, 0.4));
      root.add(mesh);
      return mesh;
    }
    const isE = props.chip.id === 'ESP32-E22';
    const boardW = isE ? 3.3 : 2.7,
      boardL = isE ? 4.1 : 6.1;
    box(boardW, 0.16, boardL, 0, 0, 0, props.chip.color);
    box(boardW - 0.1, 0.015, boardL - 0.12, 0, 0.09, 0, props.chip.color);
    for (const x of [-boardW / 2 + 0.18, boardW / 2 - 0.18])
      for (const z of [-boardL / 2 + 0.18, boardL / 2 - 0.18]) {
        cylinder(0.095, 0.02, x, 0.105, z, '#c7ac68');
        cylinder(0.052, 0.025, x, 0.12, z, '#263b32');
      }
    const moduleY = props.exploded ? 1.1 : 0.28;
    box(1.82, 0.22, 2.25, 0, moduleY, -0.73, '#b4c0bf', 0.85);
    box(1.74, 0.015, 2.17, 0, moduleY + 0.12, -0.73, '#ccd4d0', 0.6);
    label(props.chip.name, 0, moduleY + 0.138, -0.95, 0.24, '#425552', true);
    label('ESPRESSIF', 0, moduleY + 0.14, -1.35, 0.16, '#677a73', true);
    label('RF / MCU', 0, moduleY + 0.14, -0.55, 0.13, '#73817b', true);
    const antennaY = props.exploded ? 1.15 : 0.17;
    box(1.82, 0.09, 0.64, 0, antennaY, -2.22, '#263e2a');
    if (props.chip.wifi !== 'None' || props.chip.bluetooth !== 'None')
      for (let i = 0; i < 7; i++) {
        box(
          0.035,
          0.012,
          0.38,
          -0.7 + i * 0.22,
          antennaY + 0.06,
          -2.22,
          '#b99950',
          0.8,
        );
        if (i < 6)
          box(
            0.22,
            0.012,
            0.034,
            -0.59 + i * 0.22,
            antennaY + 0.06,
            -2.22 + (i % 2 ? 0.19 : -0.19),
            '#b99950',
            0.8,
          );
      }
    const memoryY = props.exploded ? 0.85 : 0.2;
    box(0.52, 0.12, 0.55, -0.45, memoryY, 0.91, '#252e2c');
    box(0.46, 0.12, 0.45, 0.49, memoryY, 0.88, '#252e2c');
    label('FLASH', -0.45, memoryY + 0.071, 0.91, 0.085, '#b9c7c1', true);
    label(
      props.chip.psram ? 'PSRAM' : 'LDO',
      0.49,
      memoryY + 0.071,
      0.88,
      0.08,
      '#b9c7c1',
      true,
    );
    for (let i = 0; i < 5; i++) {
      box(
        0.2,
        0.08,
        0.1,
        -0.6 + (i % 3) * 0.55,
        0.15,
        1.4 + Math.floor(i / 3) * 0.28,
        i % 2 ? '#9eaaa3' : '#c5ae80',
        0.5,
      );
    }
    if (!isE) {
      box(0.57, 0.24, 0.55, -0.43, 0.21, 2.89, '#9dadaa', 0.85);
      box(0.57, 0.24, 0.55, 0.43, 0.21, 2.89, '#9dadaa', 0.85);
      box(0.42, 0.13, 0.02, -0.43, 0.21, 3.17, '#344440');
      box(0.42, 0.13, 0.02, 0.43, 0.21, 3.17, '#344440');
      label('USB', 0, 0.11, 2.33, 0.14, '#bbcfc4', true);
      for (const x of [-0.8, 0.8]) {
        box(0.29, 0.13, 0.3, x, 0.19, 1.93, '#a8b5af', 0.7);
        box(0.16, 0.06, 0.16, x, 0.28, 1.93, '#2e3b34');
      }
    }
    if (props.exploded) {
      label('RF shield & processor', 0, 1.9, -0.8, 0.22);
      label('External memory', 0, 1.45, 1.1, 0.18);
      label('Carrier PCB & power', 0, 0.45, 2, 0.2);
    }
    const pinPos = new Map<string, THREE.Vector3>(),
      termPos = new Map<string, THREE.Vector3>();
    const half = Math.ceil(props.chip.pins.length / 2);
    const spacing = Math.min(0.29, 5.4 / Math.max(half - 1, 1));
    props.chip.pins.forEach((p, i) => {
      const side = i < half ? -1 : 1;
      const n = i % half,
        z = (n - (half - 1) / 2) * spacing,
        x = side * (boardW / 2 + 0.06);
      const color =
        p.id === props.selected
          ? '#efba56'
          : p.reserved
            ? '#72807a'
            : p.kind === 'ground'
              ? '#617584'
              : p.kind === 'power'
                ? '#c37760'
                : p.adc
                  ? '#6daea3'
                  : '#c5a25c';
      box(0.19, 0.15, 0.18, x, 0.13, z, '#26352d');
      const pin = box(0.075, 0.4, 0.075, x, 0.26, z, color, 0.7);
      pin.userData = { pin: p.id };
      pickables.push(pin);
      const hit = box(0.25, 0.45, spacing * 0.85, x, 0.25, z, color);
      (hit.material as THREE.Material).visible = false;
      hit.userData = { pin: p.id };
      pickables.push(hit);
      pinPos.set(p.id, new THREE.Vector3(x, 0.47, z));
      if (props.labels)
        label(
          p.label,
          x + side * 0.28,
          0.35,
          z,
          0.15,
          p.id === props.selected
            ? '#bf791f'
            : p.reserved
              ? '#9aa5a0'
              : '#547268',
        );
    });
    const deviceObjects = new Map<string, THREE.Object3D[]>();
    props.devices.forEach((device, index) => {
      const start = root.children.length;
      const def = definition(device),
        x =
          device.position?.x ??
          4.4 + (index % (props.devices.length > 4 ? 3 : 2)) * 3.25,
        z =
          device.position?.z ??
          -4 + Math.floor(index / (props.devices.length > 4 ? 3 : 2)) * 3.5;
      const wide = [
        'spi',
        'oled',
        'lcd1602',
        'epaper',
        'p4panel',
        'gt911',
      ].includes(device.type);
      const body = box(2.1, 0.13, 2, x, 0.01, z, def.color);
      body.userData = { moveDevice: device.id, x, z };
      if (props.arrange) pickables.push(body);
      label(def.name, x, 0.25, z + 1.38, 0.21);
      if (wide) {
        box(1.82, 0.11, 1.2, x, 0.15, z - 0.1, '#202c2e');
        const screen = box(1.61, 0.025, 0.94, x, 0.222, z - 0.1, '#164749');
        const display = document.createElement('canvas');
        display.width = 512;
        display.height = 256;
        const ctx = display.getContext('2d')!;
        const tex = new THREE.CanvasTexture(display);
        textures.push(tex);
        (screen.material as THREE.MeshStandardMaterial).map = tex;
        animated.push({
          mesh: screen,
          device,
          kind: 'screen',
          ctx,
          texture: tex,
        });
      } else if (device.type === 'led') {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 24, 16),
          new THREE.MeshStandardMaterial({
            color: '#d9783c',
            emissive: '#ff6a16',
            emissiveIntensity: 0,
            roughness: 0.24,
            transparent: true,
            opacity: 0.94,
          }),
        );
        m.position.set(x, 0.36, z);
        root.add(m);
        animated.push({ mesh: m, device, kind: 'led' });
        box(0.35, 0.13, 0.14, x - 0.63, 0.16, z, '#dbc895');
      } else if (['rgb', 'neopixel'].includes(device.type)) {
        box(1.85, 0.08, 0.5, x, 0.16, z, '#f3efe3');
        for (let i = 0; i < 6; i++) {
          const m = box(
            0.18,
            0.09,
            0.23,
            x - 0.72 + i * 0.29,
            0.25,
            z,
            '#53ca9d',
          );
          animated.push({ mesh: m, device, kind: 'rgb' });
        }
      } else if (['fan', 'motor', 'stepper'].includes(device.type)) {
        cylinder(0.7, 0.45, x, 0.34, z, '#394b49');
        const blade = box(1.35, 0.09, 0.25, x, 0.62, z, '#b4c6bd');
        const blade2 = box(0.25, 0.09, 1.35, x, 0.63, z, '#b4c6bd');
        animated.push(
          { mesh: blade, device, kind: 'motor' },
          { mesh: blade2, device, kind: 'motor' },
        );
        cylinder(0.2, 0.18, x, 0.7, z, '#e1e7d7');
      } else if (device.type === 'relay') {
        box(1.1, 0.65, 0.85, x, 0.4, z, '#367595');
        label('RELAY', x, 0.74, z, 0.16, '#d8eeeb', true);
        const indicator = box(0.16, 0.08, 0.16, x + 0.76, 0.22, z, '#d9b369');
        animated.push({ mesh: indicator, device, kind: 'relay' });
      } else if (device.type === 'ultrasonic') {
        cylinder(0.34, 0.4, x - 0.48, 0.33, z, '#acbabb');
        cylinder(0.34, 0.4, x + 0.48, 0.33, z, '#acbabb');
        cylinder(0.25, 0.02, x - 0.48, 0.54, z, '#314b4c');
        cylinder(0.25, 0.02, x + 0.48, 0.54, z, '#314b4c');
      } else if (device.type === 'sdcard') {
        box(1.3, 0.13, 1.1, x, 0.2, z, '#9aa8aa', 0.8);
        box(0.8, 0.06, 0.8, x, 0.29, z + 0.23, '#343e41');
        label('SD', x, 0.34, z + 0.23, 0.22, '#e8eadf', true);
      } else if (device.type === 'servo') {
        box(0.95, 0.65, 1, x, 0.41, z, '#2b537a');
        const arm = box(1.34, 0.08, 0.17, x, 0.83, z, '#e7e7d7');
        cylinder(0.17, 0.16, x, 0.81, z, '#d5d7c4');
        animated.push({ mesh: arm, device, kind: 'servo' });
      } else if (device.type === 'button' || device.type === 'pot') {
        box(0.92, 0.17, 0.92, x, 0.18, z, '#a6b8b2', 0.5);
        const knob = cylinder(
          0.29,
          0.27,
          x,
          0.4,
          z,
          device.type === 'pot' ? '#324a50' : '#303a3b',
        );
        animated.push({ mesh: knob, device, kind: device.type });
      } else if (device.type === 'buzzer' || device.type === 'i2s') {
        cylinder(0.4, 0.25, x, 0.26, z, '#303e3d');
        cylinder(0.12, 0.012, x, 0.4, z, '#122524');
      } else {
        box(0.71, 0.18, 0.61, x, 0.18, z, '#b1b6aa', 0.6);
        label(device.type.toUpperCase(), x, 0.29, z, 0.15, '#344b45', true);
      }
      def.terminals.forEach((t, j) => {
        const tx = x - 0.85 + j * (1.7 / Math.max(def.terminals.length - 1, 1)),
          tz = z + 0.86;
        const terminal = box(
          0.13,
          0.25,
          0.13,
          tx,
          0.2,
          tz,
          t.type === 'ground'
            ? '#526874'
            : t.type === 'power'
              ? '#d48a76'
              : '#c8aa5d',
          0.7,
        );
        terminal.userData = { device: device.id, terminal: t.name };
        pickables.push(terminal);
        const hit = box(0.25, 0.3, 0.28, tx, 0.2, tz, '#000');
        (hit.material as THREE.Material).visible = false;
        hit.userData = { device: device.id, terminal: t.name };
        pickables.push(hit);
        termPos.set(device.id + ':' + t.name, new THREE.Vector3(tx, 0.34, tz));
      });
      const members = root.children.slice(start);
      deviceObjects.set(device.id, members);
      if (props.arrange)
        members.forEach((o) => {
          o.userData = { ...o.userData, moveDevice: device.id, x, z };
          if (o instanceof THREE.Mesh && !pickables.includes(o))
            pickables.push(o);
        });
    });
    props.wires.forEach((w, i) => {
      const from = pinPos.get(w.pinId),
        to = termPos.get(w.deviceId + ':' + w.terminal);
      if (!from || !to) return;
      const elevation = 0.8 + (i % 5) * 0.1;
      curve(
        [
          from,
          new THREE.Vector3(from.x + 0.3, elevation, from.z),
          new THREE.Vector3(
            (from.x + to.x) / 2,
            elevation,
            from.z * 0.4 + to.z * 0.6,
          ),
          new THREE.Vector3(to.x, elevation, to.z),
          to,
        ],
        w.color,
        0.026,
      );
    });
    const pointer = new THREE.Vector2(),
      ray = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    let moving: {
      id: string;
      x: number;
      z: number;
      at: THREE.Vector3;
      dx: number;
      dz: number;
      objects: { o: THREE.Object3D; p: THREE.Vector3 }[];
    } | null = null;
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const cast = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
    };
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      if (!props.arrange) return;
      cast(e);
      const hit = ray.intersectObjects(pickables, false)[0];
      const data = hit?.object.userData;
      if (data?.moveDevice) {
        const at = ray.ray.intersectPlane(dragPlane, new THREE.Vector3());
        if (!at) return;
        controls.enabled = false;
        renderer.domElement.setPointerCapture(e.pointerId);
        moving = {
          id: data.moveDevice,
          x: data.x,
          z: data.z,
          at,
          dx: 0,
          dz: 0,
          objects: (deviceObjects.get(data.moveDevice) ?? []).map((o) => ({
            o,
            p: o.position.clone(),
          })),
        };
      }
    };
    const pointerUp = (e: PointerEvent) => {
      if (moving) {
        const m = moving;
        moving = null;
        controls.enabled = true;
        live.current.onMove?.(m.id, { x: m.x + m.dx, z: m.z + m.dz });
        return;
      }
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (hit) {
        if (hit.object.userData.pin)
          live.current.onPin(hit.object.userData.pin);
        else if (hit.object.userData.device)
          live.current.onTerminal(
            hit.object.userData.device,
            hit.object.userData.terminal,
          );
      }
    };
    const move = (e: PointerEvent) => {
      if (moving) {
        cast(e);
        const at = ray.ray.intersectPlane(dragPlane, new THREE.Vector3());
        if (at) {
          const x = Math.max(
              -20,
              Math.min(20, Math.round((moving.x + at.x - moving.at.x) * 2) / 2),
            ),
            z = Math.max(
              -20,
              Math.min(20, Math.round((moving.z + at.z - moving.at.z) * 2) / 2),
            );
          moving.dx = x - moving.x;
          moving.dz = z - moving.z;
          moving.objects.forEach(({ o, p }) =>
            o.position.set(p.x + moving!.dx, p.y, p.z + moving!.dz),
          );
        }
        return;
      }
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      renderer.domElement.style.cursor = ray.intersectObjects(pickables, false)
        .length
        ? 'pointer'
        : 'grab';
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    renderer.domElement.addEventListener('pointermove', move);
    const resize = new ResizeObserver(() => {
      const w = container.clientWidth,
        h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resize.observe(container);
    let raf = 0,
      last = 0;
    function animate(time: number) {
      raf = requestAnimationFrame(animate);
      if (time - last < 32) return;
      last = time;
      controls.update();
      for (const a of animated) {
        const d =
          live.current.devices.find((x) => x.id === a.device.id) ?? a.device;
        const mat = a.mesh.material as THREE.MeshStandardMaterial;
        const on = live.current.running;
        if (a.kind === 'led')
          mat.emissiveIntensity = on ? (d.value / 100) * 2.5 : 0;
        if (a.kind === 'rgb') {
          mat.color.setHSL(param(d, 'hue') / 360, 0.8, 0.55);
          mat.emissive.copy(mat.color);
          mat.emissiveIntensity = on ? (d.value / 100) * 2 : 0;
        }
        if (a.kind === 'motor' && on)
          a.mesh.rotation.y =
            (((time * 0.001 * d.value) / 100) * param(d, 'rpm')) / 60;
        if (a.kind === 'relay') {
          mat.emissive.set('#eea439');
          mat.emissiveIntensity = on ? d.value * 2 : 0;
        }
        if (a.kind === 'screen') {
          mat.emissive.set('#39a599');
          mat.emissiveIntensity = on ? 0.1 + (d.value / 100) * 0.6 : 0;
          if (a.ctx && a.texture) {
            const sensor = live.current.devices.find(
              (v) => v.type === 'bme280',
            );
            const text = on
              ? sensor
                ? sensor.value.toFixed(1) + ' C'
                : 'HELLO, ESPLAB'
              : 'READY';
            if (a.lastText !== text) {
              a.lastText = text;
              a.ctx.fillStyle = '#163b3a';
              a.ctx.fillRect(0, 0, 512, 256);
              a.ctx.fillStyle = '#bcead6';
              a.ctx.font = 'bold 28px monospace';
              a.ctx.textAlign = 'center';
              a.ctx.fillText('ESPLAB', 256, 55);
              a.ctx.font = 'bold 48px monospace';
              a.ctx.fillText(text, 256, 144);
              a.ctx.font = '22px monospace';
              a.ctx.fillText(on ? 'SIMULATED DATA' : 'RUN TO START', 256, 205);
              a.texture.needsUpdate = true;
            }
          }
        }
        if (a.kind === 'servo')
          a.mesh.rotation.y = on ? ((d.value - 90) * Math.PI) / 180 : 0;
        if (a.kind === 'button') a.mesh.position.y = d.value > 0.5 ? 0.31 : 0.4;
      }
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(animate);
    const lost = (e: Event) => {
      e.preventDefault();
      setError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      cameraSnapshot.current = {
        chip: props.chip.id,
        count: props.devices.length,
        position: camera.position.clone(),
        target: controls.target.clone(),
      };
      cancelAnimationFrame(raf);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        } else if (o instanceof THREE.Sprite) o.material.dispose();
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      cameraControl.current = null;
    };
  }, [
    props.chip,
    props.devices.map((d) => d.id).join(','),
    props.devices.map((d) => `${d.position?.x}:${d.position?.z}`).join(','),
    props.arrange,
    props.wires,
    props.selected,
    props.labels,
    props.exploded,
  ]);
  return (
    <div className="scene-wrap">
      <div className="scene" ref={host} />
      {error && (
        <div className="scene-error">
          <Layers3 size={30} />
          <strong>3D view needs WebGL</strong>
          <p>
            Your browser couldn’t start the 3D renderer. You can still inspect
            every pin and wire devices using the controls below.
          </p>
        </div>
      )}
      <div className="scene-caption">
        <span className="scene-dot" />
        {props.chip.reference
          ? 'REFERENCE ARCHITECTURE'
          : 'INTERACTIVE LEARNING CARRIER'}
        <small>Illustrative geometry · not a physical header map</small>
      </div>
      <div className="scene-controls">
        <Button
          variant="outline"
          size="icon"
          title="Reset camera"
          aria-label="Reset camera"
          onClick={() => cameraControl.current?.reset()}
        >
          <RotateCcw />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title="Top view"
          aria-label="Top view"
          onClick={() => cameraControl.current?.top()}
        >
          <Scan />
        </Button>
        <span />
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom in"
          onClick={() => cameraControl.current?.zoom(0.83)}
        >
          <ZoomIn />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom out"
          onClick={() => cameraControl.current?.zoom(1.2)}
        >
          <ZoomOut />
        </Button>
      </div>
      <div className="scene-help">
        {props.arrange
          ? 'Drag a device to move · half-unit snap · wires reconnect on release'
          : 'Drag to orbit · Scroll to zoom · Click a pin to inspect'}
      </div>
      <div className="axis">
        <span className="axis-y">Y</span>
        <span className="axis-z">Z</span>
        <span className="axis-x">X</span>
      </div>
    </div>
  );
}
