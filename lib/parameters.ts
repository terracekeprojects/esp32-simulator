import { definition, type Device, type DeviceType } from './simulation';
import type { Chip } from './hardware';

export type Knob = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
  help: string;
  group?: string;
};
const k = (
  key: string,
  label: string,
  min: number,
  max: number,
  value: number,
  unit: string,
  help: string,
  step = 1,
  group?: string,
): Knob => ({ key, label, min, max, value, unit, help, step, group });
export const settingsSpec: Knob[] = [
  k(
    'speed',
    'Simulation speed',
    0.25,
    4,
    1,
    '×',
    'Changes the virtual clock and automation update rate.',
    0.25,
    'Runtime',
  ),
  k(
    'cpu',
    'CPU clock',
    40,
    400,
    160,
    'MHz',
    'A workload estimate; the selected chip limits the usable frequency.',
    1,
    'Runtime',
  ),
  k(
    'cycles',
    'Work per sample',
    1000,
    1000000,
    50000,
    'cycles',
    'Estimated CPU work for each acquisition.',
    1000,
    'Runtime',
  ),
  k(
    'sampleMs',
    'Acquisition interval',
    10,
    2000,
    100,
    'ms',
    'Controls estimated CPU load and response latency.',
    10,
    'Runtime',
  ),
  k(
    'voltage',
    'Regulated supply',
    2.7,
    3.6,
    3.3,
    'V',
    'Teaching supply sweep. Consult the module limits before using real hardware.',
    0.05,
    'Power',
  ),
  k(
    'budget',
    '3.3 V regulator budget',
    100,
    1500,
    500,
    'mA',
    'Compared with estimated board and low-voltage peripheral current.',
    10,
    'Power',
  ),
  k(
    'resistance',
    'Supply wire resistance',
    0,
    5,
    0.1,
    'Ω',
    'Round-trip resistance. Voltage drop equals current × resistance.',
    0.05,
    'Power',
  ),
  k(
    'pullup',
    'I²C pull-up resistance',
    1000,
    10000,
    4700,
    'Ω',
    'Equivalent pull-up resistance, including parallel breakout resistors.',
    100,
    'Buses',
  ),
  k(
    'capacitance',
    'I²C bus capacitance',
    20,
    600,
    100,
    'pF',
    'Estimated rise time = 0.8473 × R × C.',
    10,
    'Buses',
  ),
  k(
    'i2c',
    'I²C clock',
    100,
    400,
    400,
    'kHz',
    'Standard/Fast-mode teaching model; >100 kHz uses the 300 ns rise-time target.',
    100,
    'Buses',
  ),
  k(
    'spi',
    'SPI clock',
    1,
    80,
    20,
    'MHz',
    'Ideal raw transfer ceiling before protocol, wiring and controller overhead.',
    1,
    'Buses',
  ),
  k(
    'baud',
    'UART baud',
    9600,
    921600,
    115200,
    'baud',
    '8N1 serial payload estimate uses 10 wire bits per byte.',
    9600,
    'Buses',
  ),
  k(
    'adcBits',
    'ADC resolution model',
    8,
    13,
    12,
    'bits',
    'Ideal quantizer only; actual supported ADC widths vary by chip.',
    1,
    'Signals',
  ),
  k(
    'adcRange',
    'ADC full-scale model',
    1,
    3.3,
    3.3,
    'V',
    'An illustrative calibrated full scale, not an attenuation-register setting.',
    0.1,
    'Signals',
  ),
  k(
    'noise',
    'ADC input noise',
    0,
    100,
    2,
    'mV',
    'Adds deterministic sample noise to the ADC teaching readout.',
    1,
    'Signals',
  ),
  k(
    'pwm',
    'PWM clock',
    50,
    30000,
    5000,
    'Hz',
    'Changes displayed pulse period; real timer frequency and resolution are coupled.',
    50,
    'Signals',
  ),
  k(
    'pwmBits',
    'PWM resolution model',
    4,
    16,
    8,
    'bits',
    'Duty steps = 2^bits − 1. Timer feasibility is flagged separately.',
    1,
    'Signals',
  ),
  k(
    'tasks',
    'Application tasks',
    1,
    16,
    4,
    'tasks',
    'Each task consumes the configured stack allocation.',
    1,
    'Memory',
  ),
  k(
    'stack',
    'Stack per task',
    1,
    32,
    4,
    'KiB',
    'Reserved internal SRAM for task stacks.',
    1,
    'Memory',
  ),
  k(
    'heap',
    'Application heap',
    0,
    512,
    24,
    'KiB',
    'Extra internal allocations beyond system, drivers and stacks.',
    4,
    'Memory',
  ),
  k(
    'psram',
    'External PSRAM installed',
    0,
    32,
    8,
    'MiB',
    'Used for framebuffers only if the chip supports external RAM.',
    1,
    'Memory',
  ),
  k(
    'width',
    'Framebuffer width',
    0,
    1920,
    320,
    'px',
    'Set either dimension to zero to disable this memory workload.',
    1,
    'Memory',
  ),
  k(
    'height',
    'Framebuffer height',
    0,
    1080,
    240,
    'px',
    'Frame bytes = width × height × bits/pixel ÷ 8 × buffers.',
    1,
    'Memory',
  ),
  k(
    'bpp',
    'Framebuffer depth',
    1,
    32,
    16,
    'bits/px',
    'RGB565 uses 16 bits per pixel; monochrome uses 1.',
    1,
    'Memory',
  ),
  k(
    'buffers',
    'Framebuffers',
    1,
    3,
    1,
    'buffers',
    'Double buffering doubles the frame allocation.',
    1,
    'Memory',
  ),
  k(
    'sampleRate',
    'Audio sample rate',
    8000,
    96000,
    16000,
    'Hz',
    'PCM payload, DMA memory and bit-clock estimates.',
    1000,
    'Audio & network',
  ),
  k(
    'audioBits',
    'Audio sample width',
    16,
    32,
    16,
    'bits',
    'Packed payload estimate. Real I²S slots may be wider.',
    8,
    'Audio & network',
  ),
  k(
    'channels',
    'Audio channels',
    1,
    2,
    1,
    'channels',
    'Mono/stereo changes payload and buffering.',
    1,
    'Audio & network',
  ),
  k(
    'audioMs',
    'Internal audio buffer',
    0,
    500,
    40,
    'ms',
    'DMA teaching allocation in internal RAM.',
    10,
    'Audio & network',
  ),
  k(
    'latency',
    'Network latency',
    0,
    1000,
    40,
    'ms',
    'Adds to sample-to-response latency; no network packets are sent.',
    10,
    'Audio & network',
  ),
  k(
    'loss',
    'Packet loss',
    0,
    30,
    0,
    '%',
    'Reduces modeled useful audio payload; does not implement retransmission.',
    1,
    'Audio & network',
  ),
];
export type Settings = Record<string, number>;
export const defaultSettings: Settings = Object.fromEntries(
  settingsSpec.map((x) => [x.key, x.value]),
);
export const category = (d: DeviceType) =>
  definition({ id: '', type: d, value: 0 }).category ||
  (
    {
      led: 'Lighting',
      button: 'Inputs',
      pot: 'Inputs',
      oled: 'Displays',
      bme280: 'Environment',
      servo: 'Actuators',
      buzzer: 'Audio',
      spi: 'Displays',
      uart: 'Connectivity',
      i2s: 'Audio',
    } as Record<string, string>
  )[d] ||
  'Other';
