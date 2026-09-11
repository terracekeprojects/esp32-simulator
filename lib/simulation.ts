import type { Chip, Pin } from './hardware';
import { extraDevices } from './extra-devices';
export type DeviceType =
  | 'led'
  | 'button'
  | 'pot'
  | 'oled'
  | 'bme280'
  | 'servo'
  | 'buzzer'
  | 'spi'
  | 'uart'
  | 'i2s'
  | 'rgb'
  | 'neopixel'
  | 'relay'
  | 'fan'
  | 'motor'
  | 'stepper'
  | 'bmp280'
  | 'sht31'
  | 'bh1750'
  | 'ds18b20'
  | 'dht22'
  | 'co2'
  | 'mq135'
  | 'uv'
  | 'soil'
  | 'ldr'
  | 'pir'
  | 'ultrasonic'
  | 'imu'
  | 'encoder'
  | 'joystick'
  | 'reed'
  | 'lcd1602'
  | 'epaper'
  | 'gt911'
  | 'p4panel'
  | 'uda1334'
  | 'max98357'
  | 'sdcard'
  | 'eeprom'
  | 'rtc'
  | 'ads1115'
  | 'ina219'
  | 'gps'
  | 'rfid'
  | 'can'
  | 'rs485'
  | 'displaylink';
export type Terminal = {
  name: string;
  type:
    | 'power'
    | 'ground'
    | 'out'
    | 'in'
    | 'adc'
    | 'i2c'
    | 'spi'
    | 'uart'
    | 'i2s';
  rail?: '3V3' | '5V';
};
export type DeviceDefinition = {
  id: DeviceType;
  name: string;
  subtitle: string;
  protocol: string;
  color: string;
  terminals: Terminal[];
  description: string;
  memory: number;
  category?: string;
  address?: number;
};
const g: Terminal = { name: 'GND', type: 'ground' },
  v: Terminal = { name: 'VCC', type: 'power', rail: '3V3' };
