'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Play,
  Download,
  FlaskConical,
  Volume2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LabState } from '@/lib/lab-state';
import {
  runCircuitTests,
  voiceAction,
  wav16,
  type TestResult,
} from '@/lib/testing';
import { saveBlob } from './pipeline-player';

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        results: {
          length: number;
          [i: number]: {
            isFinal: boolean;
            [i: number]: { transcript: string; confidence: number };
          };
        };
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function TestingLab({
  state,
  onApply,
  onLoad,
}: {
  state: LabState;
  onApply: (id: string, value: number) => void;
  onLoad: (id: string) => void;
}) {
  const [section, setSection] = useState('voice'),
    [advanced, setAdvanced] = useState(false),
    [engine, setEngine] = useState('local'),
    [language, setLanguage] = useState('english');
  const [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState(
      'Ready. Record a short phrase or type a test command below.',
    );
  const [transcript, setTranscript] = useState(''),
    [chunks, setChunks] = useState<
      { text: string; timestamp: [number, number | null] }[]
    >([]),
    [results, setResults] = useState<TestResult[]>([]);
  const [gain, setGain] = useState(1),
    [threshold, setThreshold] = useState(0.008),
    [duration, setDuration] = useState(15),
    [echo, setEcho] = useState(true),
    [noise, setNoise] = useState(true),
    [inputId, setInputId] = useState('');
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]),
    [level, setLevel] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [stats, setStats] = useState<{
      duration: number;
      rate: number;
      rms: number;
      clipped: number;
    } | null>(null);
  const [audioURL, setAudioURL] = useState(''),
    [error, setError] = useState(''),
    [stage, setStage] = useState(0);
  const waveform = useRef<HTMLCanvasElement>(null),
    worker = useRef<Worker | null>(null),
    stream = useRef<MediaStream | null>(null),
    context = useRef<AudioContext | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    recognizer = useRef<Recognition | null>(null),
    raf = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    modelTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pcm = useRef<Float32Array | null>(null),
    alive = useRef(true),
    objectURL = useRef('');
  const action = voiceAction(transcript, state);
  const captureRequest = useRef(0);
  function clearCapture() {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    context.current?.close().catch(() => {});
    context.current = null;
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      recognizer.current?.abort();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      clearCapture();
      worker.current?.terminate();
      if (modelTimer.current) clearTimeout(modelTimer.current);
      if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    };
  }, []);
  function getWorker() {
    if (worker.current) return worker.current;
    const w = new Worker('/asr-worker.js', { type: 'module' });
    worker.current = w;
    w.onmessage = ({ data }) => {
      if (!alive.current || worker.current !== w) return;
      if (data.type === 'progress') {
        setStatus('Downloading local speech model · ' + data.message);
      } else if (data.type === 'ready') {
        setReady(true);
        setBusy(false);
        setStatus('Local Whisper is loaded. Record a phrase to transcribe.');
        if (modelTimer.current) clearTimeout(modelTimer.current);
      } else if (data.type === 'processing') {
        setReady(true);
        setStage(2);
        setStatus('Whisper is transcribing on this device…');
      } else if (data.type === 'result') {
        setBusy(false);
        setTranscript(data.text.trim());
        setChunks(data.chunks);
        setStage(3);
        setStatus(
          'Transcription complete. Review the words and any proposed device action.',
        );
        if (modelTimer.current) clearTimeout(modelTimer.current);
      } else if (data.type === 'error') {
        setBusy(false);
        setError(data.message);
        setStatus(
          'Transcription could not finish. Retry, use browser recognition, or type a test command.',
        );
        if (modelTimer.current) clearTimeout(modelTimer.current);
      }
    };
    w.onerror = () => {
      setBusy(false);
      setError(
        'The local speech worker could not load. Check your connection to the runtime/model hosts, then reset the model.',
      );
      if (modelTimer.current) clearTimeout(modelTimer.current);
    };
    return w;
  }
  function modelJob(data: unknown) {
    setBusy(true);
    setError('');
    try {
      getWorker().postMessage(data);
      if (modelTimer.current) clearTimeout(modelTimer.current);
      modelTimer.current = setTimeout(() => {
        worker.current?.terminate();
        worker.current = null;
        setBusy(false);
        setReady(false);
        setError(
          'Model loading or transcription timed out after 5 minutes. Retry on a faster connection/device.',
        );
      }, 300000);
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }
  function stop() {
    if (timer.current) clearTimeout(timer.current);
    recognizer.current?.stop();
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
    clearCapture();
  }
  async function processBlob(blob: Blob, local: boolean) {
    if (!alive.current) return;
    const job = ++captureRequest.current;
    if (local) {
      setTranscript('');
      setChunks([]);
    }
    setBusy(true);
    setStage(1);
    setStatus('Decoding and resampling captured audio…');
    try {
      const decoder = new OfflineAudioContext(1, 16000, 16000);
      const decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
      if (decoded.duration > 60)
        throw Error('Use an audio clip of 60 seconds or less.');
      const offline = new OfflineAudioContext(
        1,
        Math.max(1, Math.ceil(decoded.duration * 16000)),
        16000,
      );
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      const buffer = await offline.startRendering();
      if (!alive.current || captureRequest.current !== job) return;
      const samples = buffer.getChannelData(0).slice();
      pcm.current = samples;
      const rms = Math.sqrt(
          samples.reduce((n, v) => n + v * v, 0) / samples.length,
        ),
        clipped =
          (samples.reduce((n, v) => n + (Math.abs(v) > 0.99 ? 1 : 0), 0) /
            samples.length) *
          100;
      setStats({
        duration: decoded.duration,
        rate: decoded.sampleRate,
        rms,
        clipped,
      });
      if (objectURL.current) URL.revokeObjectURL(objectURL.current);
      objectURL.current = URL.createObjectURL(
        new Blob([wav16(samples)], { type: 'audio/wav' }),
      );
      setAudioURL(objectURL.current);
      if (local) {
        if (rms < threshold) {
          setStatus(
            'Audio is below the silence threshold. Move closer to the mic or lower the threshold.',
          );
          setBusy(false);
          return;
        }
        modelJob({ type: 'transcribe', audio: samples, language });
      } else {
        setBusy(false);
        setStage(3);
        setStatus(
          'Recording saved. Browser transcript is shown below; edit any recognition errors.',
        );
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function record() {
    const request = ++captureRequest.current;
    setError('');
    setTranscript('');
    setChunks([]);
    setStage(0);
    setElapsed(0);
    setStats(null);
    pcm.current = null;
    if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    objectURL.current = '';
    setAudioURL('');
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          'Microphone access needs HTTPS or localhost and a supported browser.',
        );
      if (typeof MediaRecorder === 'undefined')
        throw Error(
          'Audio recording is not supported in this browser. You can type a test command below.',
        );
      const Rec =
        (window as SpeechWindow).SpeechRecognition ??
        (window as SpeechWindow).webkitSpeechRecognition;
      if (engine === 'browser' && !Rec)
        throw Error(
          'Live browser speech recognition is unavailable here. Choose local Whisper.',
        );
      const captured = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: echo,
          noiseSuppression: noise,
          autoGainControl: false,
          ...(inputId ? { deviceId: { exact: inputId } } : {}),
        },
      });
      if (!alive.current || captureRequest.current !== request) {
        captured.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = captured;
      setInputs(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === 'audioinput',
        ),
      );
      const ctx = new AudioContext();
      context.current = ctx;
      await ctx.resume();
      if (!alive.current || captureRequest.current !== request) {
        clearCapture();
        return;
      }
      const source = ctx.createMediaStreamSource(captured),
        amplifier = ctx.createGain(),
        analyser = ctx.createAnalyser(),
        destination = ctx.createMediaStreamDestination();
      amplifier.gain.value = gain;
      analyser.fftSize = 1024;
      source.connect(amplifier);
      amplifier.connect(analyser);
      analyser.connect(destination);
      const parts: Blob[] = [];
      const rec = new MediaRecorder(destination.stream);
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      rec.onstop = () => {
        destination.stream.getTracks().forEach((t) => t.stop());
        if (alive.current)
          void processBlob(
            new Blob(parts, { type: rec.mimeType }),
            engine === 'local',
          );
      };
      rec.onerror = () => {
        setError('Audio recording failed.');
        stop();
      };
      if (engine === 'browser' && Rec) {
        const r = new Rec();
        recognizer.current = r;
        r.lang =
          language === 'hindi'
            ? 'hi-IN'
            : language === 'spanish'
              ? 'es-ES'
              : 'en-IN';
        r.continuous = true;
        r.interimResults = true;
        r.onresult = (e) => {
          let text = '';
          for (let i = 0; i < e.results.length; i++)
            text += e.results[i][0].transcript + ' ';
          setTranscript(text.trim());
          setStage(2);
        };
        r.onerror = (e) =>
          setError(
            `Browser recognition: ${e.error}. Try local Whisper if the service is unavailable.`,
          );
        r.onend = () => {
          recognizer.current = null;
        };
        r.start();
      }
      rec.start(250);
      setRecording(true);
      setBusy(false);
      setStatus('Listening. Speak naturally; stop when you finish.');
      const samples = new Float32Array(analyser.fftSize),
        started = performance.now();
      let last = 0;
      const draw = (now: number) => {
        if (!alive.current || rec.state !== 'recording') return;
        analyser.getFloatTimeDomainData(samples);
        const c = waveform.current,
          paint = c?.getContext('2d');
        if (c && paint) {
          paint.fillStyle = '#eef5ef';
          paint.fillRect(0, 0, c.width, c.height);
          paint.strokeStyle = '#328063';
          paint.lineWidth = 2;
          paint.beginPath();
          samples.forEach((v, i) => {
            const x = (i / samples.length) * c.width,
              y = (0.5 - v * 0.45) * c.height;
            if (i === 0) paint.moveTo(x, y);
            else paint.lineTo(x, y);
          });
          paint.stroke();
        }
        if (now - last > 100) {
          setLevel(
            Math.sqrt(samples.reduce((n, v) => n + v * v, 0) / samples.length),
          );
          setElapsed((now - started) / 1000);
          last = now;
        }
        raf.current = requestAnimationFrame(draw);
      };
      raf.current = requestAnimationFrame(draw);
      timer.current = setTimeout(stop, duration * 1000);
    } catch (e) {
      recognizer.current?.abort();
      clearCapture();
      if (alive.current) {
        setRecording(false);
        setBusy(false);
        setError((e as Error).message);
      }
    }
  }
  function resetModel() {
    captureRequest.current++;
    worker.current?.terminate();
    worker.current = null;
    if (modelTimer.current) clearTimeout(modelTimer.current);
    setReady(false);
    setBusy(false);
    setError('');
    setStatus(
      'Model worker reset. Cached model files may be reused on the next load.',
    );
  }
  return (
    <div className="testing-lab">
      <div className="master-section-heading">
        <div>
          <div className="eyebrow">TEST · OBSERVE · UNDERSTAND</div>
          <h1>Try it with real input.</h1>
          <p>
            Test your microphone, inspect transcription and safely dry-run
            circuit behavior.
          </p>
        </div>
        <Button variant="outline" onClick={() => setAdvanced(!advanced)}>
          {advanced ? 'Beginner mode' : 'Advanced controls'}
        </Button>
      </div>
      <div className="master-tabs">
        <Button
          variant={section === 'voice' ? 'default' : 'ghost'}
          onClick={() => setSection('voice')}
          disabled={recording || busy}
        >
          <Mic />
          Voice playground
        </Button>
        <Button
          variant={section === 'circuit' ? 'default' : 'ghost'}
          onClick={() => setSection('circuit')}
          disabled={recording || busy}
        >
          <FlaskConical />
          Circuit tests
        </Button>
      </div>
      {section === 'voice' ? (
        <>
          <div className="voice-layout">
            <section className="voice-capture">
              <h2>1. Capture your voice</h2>
              <p>
                Your device’s microphone supplies real audio. This tests the
                browser pipeline, not an attached ESP microphone or S3 WakeNet
                firmware.
              </p>
              <label>
                Transcription engine
                <select
                  disabled={recording || busy}
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                >
                  <option value="local">
                    Local Whisper · runs on this device
                  </option>
                  <option value="browser">
                    Live browser recognition · may use online service
                  </option>
                </select>
              </label>
              <p className="pipeline-note">
                {engine === 'local'
                  ? 'First use downloads a speech model and runtime from Hugging Face/jsDelivr (roughly 100 MB, depending on cached files). Audio stays in this browser; no API key is needed.'
                  : 'The browser’s speech service may send audio to its provider. Availability depends on your browser and network. Choose local Whisper to keep inference on this device.'}
              </p>
              <div className="master-actions">
                <label>
                  Language
                  <select
                    value={language}
                    disabled={recording || busy}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                    <option value="spanish">Spanish</option>
                  </select>
                </label>
                {engine === 'local' && (
                  <Button
                    variant="outline"
                    disabled={busy || recording || ready}
                    onClick={() => modelJob({ type: 'load' })}
                  >
                    {ready ? 'Model ready' : 'Download / load local model'}
                  </Button>
                )}
              </div>
              <canvas
                ref={waveform}
                width={720}
                height={150}
                aria-label="Live microphone waveform"
              />
              <div className="voice-meter">
                <span>
                  {elapsed.toFixed(1)} / {duration}s
                </span>
                <meter
                  min="0"
                  max="1"
                  value={level}
                  aria-label="Microphone RMS level"
                />
                <span>
                  {level > 0.001 ? (20 * Math.log10(level)).toFixed(0) : '−∞'}{' '}
                  dBFS
                </span>
              </div>
              <div className="master-actions">
                <Button
                  disabled={busy && !recording}
                  onClick={() => (recording ? stop() : void record())}
                >
                  {recording ? <Square /> : <Mic />}
                  {recording ? 'Stop & transcribe' : 'Record voice'}
                </Button>
                {busy && (
                  <Button variant="outline" onClick={resetModel}>
                    Cancel processing
                  </Button>
                )}
                <label className="audio-upload">
                  Upload audio
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={recording || busy || engine !== 'local'}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      if (f.size > 15000000) {
                        setError('Audio file must be under 15 MB.');
                        return;
                      }
                      setBusy(true);
                      setError('');
                      await processBlob(f, true);
                    }}
                  />
                </label>
              </div>
              {advanced && (
                <div className="voice-advanced">
                  <label>
                    Input device
                    <select
                      disabled={recording}
                      value={inputId}
                      onChange={(e) => setInputId(e.target.value)}
                    >
                      <option value="">System default</option>
                      {inputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || 'Microphone'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Input gain · {gain.toFixed(1)}×
                    <input
                      type="range"
                      min=".2"
                      max="3"
                      step=".1"
                      value={gain}
                      disabled={recording}
                      onChange={(e) => setGain(+e.target.value)}
                    />
                  </label>
                  <label>
                    Silence threshold · {threshold.toFixed(3)} RMS
                    <input
                      type="range"
                      min=".001"
                      max=".08"
                      step=".001"
                      value={threshold}
                      disabled={recording}
                      onChange={(e) => setThreshold(+e.target.value)}
                    />
                  </label>
                  <label>
                    Recording limit
                    <select
                      disabled={recording}
                      value={duration}
                      onChange={(e) => setDuration(+e.target.value)}
                    >
                      {[10, 15, 30, 60].map((v) => (
                        <option key={v} value={v}>
                          {v} seconds
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={echo}
                      disabled={recording}
                      onChange={(e) => setEcho(e.target.checked)}
                    />
                    Echo cancellation
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={noise}
                      disabled={recording}
                      onChange={(e) => setNoise(e.target.checked)}
                    />
                    Noise suppression
                  </label>
                  <Button
                    variant="outline"
                    disabled={recording}
                    onClick={resetModel}
                  >
                    <RotateCcw />
                    Reset model
                  </Button>
                </div>
              )}
              <p role="status">{status}</p>
              {error && (
                <p className="test-error" role="alert">
                  {error}
                </p>
              )}
            </section>
            <section className="voice-result">
              <h2>2. See what was understood</h2>
              <div className="voice-stages">
                {[
                  'Microphone',
                  '16 kHz PCM',
                  'Speech → text',
                  'Review action',
                ].map((s, i) => (
                  <span key={s} className={stage === i ? 'active' : ''}>
                    {i + 1}. {s}
                  </span>
                ))}
              </div>
              <textarea
                aria-label="Transcript or typed test command"
                placeholder="Transcript appears here. You can also type: turn on the LED"
                maxLength={4000}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
              <p className="pipeline-note">
                Transcription may contain mistakes. The command matcher below is
                a small English grammar, not an LLM; Hindi/Spanish speech can
                still be transcribed.
              </p>
              {audioURL && <audio controls src={audioURL} />}
              <div className="master-actions">
                <Button
                  variant="outline"
                  disabled={!transcript}
                  onClick={() =>
                    saveBlob(
                      'voice-transcript.txt',
                      new Blob([transcript], { type: 'text/plain' }),
                    )
                  }
                >
                  <Download />
                  Transcript
                </Button>
                <Button
                  variant="outline"
                  disabled={!pcm.current}
                  onClick={() =>
                    pcm.current &&
                    saveBlob(
                      'voice-capture-16khz.wav',
                      new Blob([wav16(pcm.current)], { type: 'audio/wav' }),
                    )
                  }
                >
                  <Download />
                  16 kHz WAV
                </Button>
                <Button
                  variant="outline"
                  disabled={!transcript}
                  onClick={() => {
                    if (!('speechSynthesis' in window)) {
                      setError('Read-back is unavailable in this browser.');
                      return;
                    }
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(transcript);
                    u.lang =
                      language === 'hindi'
                        ? 'hi-IN'
                        : language === 'spanish'
                          ? 'es-ES'
                          : 'en-IN';
                    window.speechSynthesis.speak(u);
                  }}
                >
                  <Volume2 />
                  Read back
                </Button>
              </div>
              {stats && (
                <div className="voice-stats">
                  <span>{stats.duration.toFixed(2)}s captured</span>
                  <span>16 kHz mono · PCM16 export</span>
                  <span>
                    {(20 * Math.log10(Math.max(stats.rms, 0.00001))).toFixed(1)}{' '}
                    dBFS RMS
                  </span>
                  <span>{stats.clipped.toFixed(2)}% near clipping</span>
                </div>
              )}
              {chunks.length > 0 && (
                <details>
                  <summary>Timestamped segments</summary>
                  {chunks.map((c, i) => (
                    <p key={i}>
                      <code>
                        {c.timestamp[0]?.toFixed(1)}–
                        {c.timestamp[1]?.toFixed(1) ?? '…'}s
                      </code>{' '}
                      {c.text}
                    </p>
                  ))}
                </details>
              )}
              <article className="voice-action">
                <h3>3. Test a device command</h3>
                <p>{action.message}</p>
                {action.deviceId && (
                  <p>
                    Current virtual value:{' '}
                    <strong>
                      {
                        state.devices.find((d) => d.id === action.deviceId)
                          ?.value
                      }
                    </strong>
                  </p>
                )}
                <Button
                  disabled={!action.deviceId || recording || busy}
                  onClick={() => {
                    if (action.deviceId && action.value !== undefined) {
                      onApply(action.deviceId, action.value);
                      setStatus(
                        'Reviewed value applied to the current virtual circuit.',
                      );
                    }
                  }}
                >
                  Apply to virtual device
                </Button>
                <p className="pipeline-note">
                  Commands change the selected workbench circuit only. Nothing
                  is sent to physical equipment.
                </p>
              </article>
              <div className="voice-prompts">
                {[
                  'turn on the LED',
                  'set fan to 60 percent',
                  'set servo to 90 degrees',
                ].map((s) => (
                  <button key={s} onClick={() => setTranscript(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </section>
          </div>
          <details className="test-explainer">
            <summary>What is actually happening?</summary>
            <p>
              Microphone → browser echo/noise processing → adjustable gain →
              recording → mono resampling at 16 kHz → speech recognition →
              editable transcript → reviewed device command. The waveform and
              audio statistics come from real captured samples. The silence
              threshold is an energy check, not semantic voice activity
              detection. Whisper runs in a worker so the UI can remain
              responsive.
            </p>
            <p>
              References:{' '}
              <a
                href="https://huggingface.co/docs/transformers.js/en/pipelines"
                target="_blank"
                rel="noreferrer"
              >
                Transformers.js audio pipelines
              </a>{' '}
              ·{' '}
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition"
                target="_blank"
                rel="noreferrer"
              >
                Browser speech recognition
              </a>
              .
            </p>
          </details>
        </>
      ) : (
        <section className="circuit-test-panel">
          <h2>Current board · {state.chip}</h2>
          <p>
            Check wiring, syntax, one interpreter loop and import compatibility.
            Dry runs use an isolated copy of the circuit.
          </p>
          <div className="master-actions">
            <Button onClick={() => setResults(runCircuitTests(state))}>
              <Play />
              Run circuit checks
            </Button>
            <Button variant="outline" onClick={() => onLoad('dimmer')}>
              Load LED test circuit
            </Button>
            <Button variant="outline" onClick={() => onLoad('greenhouse')}>
              Load sensor test circuit
            </Button>
            <Button
              variant="outline"
              disabled={!results.length}
              onClick={() =>
                saveBlob(
                  'esplab-test-report.json',
                  new Blob(
                    [JSON.stringify({ chip: state.chip, results }, null, 2)],
                    { type: 'application/json' },
                  ),
                )
              }
            >
              <Download />
              Test report
            </Button>
          </div>
          {results.map((r, i) => (
            <article className={`test-result ${r.status}`} key={i}>
              <strong>
                {r.status.toUpperCase()} · {r.name}
              </strong>
              <p>{r.detail}</p>
            </article>
          ))}
          {!results.length && (
            <p className="test-empty">
              Run the checks to see specific failures and suggestions. A passing
              teaching test does not certify real hardware.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
