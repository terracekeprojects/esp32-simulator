'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Trace } from '@/lib/pipeline';
import { FeatureBoundary } from './feature-boundary';

export function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  line: number,
  max = 6,
) {
  let row = '',
    count = 0;
  for (const word of text.split(/\s+/)) {
    if (ctx.measureText(row + word).width > width && row) {
      ctx.fillText(row, x, y + count++ * line);
      row = '';
      if (count >= max) return;
    }
    row += word + ' ';
  }
  ctx.fillText(row, x, y + count * line);
}
export function PipelinePlayer(props: {
  trace: Trace;
  onSource?: (path: string) => void;
}) {
  return (
    <FeatureBoundary name="Story player">
      <Player {...props} />
    </FeatureBoundary>
  );
}
function Player({
  trace,
  onSource,
}: {
  trace: Trace;
  onSource?: (path: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1);
  const [recording, setRecording] = useState(false),
    [message, setMessage] = useState('');
  const position = useRef(0),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null);
  const total = Math.max(1, trace.steps.length);
  const active = Math.min(total - 1, Math.floor(cursor));
  const current = trace.steps[active] ?? {
    title: 'No steps yet',
    detail: 'Capture a circuit to start playback.',
  };
  function seek(n: number) {
    position.current = n;
    setCursor(n);
  }
  useEffect(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setPlaying(false);
    position.current = 0;
    setCursor(0);
  }, [trace]);
  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      previous = performance.now();
    const next = (time: number) => {
      position.current = Math.min(
        total,
        position.current + (Math.min(time - previous, 100) / 2800) * speed,
      );
      previous = time;
      setCursor(position.current);
      if (position.current >= total) {
        setPlaying(false);
        if (recorder.current?.state === 'recording') recorder.current.stop();
      } else frame = requestAnimationFrame(next);
    };
    frame = requestAnimationFrame(next);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, total]);
  useEffect(() => {
    if (!recording) return;
    try {
      const ctx = canvas.current?.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#eef3ef';
      ctx.fillRect(0, 0, 1200, 620);
      ctx.fillStyle = '#1e493e';
      ctx.font = 'bold 15px system-ui';
      ctx.fillText('ESPLAB  /  SIGNAL STORY', 36, 38);
      ctx.font = 'bold 28px system-ui';
      ctx.fillText(trace.title.slice(0, 72), 36, 82);
      const cols = Math.max(1, Math.min(4, total)),
        gap = 16,
        w = (1128 - (cols - 1) * gap) / cols;
      trace.steps.forEach((step, i) => {
        const x = 36 + (i % cols) * (w + gap),
          y = 110 + Math.floor(i / cols) * 115;
        ctx.fillStyle =
          i === active
            ? step.warning
              ? '#80521f'
              : '#245849'
            : i < active
              ? '#d5e5dc'
              : '#ffffff';
        ctx.beginPath();
        ctx.rect(x, y, w, 95);
        ctx.fill();
        ctx.fillStyle = i === active ? '#ffffff' : '#245849';
        ctx.font = '12px system-ui';
        ctx.fillText(
          `${String(i + 1).padStart(2, '0')}  ${step.lane}`,
          x + 14,
          y + 25,
        );
        ctx.font = 'bold 16px system-ui';
        wrap(ctx, step.title, x + 14, y + 51, w - 28, 21, 2);
        if (i === active) {
          ctx.fillStyle = '#a9db81';
          ctx.fillRect(
            x + 14,
            y + 83,
            (w - 28) * (cursor >= total ? 1 : cursor % 1),
            3,
          );
        }
      });
      const captionY = 110 + Math.ceil(total / cols) * 115 + 12;
      ctx.fillStyle = '#152f29';
      ctx.font = 'bold 20px system-ui';
      ctx.fillText(current.title, 36, captionY);
      ctx.font = '17px system-ui';
      wrap(ctx, current.detail, 36, captionY + 30, 1120, 25, 5);
      ctx.fillStyle = '#63766c';
      ctx.font = '12px system-ui';
      ctx.fillText(
        'EXPLANATORY PLAYBACK · timing slowed for learning · firmware is not CPU-emulated',
        36,
        595,
      );
      ctx.fillStyle = '#245849';
      ctx.fillRect(0, 615, (1200 * cursor) / total, 5);
    } catch {
      setMessage('Video rendering is unavailable. Story playback still works.');
      if (recorder.current?.state === 'recording') recorder.current.stop();
      setRecording(false);
    }
  }, [cursor, trace, active, total, recording]);
  function record() {
    const c = canvas.current;
    if (!c?.captureStream || typeof MediaRecorder === 'undefined') {
      setMessage(
        'This browser cannot record canvas video. You can still use playback or download the explanation.',
      );
      return;
    }
    const mime = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) {
      setMessage('WebM recording is unavailable in this browser.');
      return;
    }
    try {
      stream.current = c.captureStream(30);
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream.current, { mimeType: mime });
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (chunks.length)
          saveBlob('esplab-pipeline.webm', new Blob(chunks, { type: mime }));
      };
      rec.onerror = () => {
        setMessage(
          'Recording failed. Try playback or download the explanation.',
        );
        setPlaying(false);
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      seek(0);
      rec.start(250);
      setRecording(true);
      setPlaying(true);
      setMessage(
        'Recording one pass, without audio. Keep this tab visible; the video downloads when playback ends.',
      );
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setRecording(false);
      setMessage('The browser could not start recording.');
    }
  }
  return (
    <section className="pipeline-player" aria-label="Pipeline video simulator">
      <canvas
        style={{ display: recording ? 'block' : 'none' }}
        ref={canvas}
        width={1200}
        height={620}
        aria-label={`${trace.title}. Step ${active + 1}: ${current.title}`}
      />
      {!recording && (
        <div className="story-stage" aria-live="off">
          <small>
            SIGNAL STORY · {active + 1} / {total}
          </small>
          <h3>{trace.title}</h3>
          <div className="story-path">
            {trace.steps.map((step, i) => (
              <button
                key={i}
                className={i === active ? 'active' : ''}
                onClick={() => {
                  setPlaying(false);
                  seek(i);
                }}
              >
                <small>{step.lane}</small>
                <strong>{step.title}</strong>
              </button>
            ))}
          </div>
          <h4>{current.title}</h4>
          <p>{current.detail}</p>
          <progress aria-label="Story progress" max={total} value={cursor} />
          <small>
            Animated explanation · slowed for learning · no CPU emulation
          </small>
        </div>
      )}
      <div className="pipeline-controls">
        <Button
          size="sm"
          disabled={recording}
          onClick={() => {
            if (cursor >= total) seek(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause /> : <Play />}
          {playing ? 'Pause' : 'Play story'}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous step"
          disabled={recording}
          onClick={() => {
            setPlaying(false);
            seek(Math.max(0, active - 1));
          }}
        >
          <SkipBack />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next step"
          disabled={recording}
          onClick={() => {
            setPlaying(false);
            seek(Math.min(total - 1, active + 1));
          }}
        >
          <SkipForward />
        </Button>
        <input
          aria-label="Playback position"
          type="range"
          min="0"
          max={total}
          step="0.01"
          value={cursor}
          disabled={recording}
          onChange={(e) => {
            setPlaying(false);
            seek(+e.target.value);
          }}
        />
        <select
          aria-label="Playback speed"
          value={speed}
          disabled={recording}
          onChange={(e) => setSpeed(+e.target.value)}
        >
          {[0.5, 1, 1.5, 2].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (recording) {
              recorder.current?.stop();
              setPlaying(false);
            } else record();
          }}
        >
          <Video />
          {recording ? 'Finish video' : 'Export video'}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Download trace JSON"
          onClick={() =>
            saveBlob(
              'esplab-trace.json',
              new Blob([JSON.stringify(trace, null, 2)], {
                type: 'application/json',
              }),
            )
          }
        >
          <Download />
        </Button>
      </div>
      {message && (
        <p role="status" className="pipeline-note">
          {message}
        </p>
      )}
      <p className="pipeline-note">{trace.summary}</p>
      <div className="pipeline-transcript">
        {trace.steps.map((s, i) => (
          <article
            key={i}
            className={`${i === active ? 'active' : ''} ${s.warning ? 'warning' : ''}`}
          >
            <button
              disabled={recording}
              onClick={() => {
                setPlaying(false);
                seek(i);
              }}
            >
              <span>{i + 1}</span>
              <strong>{s.title}</strong>
              <small>{s.lane}</small>
            </button>
            {i === active && (
              <div>
                <p>{s.detail}</p>
                {s.source && onSource && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSource(s.source!)}
                  >
                    Open {s.source}
                  </Button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