export const deviceLibrary: DeviceDefinition[] = [
  {
    id: 'led',
    name: 'LED + resistor',
    subtitle: 'Your first output',
    protocol: 'GPIO / PWM',
    color: '#dc9860',
    terminals: [{ name: 'A · 330Ω', type: 'out' }, g],
    description:
      'A red LED with a built-in 330 Ω series resistor. PWM switches it rapidly; duty cycle changes average brightness. With a 2 V LED drop, a HIGH output gives roughly (3.3 − 2) / 330 = 3.9 mA.',
    memory: 1,
  },
  {
    id: 'button',
    name: 'Push button',
    subtitle: 'Read a digital input',
    protocol: 'GPIO INPUT',
    color: '#6f89af',
    terminals: [{ name: 'SIGNAL', type: 'in' }, g],
    description:
      'An active-low button with a modeled external 10 kΩ pull-up to 3.3 V. Released reads HIGH; pressed connects the input to ground. Real buttons need debounce.',
    memory: 1,
  },
  {
    id: 'pot',
    name: 'Potentiometer',
    subtitle: 'Explore analog input',
    protocol: 'ADC',
    color: '#9b83b0',
    terminals: [v, { name: 'WIPER', type: 'adc' }, g],
    description:
      'A 10 kΩ potentiometer divides 3.3 V. Its wiper voltage is sampled by an ADC-capable pin. The lab uses an ideal 12-bit 0–3.3 V mapping; real ESP32 ADCs need attenuation, calibration, and headroom.',
    memory: 2,
  },
  {
    id: 'oled',
    name: 'OLED display',
    subtitle: '128 × 64 pixels',
    protocol: 'I²C · 0x3C',
    color: '#478f83',
    terminals: [
      v,
      g,
      { name: 'SDA', type: 'i2c' },
      { name: 'SCL', type: 'i2c' },
    ],
    description:
      'A modeled SSD1306-style I²C display. SDA carries data and SCL carries the clock. Includes virtual 4.7 kΩ pull-ups to 3.3 V. A monochrome 128×64 framebuffer uses 1,024 bytes.',
    memory: 2,
  },
  {
    id: 'bme280',
    name: 'BME280 sensor',
    subtitle: 'Temperature & humidity',
    protocol: 'I²C · 0x76',
    color: '#63a690',
    terminals: [
      v,
      g,
      { name: 'SDA', type: 'i2c' },
      { name: 'SCL', type: 'i2c' },
    ],
    description:
      'A modeled 3.3 V BME280 breakout with pull-ups, configured for I²C address 0x76. It can share SDA and SCL with the OLED because their addresses differ. Change the environment input to see virtual readings.',
    memory: 3,
  },
  {
    id: 'servo',
    name: 'Micro servo',
    subtitle: 'Position an actuator',
    protocol: 'PWM · 50 Hz',
    color: '#7d91b2',
    terminals: [
      { name: 'EXT 5V', type: 'power', rail: '5V' },
      g,
      { name: 'PWM', type: 'out' },
    ],
    description:
      'A teaching servo with a dedicated external 5 V supply, common ground, and 3.3 V-compatible control input. Pulse width sets angle. Real servo pulse limits and supply current must be checked; do not power a motor from a GPIO.',
    memory: 2,
  },
  {
    id: 'buzzer',
    name: 'Piezo buzzer',
    subtitle: 'Hear a digital signal',
    protocol: 'PWM · TONE',
    color: '#b28a65',
    terminals: [{ name: 'SIGNAL', type: 'out' }, g],
    description:
      'A passive piezo teaching model driven with a square wave. Frequency controls pitch. The lab animates the signal without playing audio. High-current buzzers need a transistor driver.',
    memory: 1,
  },
  {
    id: 'spi',
    name: 'SPI display',
    subtitle: 'Clocked serial transfers',
    protocol: 'SPI',
    color: '#5b8f99',
    terminals: [
      v,
      g,
      { name: 'MOSI', type: 'spi' },
      { name: 'SCLK', type: 'spi' },
      { name: 'CS', type: 'spi' },
      { name: 'DC', type: 'out' },
    ],
    description:
      'A write-only teaching display with reset tied high and virtual initialization. MOSI sends pixels, SCLK times bits, CS selects the device, and DC distinguishes data from commands. Real hardware needs controller-specific setup.',
    memory: 20,
  },
  {
    id: 'uart',
    name: 'UART sensor',
    subtitle: 'Asynchronous serial data',
    protocol: 'UART · 115200',
    color: '#ab9472',
    terminals: [
      v,
      g,
      { name: 'TX → RX', type: 'in' },
      { name: 'RX ← TX', type: 'uart' },
    ],
    description:
      'A 3.3 V UART loopback-style sensor. Cross TX to RX and RX to TX; share ground. Both devices need the same baud rate and frame format. RS-232 voltage levels are not directly compatible.',
    memory: 4,
  },
  {
    id: 'i2s',
    name: 'I²S microphone',
    subtitle: 'Digital audio samples',
    protocol: 'I²S',
    color: '#7c88aa',
    terminals: [
      v,
      g,
      { name: 'BCLK', type: 'i2s' },
      { name: 'WS', type: 'i2s' },
      { name: 'SD', type: 'in' },
    ],
    description:
      'A virtual digital microphone: BCLK clocks bits, WS selects the audio word/channel, and SD carries samples into the ESP32. A 16 kHz mono 16-bit stream needs 32,000 bytes per second before framing overhead.',
    memory: 32,
  },
  ...extraDevices,
];
export type Device = {
  id: string;
  type: DeviceType;
  value: number;
  params?: Record<string, number>;
  position?: { x: number; z: number };
};
export type Wire = {
  id: string;
  deviceId: string;
  terminal: string;
  pinId: string;
  color: string;
};
export const wireColors = [
  '#df9b41',
  '#448ea2',
  '#a58ac0',
  '#64a487',
  '#db7870',
  '#7184ba',
];
export const definition = (d: Device) =>
  deviceLibrary.find((v) => v.id === d.type)!;