export function valueSpec(type: DeviceType): Knob {
  const c = category(type);
  if (['bme280', 'bmp280', 'sht31', 'ds18b20', 'dht22'].includes(type))
    return k(
      'value',
      'Temperature',
      -20,
      85,
      24,
      '°C',
      'Synthetic environment input used by automation rules.',
      0.5,
    );
  if (type === 'servo')
    return k(
      'value',
      'Target angle',
      0,
      180,
      90,
      '°',
      'Commanded angle; pulse width is derived from endpoints.',
    );
  if (['button', 'pir', 'reed', 'relay'].includes(type))
    return k(
      'value',
      type === 'relay' ? 'Relay state' : 'Input state',
      0,
      1,
      0,
      '',
      '0 = inactive, 1 = active.',
    );
  if (type === 'buzzer')
    return k(
      'value',
      'Tone',
      0,
      4000,
      440,
      'Hz',
      'Virtual frequency. Zero silences the modeled output.',
      10,
    );
  if (type === 'co2')
    return k(
      'value',
      'CO₂ concentration',
      400,
      5000,
      600,
      'ppm',
      'Synthetic input, not a gas safety instrument.',
      10,
    );
  if (type === 'ultrasonic')
    return k(
      'value',
      'Object distance',
      2,
      400,
      80,
      'cm',
      'Echo pulse duration follows the modeled distance.',
    );
  if (['bh1750', 'ldr'].includes(type))
    return k(
      'value',
      'Illuminance',
      0,
      10000,
      350,
      'lux',
      'Synthetic light level.',
      10,
    );
  if (type === 'uv')
    return k(
      'value',
      'UV sensor voltage',
      0,
      3.3,
      0.4,
      'V',
      'Conditioned analog input, not a calibrated UV index.',
      0.01,
    );
  if (type === 'mq135')
    return k(
      'value',
      'Conditioned gas-sensor voltage',
      0,
      3.3,
      0.7,
      'V',
      'Voltage after a divider. No ppm conversion is claimed.',
      0.01,
    );
  if (type === 'ina219')
    return k(
      'value',
      'Measured load current',
      0,
      3000,
      120,
      'mA',
      'Virtual monitored load; separate from the board power estimate.',
      10,
    );
  if (type === 'ads1115')
    return k(
      'value',
      'Analog input',
      0,
      3.3,
      1.5,
      'V',
      'Synthetic input within this breakout’s 3.3 V supply.',
      0.01,
    );
  if (type === 'imu')
    return k('value', 'Tilt', -180, 180, 0, '°', 'Single-axis teaching input.');
  return k(
    'value',
    c === 'Displays'
      ? 'Brightness'
      : c === 'Audio'
        ? 'Level'
        : c === 'Actuators'
          ? 'Drive'
          : c === 'Storage'
            ? 'Buffer fill'
            : c === 'Connectivity'
              ? 'Link activity'
              : 'Input / output level',
    0,
    100,
    50,
    '%',
    'Synthetic scalar input or commanded output. Automation can update this value.',
  );
}
export function deviceKnobs(type: DeviceType): Knob[] {
  const def = definition({ id: '', type, value: 0 }),
    c = category(type);
  const result = [
    k(
      'current',
      'Active current estimate',
      0,
      2000,
      c === 'Actuators' ? 150 : c === 'Displays' ? 35 : 10,
      'mA',
      'Estimated device supply current; 5 V devices are reported separately.',
      1,
    ),
    k(
      'response',
      'Response time',
      0,
      2000,
      20,
      'ms',
      'Added to this device’s response latency estimate.',
      10,
    ),
  ];
  if (def.terminals.some((t) => t.type === 'i2c'))
    result.push(
      k(
        'address',
        'I²C address',
        8,
        119,
        def.address ?? (type === 'oled' ? 60 : 118),
        'decimal',
        'Use only addresses supported by the real part. Bus collisions are validated.',
      ),
    );
  if (['Environment', 'Motion', 'Instrumentation', 'Inputs'].includes(c))
    result.push(
      k(
        'gain',
        'Input gain',
        0.1,
        4,
        1,
        '×',
        'Applied before automation comparisons.',
        0.1,
      ),
      k(
        'offset',
        'Input offset',
        -50,
        50,
        0,
        '',
        'Applied after gain for calibration exercises.',
        0.5,
      ),
    );
  if (type === 'led')
    result.push(
      k(
        'resistor',
        'Series resistor',
        100,
        2200,
        330,
        'Ω',
        'Estimated LED current uses a 2 V forward drop.',
        10,
      ),
    );
  if (['neopixel', 'rgb'].includes(type))
    result.push(
      k(
        'pixels',
        'RGB pixel count',
        1,
        120,
        type === 'rgb' ? 1 : 16,
        'pixels',
        'RGB buffer uses 3 bytes/pixel; maximum white load is modeled as 60 mA/pixel.',
      ),
      k('hue', 'Hue', 0, 360, 160, '°', 'Changes the virtual light color.'),
    );
  if (type === 'servo')
    result.push(
      k(
        'pulseMin',
        'Minimum pulse',
        500,
        1500,
        1000,
        'µs',
        'Pulse at zero degrees.',
        10,
      ),
      k(
        'pulseMax',
        'Maximum pulse',
        1500,
        2500,
        2000,
        'µs',
        'Pulse at 180 degrees.',
        10,
      ),
    );
  if (type === 'fan')
    result.push(
      k(
        'rpm',
        'Maximum speed',
        500,
        6000,
        2400,
        'rpm',
        'Estimated speed follows drive percentage.',
        100,
      ),
    );
  if (type === 'motor' || type === 'stepper')
    result.push(
      k(
        'rpm',
        'Maximum speed',
        10,
        3000,
        300,
        'rpm',
        'Ideal unloaded speed proportional to drive percentage.',
        10,
      ),
    );
  if (type === 'bme280' || type === 'sht31' || type === 'dht22')
    result.push(
      k(
        'humidity',
        'Relative humidity',
        0,
        100,
        50,
        '%',
        'Additional independent environment reading.',
      ),
    );
  if (type === 'bme280' || type === 'bmp280')
    result.push(
      k(
        'pressure',
        'Pressure',
        800,
        1100,
        1013,
        'hPa',
        'Additional environment reading.',
      ),
    );
  if (type === 'ultrasonic')
    result.push(
      k(
        'temperature',
        'Air temperature',
        -10,
        50,
        20,
        '°C',
        'Sound speed ≈ 331 + 0.6 × temperature m/s.',
      ),
    );
  if (['sdcard', 'eeprom'].includes(type))
    result.push(
      k(
        'capacity',
        'Virtual capacity',
        4,
        32768,
        type === 'eeprom' ? 32 : 8192,
        'KiB',
        'Buffer-fill control reports bytes stored in this virtual capacity.',
        4,
      ),
    );
  if (type === 'relay')
    result.push(
      k(
        'activeLow',
        'Active-low input',
        0,
        1,
        0,
        '',
        '1 inverts the commanded logic level; the relay state keeps its meaning.',
      ),
    );
  if (type === 'motor')
    result.push(
      k(
        'direction',
        'Direction',
        -1,
        1,
        1,
        '',
        '−1 reverses direction, 0 coasts, +1 is forward.',
      ),
      k(
        'stall',
        'Stall current',
        100,
        5000,
        1000,
        'mA',
        'Worst-case external supply demand if the motor stalls.',
        100,
      ),
    );
  if (type === 'stepper')
    result.push(
      k(
        'steps',
        'Full steps per revolution',
        20,
        400,
        200,
        'steps',
        'Combined with microsteps to estimate required STEP frequency.',
      ),
      k(
        'microsteps',
        'Microstep multiplier',
        1,
        32,
        16,
        '×',
        'Illustrative ratio; physical drivers offer discrete supported settings.',
      ),
    );
  if (type === 'ds18b20')
    result.push(
      k(
        'resolution',
        'Conversion resolution',
        9,
        12,
        12,
        'bits',
        'Maximum conversion time doubles with each extra bit.',
      ),
    );
  if (type === 'soil')
    result.push(
      k(
        'dry',
        'Dry calibration',
        0,
        3.3,
        2.8,
        'V',
        'Modeled voltage at zero moisture.',
        0.01,
      ),
      k(
        'wet',
        'Wet calibration',
        0,
        3.3,
        1.2,
        'V',
        'Modeled voltage at full moisture.',
        0.01,
      ),
    );
  if (type === 'ldr')
    result.push(
      k(
        'fixedR',
        'Divider resistor',
        1000,
        100000,
        10000,
        'Ω',
        'Illustrative LDR resistance = 500,000 / max(lux,1) Ω.',
        1000,
      ),
    );
  if (type === 'joystick')
    result.push(
      k('axisY', 'Y axis', 0, 100, 50, '%', 'Independent second analog input.'),
      k(
        'deadzone',
        'Center dead zone',
        0,
        20,
        3,
        '%',
        'Values within this distance of 50% snap to center.',
      ),
      k('pressed', 'Push switch', 0, 1, 0, '', 'Active-low switch input.'),
    );
  if (type === 'encoder')
    result.push(
      k(
        'ppr',
        'Pulses per revolution',
        4,
        1024,
        24,
        'pulses',
        'The scalar position represents percent of one turn.',
      ),
    );
  if (type === 'imu')
    result.push(
      k(
        'acceleration',
        'Acceleration',
        -16,
        16,
        1,
        'g',
        'Independent synthetic acceleration input.',
        0.1,
      ),
    );
  if (type === 'lcd1602')
    result.push(
      k(
        'contrast',
        'Contrast',
        0,
        100,
        60,
        '%',
        'Ideal text-visibility estimate, separate from backlight brightness.',
      ),
    );
  if (type === 'gt911')
    result.push(
      k(
        'x',
        'Touch X',
        0,
        1023,
        512,
        'px',
        'Coordinate within the reference 1024×600 panel.',
      ),
      k(
        'y',
        'Touch Y',
        0,
        599,
        300,
        'px',
        'Coordinate within the reference panel.',
      ),
      k(
        'pressed',
        'Touch active',
        0,
        1,
        0,
        '',
        'An injected contact event, not capacitive sensing physics.',
      ),
    );
  if (type === 'rtc')
    result.push(
      k(
        'drift',
        'Clock drift',
        -20,
        20,
        2,
        'ppm',
        'Scenario value, not a DS3231 specification.',
        0.1,
      ),
      k(
        'hours',
        'Elapsed time',
        1,
        8760,
        24,
        'hours',
        'Estimated time error = hours × 3600 × ppm / 1,000,000.',
      ),
    );
  if (type === 'ads1115')
    result.push(
      k(
        'fullScale',
        'ADC full scale model',
        0.256,
        6.144,
        4.096,
        'V',
        'Illustrative positive full scale; hardware PGA supports discrete settings.',
        0.001,
      ),
    );
  if (type === 'ina219')
    result.push(
      k(
        'loadVoltage',
        'Monitored bus voltage',
        0,
        26,
        5,
        'V',
        'Independent load power = voltage × current.',
        0.1,
      ),
      k(
        'shunt',
        'Shunt resistor',
        0.01,
        1,
        0.1,
        'Ω',
        'Shunt voltage = measured current × resistance.',
        0.01,
      ),
    );
  if (type === 'eeprom')
    result.push(
      k('page', 'Page size', 8, 256, 32, 'B', 'Page-write payload estimate.'),
      k(
        'writeMs',
        'Write cycle',
        1,
        20,
        5,
        'ms',
        'Ideal page bytes per second before bus overhead.',
      ),
    );
  if (type === 'gps')
    result.push(
      k(
        'satellites',
        'Satellites',
        0,
        32,
        8,
        '',
        'Injected scenario; this model does not solve a position.',
      ),
      k('fix', 'Fix available', 0, 1, 1, '', 'Synthetic fix-status flag.'),
      k(
        'payload',
        'Message bytes',
        32,
        1000,
        150,
        'B',
        'UART transfer time for one modeled report.',
      ),
    );
  if (type === 'rfid')
    result.push(
      k(
        'present',
        'Tag present',
        0,
        1,
        0,
        '',
        'Injected tag event. No RF or credential validation occurs.',
      ),
    );
  if (type === 'can')
    result.push(
      k(
        'bitrate',
        'CAN bitrate model',
        10,
        1000,
        500,
        'kbit/s',
        'Classical CAN timing estimate.',
        10,
      ),
      k(
        'payload',
        'Payload length',
        0,
        8,
        8,
        'B',
        'Approximation includes 47 overhead bits, excluding stuffing.',
      ),
      k(
        'fps',
        'Frames per second',
        1,
        10000,
        100,
        'frames/s',
        'Controls the estimated bus utilization.',
      ),
    );
  if (type === 'rs485')
    result.push(
      k(
        'payload',
        'Transaction length',
        1,
        1024,
        32,
        'B',
        '8N1 transfer time before turnaround.',
      ),
      k(
        'turnaround',
        'Turnaround delay',
        0,
        100,
        2,
        'ms',
        'Added to the half-duplex transaction estimate.',
      ),
    );
  return result;
}
export const newDevice = (
  type: DeviceType,
  id = crypto.randomUUID(),
): Device => ({
  id,
  type,
  value: valueSpec(type).value,
  params: Object.fromEntries(deviceKnobs(type).map((k) => [k.key, k.value])),
});
export const param = (d: Device, key: string) =>
  d.params?.[key] ?? deviceKnobs(d.type).find((p) => p.key === key)?.value ?? 0;
