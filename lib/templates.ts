import type { LabState } from './lab-state';
import { chips } from './hardware';
import { autoWire, type DeviceType, type Wire } from './simulation';
import { newDevice, defaultSettings, type Settings } from './parameters';
export type Rule = {
  id: string;
  source: string;
  target: string;
  mode: 'above' | 'below' | 'map';
  threshold: number;
  output: number;
  otherwise: number;
  enabled: boolean;
};
export type Template = {
  id: string;
  name: string;
  category: string;
  level: string;
  chip: string;
  description: string;
  types: DeviceType[];
  steps: string[];
  source?: string;
  mappings?: Record<number, Record<string, number>>;
  settings?: Settings;
  rules?: {
    source: number;
    target: number;
    mode: Rule['mode'];
    threshold: number;
    output: number;
    otherwise: number;
  }[];
};
const recipe = (
  id: string,
  name: string,
  category: string,
  types: DeviceType[],
  description: string,
  steps: string[],
  extra: Partial<Template> = {},
): Template => ({
  id,
  name,
  category,
  types,
  description,
  steps,
  chip: 'ESP32-S3',
  level: types.length > 3 ? 'Intermediate' : 'Beginner',
  ...extra,
});
export const templates: Template[] = [
  recipe(
    'dimmer',
    'Analog light dimmer',
    'Lighting',
    ['pot', 'led'],
    'Map a potentiometer to LED brightness and inspect ADC quantization versus PWM duty.',
    [
      'Run the circuit.',
      'Sweep the potentiometer and watch the LED.',
      'Change ADC bits, PWM resolution and the series resistor.',
    ],
    {
      rules: [
        {
          source: 0,
          target: 1,
          mode: 'map',
          threshold: 0,
          output: 100,
          otherwise: 0,
        },
      ],
    },
  ),
  recipe(
    'nightlight',
    'Automatic night light',
    'Lighting',
    ['bh1750', 'neopixel'],
    'Turn on a configurable RGB strip when ambient light falls.',
    [
      'Lower illuminance below 100 lux.',
      'Adjust strip pixel count and hue.',
      'Observe external power demand at high brightness.',
    ],
    {
      rules: [
        {
          source: 0,
          target: 1,
          mode: 'below',
          threshold: 100,
          output: 75,
          otherwise: 0,
        },
      ],
    },
  ),
  recipe(
    'climate',
    'Climate station',
    'Environment',
    ['bme280', 'oled', 'rtc'],
    'Shared I²C temperature, display and timekeeping modules.',
    [
      'Inspect the shared SDA/SCL pair.',
      'Change temperature, humidity and pressure.',
      'Try a duplicate address and inspect the collision warning.',
    ],
  ),
  recipe(
    'greenhouse',
    'Greenhouse controller',
    'Environment',
    ['soil', 'sht31', 'relay', 'fan'],
    'Soil-driven watering and temperature-driven ventilation.',
    [
      'Lower soil moisture below 30%.',
      'Raise air temperature above 28 °C.',
      'Tune both automation thresholds.',
    ],
    {
      rules: [
        {
          source: 0,
          target: 2,
          mode: 'below',
          threshold: 30,
          output: 1,
          otherwise: 0,
        },
        {
          source: 1,
          target: 3,
          mode: 'above',
          threshold: 28,
          output: 80,
          otherwise: 0,
        },
      ],
    },
  ),
  recipe(
    'airquality',
    'Indoor air quality',
    'Environment',
    ['co2', 'sht31', 'fan', 'oled'],
    'Explore a CO₂ input driving a ventilation fan.',
    [
      'Raise CO₂ above 1000 ppm.',
      'Adjust the fan maximum rpm.',
      'These are synthetic learning values, not a safety monitoring system.',
    ],
    {
      rules: [
        {
          source: 0,
          target: 2,
          mode: 'above',
          threshold: 1000,
          output: 100,
          otherwise: 20,
        },
      ],
    },
  ),
  recipe(
    'parking',
    'Parking distance aid',
    'Motion',
    ['ultrasonic', 'buzzer', 'led'],
    'Distance threshold with a conditioned 5 V echo signal.',
    [
      'Move the virtual object below 30 cm.',
      'Compare echo pulse length at different air temperatures.',
      'Trace the level-conditioned ECHO input.',
    ],
    {
      rules: [
        {
          source: 0,
          target: 1,
          mode: 'below',
          threshold: 30,
          output: 1200,
          otherwise: 0,
        },
        {
          source: 0,
          target: 2,
          mode: 'below',
          threshold: 30,
          output: 100,
          otherwise: 0,
        },
      ],
    },
  ),
  recipe(
    'motionlight',
    'Motion-controlled lighting',
    'Motion',
    ['pir', 'relay', 'led'],
    'Use a digital motion input to switch two outputs.',
    [
      'Set the PIR input to 1.',
      'Inspect relay isolation and common signal ground.',
      'Change the rule output levels.',
    ],
    {
      rules: [
        {
          source: 0,
          target: 1,
          mode: 'above',
          threshold: 0.5,
          output: 1,
          otherwise: 0,
        },
        {
          source: 0,
          target: 2,
          mode: 'above',
          threshold: 0.5,
          output: 100,
          otherwise: 0,
        },
      ],
    },
  ),
  recipe(
    'servo',
    'Joystick servo',
    'Motion',
    ['joystick', 'servo'],
    'A scalar joystick teaching input mapped to servo position.',
    [
      'Sweep the joystick value.',
      'Tune the minimum and maximum servo pulses.',
      'Inspect the separate external supply.',
    ],
    {
      rules: [
        {
          source: 0,
          target: 1,
          mode: 'map',
          threshold: 0,
          output: 180,
          otherwise: 0,
        },
      ],
    },
  ),
  recipe(
    'motor',
    'Motor bench',
    'Motion',
    ['pot', 'motor', 'encoder'],
    'A motor-driver command with a separate encoder input.',
    [
      'Map the potentiometer into motor drive.',
      'Change the motor rpm estimate.',
      'The encoder input is manually controlled; closed-loop mechanics are not emulated.',
    ],
    {
      rules: [
        {
          source: 0,
          target: 1,
          mode: 'map',
          threshold: 0,
          output: 100,
          otherwise: 0,
        },
      ],
    },
  ),
  recipe(
    'stepper',
    'Stepper positioning bench',
    'Motion',
    ['stepper', 'reed', 'button'],
    'Inspect STEP/DIR/ENABLE and a limit switch.',
    [
      'Inspect the three driver control lines.',
      'Change drive and maximum rpm.',
      'Toggle the reed input to stop the output using a rule.',
    ],
    {
      rules: [
        {
          source: 1,
          target: 0,
          mode: 'above',
          threshold: 0.5,
          output: 0,
          otherwise: 60,
        },
      ],
    },
  ),
  recipe(
    'logger',
    'Environmental data logger',
    'Storage',
    ['bmp280', 'sdcard', 'rtc'],
    'Combine an I²C sensor, clock and SPI storage.',
    [
      'Inspect the two serial buses.',
      'Change virtual SD capacity and buffer fill.',
      'Compare SPI payload ceiling with sampling interval.',
    ],
  ),
  recipe(
    'eeprom',
    'I²C memory lab',
    'Storage',
    ['eeprom', 'oled'],
    'Explore addressable storage and the difference between persistent storage and working RAM.',
    [
      'Change storage capacity and occupancy.',
      'Inspect I²C address and bus pull-ups.',
      'Device fill is a teaching input; no EEPROM protocol transactions are executed.',
    ],
  ),
  recipe(
    'power',
    'Power monitor',
    'Instrumentation',
    ['ina219', 'ads1115', 'oled'],
    'Current measurement, external ADC and display on a shared bus.',
    [
      'Sweep measured load current and ADC voltage.',
      'Compare modeled board current with the independently measured load.',
      'Stress bus capacitance and inspect rise-time warnings.',
    ],
  ),
  recipe(
    'audio',
    'Digital audio bench',
    'Audio',
    ['i2s', 'max98357'],
    'Microphone input plus a class-D I²S amplifier output.',
    [
      'Inspect separate input/output data paths.',
      'Sweep sample rate, sample width and channel count.',
      'Increase DMA buffering to inspect SRAM usage.',
    ],
    { settings: { width: 0, sampleRate: 48000, channels: 2, audioBits: 16 } },
  ),
  recipe(
    'gps',
    'GPS telemetry node',
    'Connectivity',
    ['gps', 'oled', 'button'],
    'Crossed UART serial lines with an I²C status display.',
    [
      'Trace TX to RX and the common ground.',
      'Change UART baud to see the 8N1 payload ceiling.',
      'Link activity is synthetic; satellite acquisition is not simulated.',
    ],
  ),
  recipe(
    'rs485',
    'RS-485 field node',
    'Connectivity',
    ['rs485', 'ds18b20', 'relay'],
    'Explore UART direction control and a single-wire temperature input.',
    [
      'Inspect DI, RO and driver-enable pins.',
      'Raise temperature above 35 °C to switch the relay.',
      'A/B termination and biasing are represented by the described module.',
    ],
    {
      rules: [
        {
          source: 1,
          target: 2,
          mode: 'above',
          threshold: 35,
          output: 1,
          otherwise: 0,
        },
      ],
    },
  ),
  recipe(
    'can',
    'CAN interface bench',
    'Connectivity',
    ['can', 'pot', 'oled'],
    'Learn the controller-to-transceiver boundary and bus roles.',
    [
      'Inspect controller TX/RX versus external CANH/CANL.',
      'Adjust the synthetic input.',
      'This template teaches wiring; CAN arbitration and frames are not emulated.',
    ],
  ),
  recipe(
    'access',
    'RFID access hardware',
    'Connectivity',
    ['rfid', 'servo', 'buzzer'],
    'Explore an SPI reader with actuator and sound outputs.',
    [
      'Follow MOSI/MISO/SCLK and chip select.',
      'Change the reader activity input above 50% to open the servo.',
      'Activity is a stand-in for an authorized event; no RFID authentication is implemented.',
    ],
    {
      rules: [
        {
          source: 0,
          target: 1,
          mode: 'above',
          threshold: 50,
          output: 90,
          otherwise: 0,
        },
      ],
    },
  ),
  recipe(
    'epaper',
    'Low-refresh information display',
    'Displays',
    ['epaper', 'bme280', 'button'],
    'An e-paper interface with BUSY feedback and separate environmental sensing.',
    [
      'Inspect CS, DC and BUSY roles.',
      'Compare frame depth and memory allocation.',
      'The panel rendering is a teaching surface, not a controller waveform emulator.',
    ],
    { settings: { width: 296, height: 128, bpp: 1, buffers: 1 } },
  ),
  recipe(
    'address-collision',
    'Find the I²C collision',
    'Challenges',
    ['bmp280', 'bme280'],
    'Both sensors start at address 0x76. Resolve the deliberate collision before running.',
    [
      'Run validation and read the error.',
      'Set one sensor address to decimal 119 (0x77), if supported by its real SDO wiring.',
      'Validate again and run.',
    ],
  ),
  recipe(
    'ram-pressure',
    'Find the memory bottleneck',
    'Challenges',
    ['spi', 'i2s', 'sdcard'],
    'Large framebuffers and audio compete for memory on a chip without PSRAM.',
    [
      'Inspect internal SRAM overflow.',
      'Reduce framebuffer dimensions or buffer count.',
      'Compare with an S3 profile that supports PSRAM.',
    ],
    {
      chip: 'ESP32-C3',
      settings: {
        width: 640,
        height: 480,
        bpp: 16,
        buffers: 2,
        psram: 0,
        audioMs: 100,
      },
    },
  ),
];
export function buildTemplate(id: string): LabState {
  const t = templates.find((t) => t.id === id);
  if (!t) throw Error('Unknown template.');
  const chip = chips.find((c) => c.id === t.chip)!;
  const devices = t.types.map((type, i) =>
    newDevice(type, `template-${i}-${type}`),
  );
  const exact: Wire[] = [];
  for (const [index, map] of Object.entries(t.mappings ?? {}))
    for (const [terminal, gpio] of Object.entries(map))
      exact.push({
        id: `preset-${index}-${terminal}`,
        deviceId: devices[Number(index)].id,
        terminal,
        pinId: `GPIO${gpio}`,
        color: '#448ea2',
      });
  const wires = autoWire(chip, devices, exact);
  const rules: Rule[] = (t.rules ?? []).map((r, i) => ({
    ...r,
    id: `rule-${i}`,
    source: devices[r.source].id,
    target: devices[r.target].id,
    enabled: true,
  }));
  return {
    chip: chip.id,
    devices,
    wires,
    rules,
    settings: {
      ...defaultSettings,
      cpu: chip.mhz,
      psram: chip.psram ? 8 : 0,
      ...t.settings,
    },
    template: id,
    running: false,
  };
}