export function compatible(p: Pin, t: Terminal) {
  if (p.reserved || p.kind === 'control') return false;
  if (t.type === 'ground') return p.kind === 'ground';
  if (t.type === 'power') return p.id === t.rail;
  if (p.kind !== 'gpio') return false;
  if (t.type === 'adc') return !!p.adc;
  if (t.type === 'in') return true;
  return !p.inputOnly;
}
export function validate(
  chip: Chip,
  devices: Device[],
  wires: Wire[],
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [],
    warnings: string[] = [];
  for (const d of devices) {
    const def = definition(d);
    for (const t of def.terminals) {
      const w = wires.find((v) => v.deviceId === d.id && v.terminal === t.name);
      if (!w) {
        errors.push(`${def.name}: connect ${t.name}.`);
        continue;
      }
      const p = chip.pins.find((v) => v.id === w.pinId);
      if (!p || !compatible(p, t))
        errors.push(`${def.name}: ${t.name} cannot use ${w.pinId}.`);
      else {
        if (p.warning)
          warnings.push(`${p.id}: boot strapping pin; verify reset level.`);
        if (p.usb) warnings.push(`${p.id}: also used by native USB.`);
      }
    }
  }
  for (const p of chip.pins.filter((v) => v.kind === 'gpio')) {
    const ws = wires.filter((w) => w.pinId === p.id);
    if (ws.length > 1) {
      const roles = ws.map((w) => {
        const d = devices.find((x) => x.id === w.deviceId);
        return d
          ? {
              type: d.type,
              terminal: definition(d).terminals.find(
                (t) => t.name === w.terminal,
              ),
            }
          : null;
      });
      const i2c =
        roles.every((r) => r?.terminal?.type === 'i2c') &&
        new Set(ws.map((w) => w.terminal)).size === 1;
      if (!i2c)
        errors.push(`${p.id}: multiple signals conflict. Use separate GPIOs.`);
    }
  }
  const i2c = devices.filter((d) =>
    definition(d).terminals.some((t) => t.type === 'i2c'),
  );
  for (let i = 0; i < i2c.length; i++)
    for (let j = i + 1; j < i2c.length; j++) {
      const address = (d: Device) =>
        d.params?.address ??
        definition(d).address ??
        (d.type === 'oled' ? 60 : 118);
      if (address(i2c[i]) !== address(i2c[j])) continue;
      const a = wires.find(
          (w) => w.deviceId === i2c[i].id && w.terminal === 'SDA',
        ),
        b = wires.find((w) => w.deviceId === i2c[j].id && w.terminal === 'SDA');
      if (a && b && a.pinId === b.pinId)
        errors.push(
          'Two I²C devices have the same address on one bus. Change the address or use another bus.',
        );
    }
  if (
    chip.id === 'ESP32-C2' &&
    devices.some((d) => definition(d).terminals.some((t) => t.type === 'i2s'))
  )
    errors.push('ESP32-C2 has no I²S peripheral. Choose another family.');
  if (chip.id !== 'ESP32-P4' && devices.some((d) => d.type === 'p4panel'))
    errors.push('This dedicated MIPI DSI panel profile requires ESP32-P4.');
  if (chip.id === 'ESP32-E22' && devices.length)
    errors.push(
      'E22 is a host connectivity reference; general GPIO experiments are unavailable.',
    );
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
export function autoWire(
  chip: Chip,
  devices: Device[],
  existing: Wire[],
): Wire[] {
  const result = [...existing];
  let counter = 0;
  for (const d of devices)
    for (const t of definition(d).terminals) {
      if (result.some((w) => w.deviceId === d.id && w.terminal === t.name))
        continue;
      let p: Pin | undefined;
      if (t.type === 'i2c') {
        const shared = result.find(
          (w) =>
            w.terminal === t.name &&
            devices.some(
              (x) =>
                x.id === w.deviceId &&
                definition(x).terminals.some(
                  (t) => t.name === w.terminal && t.type === 'i2c',
                ),
            ),
        );
        if (shared) p = chip.pins.find((x) => x.id === shared.pinId);
      }
      if (!p)
        p = chip.pins.find(
          (p) =>
            compatible(p, t) &&
            !p.warning &&
            !p.usb &&
            (p.kind !== 'gpio' || !result.some((w) => w.pinId === p.id)),
        );
      if (p)
        result.push({
          id: `auto-${d.id}-${counter++}`,
          deviceId: d.id,
          terminal: t.name,
          pinId: p.id,
          color:
            t.type === 'ground'
              ? '#68777c'
              : t.type === 'power'
                ? '#d57669'
                : wireColors[result.length % wireColors.length],
        });
    }
  return result;
}
export function memoryBudget(
  chip: Chip,
  devices: Device[],
  wifi: boolean,
  frame: boolean,
  psram: number,
  extra: number,
) {
  const system = 96,
    radio = wifi && chip.wifi !== 'None' ? 72 : 0,
    drivers = devices.reduce((a, d) => a + definition(d).memory, 0),
    frameKB = frame ? 150 : 0;
  const external = psram > 0 ? frameKB + extra : 0;
  const internal = system + radio + drivers + (psram > 0 ? 0 : frameKB + extra);
  return {
    system,
    radio,
    drivers,
    frameKB,
    external,
    internal,
    free: Math.max(0, chip.sram - internal),
    overflow: internal > chip.sram || external > psram * 1024,
  };
}
export function generateCode(
  chip: Chip,
  devices: Device[],
  wires: Wire[],
): string {
  const line = (d: Device, t: string) => {
    const id = wires.find(
      (w) => w.deviceId === d.id && w.terminal === t,
    )?.pinId;
    return id?.startsWith('GPIO') ? id.slice(4) : '/* assign GPIO */ -1';
  };
  return `// ESP-IDF C starter — ${chip.name}\n// Generated from your wiring. Add app_main to an ESP-IDF project.\n// This browser does not compile or execute this C code.\n#include "driver/gpio.h"\n#include "freertos/FreeRTOS.h"\n#include "freertos/task.h"\n\nvoid app_main(void) {\n${devices
    .map((d, i) => {
      const def = definition(d);
      const sig = def.terminals.filter(
        (t) => !['power', 'ground'].includes(t.type),
      );
      return (
        `  // ${def.name}: ${def.protocol}\n${sig.map((t) => `  // ${t.name} -> GPIO ${line(d, t.name)}`).join('\n')}\n` +
        (d.type === 'led'
          ? `  gpio_reset_pin(${line(d, 'A · 330Ω')});\n  gpio_set_direction(${line(d, 'A · 330Ω')}, GPIO_MODE_OUTPUT);`
          : d.type === 'button'
            ? `  gpio_set_direction(${line(d, 'SIGNAL')}, GPIO_MODE_INPUT);\n  // External 10k pull-up to 3.3 V; add debounce.\n  int button_${i} = gpio_get_level(${line(d, 'SIGNAL')});\n  (void)button_${i};`
            : `  // TODO: configure ${def.protocol} driver and device-specific initialization.\n  // This peripheral is represented as a teaching model in ESPLAB.`)
      );
    })
    .join('\n\n')}\n\n  while (1) {\n${devices
    .filter((d) => d.type === 'led')
    .map((d) => `    gpio_set_level(${line(d, 'A · 330Ω')}, 1);`)
    .join('\n')}\n    vTaskDelay(pdMS_TO_TICKS(500));\n${devices
    .filter((d) => d.type === 'led')
    .map((d) => `    gpio_set_level(${line(d, 'A · 330Ω')}, 0);`)
    .join('\n')}\n    vTaskDelay(pdMS_TO_TICKS(500));\n  }\n}\n`;
}