export const sensed = (d: Device) =>
  d.value * (param(d, 'gain') || 1) + param(d, 'offset');
export function readout(d: Device, s: Settings, tick = 0): string {
  const v = d.value;
  if (d.type === 'relay')
    return `${v ? 'ENERGIZED' : 'RELEASED'} · GPIO ${(v ? 1 : 0) ^ (param(d, 'activeLow') ? 1 : 0) ? 'HIGH' : 'LOW'}`;
  if (d.type === 'stepper')
    return `${Math.round((param(d, 'rpm') * v) / 100)} rpm · ${(((param(d, 'rpm') * v) / 100 / 60) * param(d, 'steps') * param(d, 'microsteps')).toFixed(0)} STEP pulses/s`;
  if (d.type === 'motor')
    return `${Math.round(((param(d, 'rpm') * v) / 100) * param(d, 'direction'))} rpm · ${param(d, 'stall')} mA stall scenario`;
  if (d.type === 'ds18b20')
    return `${sensed(d).toFixed(2)} °C · ${(750 / 2 ** (12 - param(d, 'resolution'))).toFixed(2)} ms max conversion`;
  if (d.type === 'dht22')
    return `${sensed(d).toFixed(1)} °C · ${param(d, 'humidity')}% RH · ${s.sampleMs < 2000 ? 'sampling interval is below the 2 s teaching limit' : 'sample timing OK'}`;
  if (d.type === 'joystick') {
    const axis = (n: number) =>
      Math.abs(n - 50) <= param(d, 'deadzone') ? 50 : n;
    return `X ${((axis(v) / 100) * s.voltage).toFixed(2)} V · Y ${((axis(param(d, 'axisY')) / 100) * s.voltage).toFixed(2)} V · SW ${param(d, 'pressed') ? 'LOW' : 'HIGH'}`;
  }
  if (d.type === 'encoder')
    return `${(v * 3.6).toFixed(1)}° · ${Math.round((v / 100) * param(d, 'ppr'))} pulses/turn position`;
  if (d.type === 'imu')
    return `${sensed(d).toFixed(1)}° tilt · ${param(d, 'acceleration')} g · 0x${param(d, 'address').toString(16)}`;
  if (d.type === 'lcd1602')
    return `${v}% backlight · ${param(d, 'contrast')}% contrast · 32 text cells`;
  if (d.type === 'gt911')
    return `${param(d, 'pressed') ? 'TOUCH' : 'RELEASED'} · (${param(d, 'x')}, ${param(d, 'y')}) px`;
  if (d.type === 'rtc')
    return `${((param(d, 'hours') * 3600 * param(d, 'drift')) / 1e6).toFixed(3)} s drift after ${param(d, 'hours')} h`;
  if (d.type === 'ads1115')
    return `${v.toFixed(3)} V · signed ADC ${Math.min(32767, Math.round((v / param(d, 'fullScale')) * 32767))} / 32767`;
  if (d.type === 'ina219')
    return `${((v * param(d, 'loadVoltage')) / 1000).toFixed(3)} W load · ${(v * param(d, 'shunt')).toFixed(1)} mV shunt drop`;
  if (d.type === 'gps')
    return `${param(d, 'fix') ? 'FIX' : 'NO FIX'} · ${param(d, 'satellites')} satellites · ${(((param(d, 'payload') * 10) / s.baud) * 1000).toFixed(1)} ms/report`;
  if (d.type === 'rfid')
    return `${param(d, 'present') ? 'TAG PRESENT' : 'NO TAG'} · ${v}% synthetic activity`;
  if (d.type === 'can')
    return `${((((47 + param(d, 'payload') * 8) * param(d, 'fps')) / (param(d, 'bitrate') * 1000)) * 100).toFixed(1)}% bus utilization estimate`;
  if (d.type === 'rs485')
    return `${(((param(d, 'payload') * 10) / s.baud) * 1000 + param(d, 'turnaround')).toFixed(2)} ms/transaction`;
  if (d.type === 'eeprom')
    return `${((param(d, 'capacity') * v) / 100).toFixed(1)} KiB used · ${((param(d, 'page') / param(d, 'writeMs')) * 1000).toFixed(0)} B/s ideal page writes`;
  if (d.type === 'led')
    return `${(((Math.max(0, s.voltage - 2) / param(d, 'resistor')) * 1000 * v) / 100).toFixed(2)} mA average · ${v}% duty`;
  if (d.type === 'servo')
    return `${Math.round(param(d, 'pulseMin') + ((param(d, 'pulseMax') - param(d, 'pulseMin')) * v) / 180)} µs pulse · 20 ms period`;
  if (['fan', 'motor', 'stepper'].includes(d.type))
    return `${Math.round((param(d, 'rpm') * v) / 100)} rpm ideal · ${v}% drive`;
  if (d.type === 'ultrasonic')
    return `${Math.round((((v / 100) * 2) / (331 + 0.6 * param(d, 'temperature'))) * 1e6)} µs echo pulse`;
  if (['rgb', 'neopixel'].includes(d.type))
    return `${param(d, 'pixels') * 3} B RGB buffer · ${((param(d, 'pixels') * 60 * v) / 100).toFixed(0)} mA full-white estimate`;
  if (['sdcard', 'eeprom'].includes(d.type))
    return `${((param(d, 'capacity') * v) / 100).toFixed(1)} KiB used / ${param(d, 'capacity')} KiB`;
  if (definition(d).terminals.some((t) => t.type === 'adc')) {
    const volts =
      d.type === 'soil'
        ? param(d, 'dry') + ((param(d, 'wet') - param(d, 'dry')) * v) / 100
        : d.type === 'ldr'
          ? (s.voltage * param(d, 'fixedR')) /
            (param(d, 'fixedR') + 500000 / Math.max(1, v))
          : ['uv', 'mq135', 'ads1115'].includes(d.type)
            ? v
            : (v / 100) * s.voltage;
    const input = Math.max(
      0,
      Math.min(s.adcRange, volts + (Math.sin(tick * 1.73) * s.noise) / 1000),
    );
    return `${volts.toFixed(3)} V · ADC ${Math.round((input / s.adcRange) * (2 ** s.adcBits - 1))} / ${2 ** s.adcBits - 1}`;
  }
  if (['bme280', 'bmp280', 'sht31'].includes(d.type))
    return `${sensed(d).toFixed(1)} °C${param(d, 'humidity') ? ` · ${param(d, 'humidity')}% RH` : ''}${param(d, 'pressure') ? ` · ${param(d, 'pressure')} hPa` : ''} · 0x${param(d, 'address').toString(16)}`;
  if (definition(d).terminals.some((t) => t.type === 'i2c'))
    return `0x${param(d, 'address').toString(16).toUpperCase()} · ${s.i2c} kHz · calibrated ${sensed(d).toFixed(1)} ${valueSpec(d.type).unit}`;
  if (category(d.type) === 'Audio')
    return `${((s.sampleRate * s.audioBits * s.channels) / 8000).toFixed(1)} kB/s PCM · ${s.audioMs} ms DMA buffer`;
  return `${sensed(d).toFixed(1)} ${valueSpec(d.type).unit} · ${(s.sampleMs + param(d, 'response') + s.latency).toFixed(0)} ms modeled response`;
}
export function telemetry(chip: Chip, devices: Device[], s: Settings) {
  const cpu = Math.min(s.cpu, chip.mhz),
    cpuLoad = (s.cycles / (cpu * 1000 * s.sampleMs)) * 100;
  const external = devices.filter((d) =>
    definition(d).terminals.some((t) => t.rail === '5V'),
  );
  const amps = (d: Device) =>
    ['rgb', 'neopixel'].includes(d.type)
      ? param(d, 'current') + (param(d, 'pixels') * 60 * d.value) / 100
      : param(d, 'current');
  const current =
    45 +
    cpu * 0.18 +
    devices
      .filter((d) => !external.includes(d))
      .reduce((n, d) => n + amps(d), 0);
  const extCurrent = external.reduce((n, d) => n + amps(d), 0),
    voltage = s.voltage - (current / 1000) * s.resistance;
  const frame =
      Math.ceil(((s.width * s.height * s.bpp) / 8) * s.buffers) / 1024,
    audio =
      (((s.sampleRate * s.audioBits) / 8) * s.channels * s.audioMs) /
      1000 /
      1024;
  const internal =
    96 +
    s.tasks * s.stack +
    s.heap +
    devices.reduce(
      (n, d) =>
        n +
        definition(d).memory +
        (['rgb', 'neopixel'].includes(d.type)
          ? (param(d, 'pixels') * 3) / 1024
          : 0),
      0,
    ) +
    audio +
    (chip.psram && s.psram > 0 ? 0 : frame);
  const psram = chip.psram && s.psram > 0 ? frame : 0,
    rise = (0.8473 * s.pullup * s.capacitance) / 1000;
  const warnings: string[] = [];
  if (voltage < 3)
    warnings.push(
      'Estimated 3.3 V rail falls below 3.0 V. Review supply and wire loss.',
    );
  if (current > s.budget)
    warnings.push(
      'Estimated regulator load exceeds its configured current budget.',
    );
  if (internal > chip.sram)
    warnings.push(
      'Internal SRAM allocations exceed this chip’s total SRAM; real usable heap is smaller.',
    );
  if (psram > s.psram * 1024)
    warnings.push('Framebuffer exceeds installed PSRAM.');
  if (rise > (s.i2c > 100 ? 300 : 1000))
    warnings.push(
      'I²C rise time exceeds the selected mode’s teaching limit. Lower pull-ups, capacitance or clock.',
    );
  if (s.pwm * 2 ** s.pwmBits > 80000000)
    warnings.push(
      'PWM frequency × resolution exceeds an assumed 80 MHz timer source. Actual source varies by chip.',
    );
  if (cpuLoad > 100)
    warnings.push('Estimated acquisition workload exceeds one CPU core.');
  if (!chip.psram && s.psram > 0)
    warnings.push(
      'This family cannot use the requested external PSRAM; frames are allocated internally.',
    );
  return {
    cpu,
    cpuLoad,
    current,
    extCurrent,
    voltage,
    internal,
    psram,
    frame,
    audio,
    rise,
    uart: s.baud / 10,
    spi: (s.spi * 1e6) / 8,
    pcm: (s.sampleRate * s.audioBits * s.channels) / 8,
    goodput:
      ((s.sampleRate * s.audioBits * s.channels) / 8) * (1 - s.loss / 100),
    warnings,
  };
}
