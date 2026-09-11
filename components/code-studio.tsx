'use client';
import { useRef, useState } from 'react';
import { Button } from './ui/button';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Download,
  Check,
  Code2,
} from 'lucide-react';
import { compileProgram, programExamples, type Runtime } from '@/lib/program';
import type { LabState } from '@/lib/lab-state';
export function CodeStudio({
  state,
  source,
  onSource,
  onExample,
  onRun,
  onStep,
  onReset,
  runtime,
  logs,
  error,
  codeMode,
  firmware,
}: {
  state: LabState;
  source: string;
  onSource: (s: string) => void;
  onExample: (id: string) => void;
  onRun: () => void;
  onStep: () => void;
  onReset: () => void;
  runtime: Runtime;
  logs: string[];
  error: string;
  codeMode: boolean;
  firmware: string;
}) {
  const [message, setMessage] = useState(''),
    [mode, setMode] = useState('program');
  const upload = useRef<HTMLInputElement>(null);
  function download(name: string, text: string) {
    const a = document.createElement('a'),
      url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="code-studio">
      <div className="code-heading">
        <div>
          <span className="eyebrow">WRITE → RUN → OBSERVE</span>
          <h2>Code studio</h2>
          <p>
            Write Arduino-style teaching code, watch the devices respond, and
            inspect the serial output.
          </p>
        </div>
        <div>
          <Button
            variant={mode === 'program' ? 'default' : 'outline'}
            onClick={() => setMode('program')}
          >
            Simulator program
          </Button>
          <Button
            variant={mode === 'firmware' ? 'default' : 'outline'}
            onClick={() => setMode('firmware')}
          >
            ESP-IDF export
          </Button>
        </div>
      </div>
      {mode === 'firmware' ? (
        <>
          <p className="model-note">
            This is a generated C wiring starter. It must be compiled outside
            this browser with ESP-IDF. Device drivers and your program logic
            need to be implemented for the real hardware.
          </p>
          <Button
            variant="outline"
            onClick={() => download('main.c', firmware)}
          >
            <Download size={14} />
            Export main.c
          </Button>
          <pre className="firmware-source">{firmware}</pre>
        </>
      ) : (
        <>
          <div className="code-toolbar">
            <select
              aria-label="Load code example"
              value=""
              onChange={(e) => {
                onExample(e.target.value);
                setMessage('Example circuit and program loaded.');
              }}
            >
              <option value="">Load example + matching circuit…</option>
              {programExamples.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  compileProgram(source);
                  setMessage(
                    'Syntax is valid. Run or step to check wiring and device calls.',
                  );
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : 'Syntax error');
                }
              }}
            >
              <Check size={14} />
              Check syntax
            </Button>
            <Button onClick={onRun}>
              {state.running && codeMode ? (
                <Pause size={14} />
              ) : (
                <Play size={14} />
              )}{' '}
              {state.running && codeMode ? 'Pause' : 'Run code'}
            </Button>
            <Button variant="outline" disabled={state.running} onClick={onStep}>
              <SkipForward size={14} />
              Step loop
            </Button>
            <Button variant="ghost" onClick={onReset}>
              <RotateCcw size={14} />
              Reset runtime
            </Button>
          </div>
          <div className="code-layout">
            <div className="source-editor">
              <div>
                <span>program.ino · teaching subset</span>
                <span>{source.split('\n').length} lines</span>
              </div>
              <textarea
                aria-label="Simulator program source"
                spellCheck={false}
                value={source}
                maxLength={20000}
                onChange={(e) => onSource(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const t = e.currentTarget,
                      a = t.selectionStart,
                      b = t.selectionEnd;
                    onSource(source.slice(0, a) + '  ' + source.slice(b));
                    requestAnimationFrame(() => {
                      t.selectionStart = t.selectionEnd = a + 2;
                    });
                  }
                }}
              />
            </div>
            <aside className="runtime-inspector">
              <strong>Runtime variables</strong>
              <small>
                Virtual time: {runtime.ms} ms · next loop: {runtime.delay} ms
              </small>
              {Object.entries(runtime.vars).length ? (
                Object.entries(runtime.vars).map(([key, value]) => (
                  <div key={key}>
                    <code>{key}</code>
                    <span>{String(value)}</span>
                  </div>
                ))
              ) : (
                <p>Step or run a program to inspect variables.</p>
              )}
              <strong>Device handles</strong>
              {state.devices.map((d) => (
                <div key={d.id}>
                  <code>{d.type}</code>
                  <span>{d.value.toFixed(2)}</span>
                </div>
              ))}
              <small>
                Use an exact instance ID when two devices have the same type.
              </small>
            </aside>
          </div>
          {(error || message) && (
            <p role="status" className={error ? 'code-error' : 'code-message'}>
              {error || message}
            </p>
          )}
          <div className="serial-monitor">
            <div>
              <strong>Serial monitor</strong>
              <span>{logs.length} / 200 retained lines</span>
            </div>
            <pre aria-live="polite">
              {logs.length
                ? logs.join('\n')
                : 'Serial.println("Hello, ESPLAB");'}
            </pre>
          </div>
          <div className="code-toolbar">
            <Button
              variant="outline"
              onClick={() => download('program.ino', source)}
            >
              <Download size={14} />
              Export program
            </Button>
            <Button variant="outline" onClick={() => upload.current?.click()}>
              Import code
            </Button>
            <input
              ref={upload}
              type="file"
              accept=".ino,.txt,.c"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 20000) {
                  setMessage('File must be under 20 KB.');
                  return;
                }
                onSource(await file.text());
                e.target.value = '';
              }}
            />
            <small>
              Program source is included in circuit Save / Export JSON.
            </small>
          </div>
          <details className="code-reference">
            <summary>Language reference and execution limits</summary>
            <p>
              Supported: setup / loop, numeric or string variables, assignments,
              arithmetic, comparisons, if / else, and the functions below. Each
              loop sees the latest device inputs. Code replaces automation rules
              while it runs. Changes are atomic: a failed loop does not partly
              update the circuit.
            </p>
            <table>
              <tbody>
                {[
                  [
                    'read("pot")',
                    'Read a device value in its displayed units.',
                  ],
                  [
                    'write("led", 75)',
                    'Set a device value; clamped to its allowed range.',
                  ],
                  ['analogRead(4)', 'Ideal ADC code from a wired ADC pin.'],
                  [
                    'digitalRead(10)',
                    'Logical 0/1 from an input device state (not contact electrical polarity).',
                  ],
                  [
                    'digitalWrite(5, HIGH)',
                    'Set a wired digital output to its maximum/minimum value.',
                  ],
                  [
                    'analogWrite(5, 128)',
                    '8-bit duty command for a wired PWM-style output.',
                  ],
                  [
                    'Serial.println("Value: " + value)',
                    'Append a serial log line.',
                  ],
                  [
                    'millis() / delay(250)',
                    'Virtual clock and next-loop interval. Delay schedules the next loop; it does not suspend halfway through a loop.',
                  ],
                  ['map / constrain / min / max / abs', 'Numeric helpers.'],
                ].map(([name, help]) => (
                  <tr key={name}>
                    <td>
                      <code>{name}</code>
                    </td>
                    <td>{help}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              This parser never evaluates JavaScript or shell commands.
              Includes, external libraries, arrays, arbitrary functions,
              for/while loops, interrupts and binary firmware are unsupported.
              Expressions and statements have explicit size/depth/instruction
              limits. Use ESP-IDF or Arduino tools to build firmware for a
              physical board.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
