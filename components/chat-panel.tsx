'use client';
import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, Undo2, Plug, Copy } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { applyActions, type LabState } from '@/lib/lab-state';
import { offlineReply, type AssistantReply } from '@/lib/assistant';
import { assistantContext, parsePlan, tutorInstructions } from '@/lib/ollama';
const BRIDGE = 'http://127.0.0.1:11435';
export function ChatPanel({
  state,
  onApply,
  onClose,
}: {
  state: LabState;
  onApply: (s: LabState) => void;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState<'offline' | 'local' | 'cloud'>(
      'offline',
    ),
    [cloudAvailable, setCloudAvailable] = useState(false),
    [models, setModels] = useState<{ name: string; cloud: boolean }[]>([]),
    [model, setModel] = useState(''),
    [allowCloud, setAllowCloud] = useState(false),
    [status, setStatus] = useState(
      'Connect Ollama on this computer. Local models have no API fee; cloud models use your account allowance.',
    ),
    [input, setInput] = useState(''),
    [busy, setBusy] = useState(false),
    [connecting, setConnecting] = useState(false),
    [messages, setMessages] = useState<
      { role: 'user' | 'assistant'; content: string }[]
    >([
      {
        role: 'assistant',
        content:
          'Ask about ESP32, describe a circuit, or ask me to write a simulator program. Connect Ollama first for open-ended questions. Offline commands and manual ChatGPT/Codex handoff also work.',
      },
    ]),
    [plan, setPlan] = useState<AssistantReply | null>(null),
    [base, setBase] = useState(''),
    [undo, setUndo] = useState<LabState | null>(null),
    [handoff, setHandoff] = useState(false),
    [importText, setImportText] = useState('');
  const controller = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fetch('/api/assistant')
      .then((r) => r.json() as Promise<{ available: boolean }>)
      .then((r) => setCloudAvailable(r.available))
      .catch(() => {});
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    try {
      end.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    } catch {
      /* Scrolling must never break chat. */
    }
  }, [messages, plan, busy]);
  async function connect() {
    setConnecting(true);
    try {
      const r = await fetch(BRIDGE + '/status', {
        signal: AbortSignal.timeout(10000),
      });
      const data = (await r.json()) as {
        error?: string;
        models: { name: string; cloud: boolean }[];
        defaultModel: string;
      };
      if (!r.ok) throw Error(data.error);
      setModels(data.models);
      setModel(
        data.models.find((m) => !m.cloud && m.name === 'qwen3:4b')?.name ??
          data.models.find((m) => !m.cloud)?.name ??
          data.defaultModel,
      );
      if (!data.defaultModel)
        throw Error(
          'The recommended local model is still missing. Run ollama pull qwen3:4b, wait for it to finish, then reconnect. You can also select a signed-in cloud model below.',
        );
      setProvider('local');
      setStatus(
        'Connected to your computer. It must stay on with Ollama and the ESPLAB bridge running.',
      );
    } catch (e) {
      setStatus(
        'Cannot reach the local bridge. Start it with npm run ollama:bridge in the project folder, then allow local-network access if your browser asks. If your browser blocks the hosted page, run npm run dev and use the local site. ' +
          (e instanceof Error ? e.message : ''),
      );
    } finally {
      setConnecting(false);
    }
  }
  async function send(text = input) {
    if (!text.trim() || busy) return;
    setInput('');
    setBusy(true);
    setPlan(null);
    setMessages((m) => [...m, { role: 'user', content: text }]);
    try {
      const snapshot = structuredClone(state);
      let reply: AssistantReply;
      if (provider === 'offline') reply = offlineReply(text, snapshot);
      else {
        controller.current = new AbortController();
        const timer = setTimeout(() => controller.current?.abort(), 185000);
        try {
          const r = await fetch(
            provider === 'local' ? BRIDGE + '/chat' : '/api/assistant',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.current.signal,
              body: JSON.stringify({
                message: text,
                state: snapshot,
                history: messages.slice(-4),
                model,
                allowCloud,
              }),
            },
          );
          const data = (await r.json()) as AssistantReply & { error?: string };
          if (!r.ok) throw Error(data.error ?? 'Model request failed.');
          reply = data;
        } finally {
          clearTimeout(timer);
        }
      }
      if (
        !reply ||
        typeof reply.message !== 'string' ||
        !Array.isArray(reply.actions)
      )
        throw Error('Invalid model response.');
      setMessages((m) => [...m, { role: 'assistant', content: reply.message }]);
      if (reply.actions.length) {
        applyActions(snapshot, reply.actions);
        setPlan(reply);
        setBase(JSON.stringify(snapshot));
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Request failed: ${e instanceof Error ? e.message : 'Unknown error'}. Your circuit has not changed.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    if (!plan) return;
    try {
      if (JSON.stringify(state) !== base)
        throw Error(
          'Your circuit changed. Prepare the plan again using its latest state.',
        );
      const next = applyActions(state, plan.actions);
      setUndo(structuredClone(state));
      onApply(next);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            'Plan applied. Open Code studio to run generated code. Undo is available below.',
        },
      ]);
      setPlan(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Invalid plan');
    }
  }
  async function copyContext() {
    try {
      await navigator.clipboard.writeText(
        `Help me with this ESPLAB circuit. ${input ? `My request: ${input}` : 'I will describe my task next.'}\nReturn your answer as a JSON object that I can paste into ESPLAB Import plan.\n${tutorInstructions(state)}\nCurrent state:\n${JSON.stringify(assistantContext(state), null, 2)}`,
      );
      setStatus(
        'Copied. Paste into this ChatGPT/Codex conversation, then paste the returned JSON into Import plan below. This is a manual handoff, not a live connection.',
      );
    } catch {
      setStatus(
        'Clipboard unavailable. Export circuit JSON from the workbench and attach it to your conversation.',
      );
    }
  }
  return (
    <aside className="chat-panel ollama-chat" aria-label="Lab assistant">
      <div className="chat-header">
        <span>
          <Bot size={22} />
          <strong>
            Lab assistant
            <small>
              {provider === 'local'
                ? `OLLAMA · ${model}`
                : provider === 'cloud'
                  ? 'OLLAMA CLOUD'
                  : 'OFFLINE COMMANDS'}
            </small>
          </strong>
        </span>
        <Button
          aria-label="Close assistant"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
        >
          <X size={17} />
        </Button>
      </div>
      <div className="ollama-connection">
        <div>
          <Button size="sm" disabled={busy || connecting} onClick={connect}>
            <Plug size={14} />
            {connecting ? 'Connecting…' : 'Connect Ollama'}
          </Button>
          {provider !== 'offline' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setProvider('offline')}
            >
              Offline
            </Button>
          )}
          {cloudAvailable && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setProvider('cloud');
                setStatus(
                  'Cloud requests use the configured Ollama account allowance.',
                );
              }}
            >
              Server cloud
            </Button>
          )}
        </div>
        {models.length > 0 && (
          <select
            value={model}
            disabled={busy}
            aria-label="Ollama model"
            onChange={(e) => {
              setModel(e.target.value);
              setProvider('local');
              setPlan(null);
            }}
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
                {m.cloud ? ' · cloud allowance' : ' · local'}
              </option>
            ))}
          </select>
        )}
        {models.find((m) => m.name === model)?.cloud && (
          <label>
            <Switch checked={allowCloud} onCheckedChange={setAllowCloud} />
            Use my Ollama cloud allowance
          </label>
        )}
        <p role="status">{status}</p>
        <details>
          <summary>Local setup and cloud options</summary>
          <p>
            Run <code>npm run ollama:bridge</code> in C:\Projects\esp32. Ollama
            must also be running. The bridge accepts only this site and local
            previews, and listens only on your computer.
          </p>
          <p>
            Optional cloud: sign in using <code>ollama signin</code>, then pull
            a cloud model available to your account, for example{' '}
            <code>ollama pull gpt-oss:120b-cloud</code>. Reconnect to refresh
            the list. Cloud is quota-limited and may require paid credits; local
            inference does not use cloud credits. No automatic model upgrades or
            purchases occur.
          </p>
        </details>
      </div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div className={'chat-message ' + m.role} key={i}>
            <small>{m.role === 'user' ? 'YOU' : 'LAB ASSISTANT'}</small>
            <p>{m.content}</p>
          </div>
        ))}
        {busy && (
          <div className="chat-message assistant">
            Generating a response… Local inference can take a minute.
            <Button
              size="xs"
              variant="ghost"
              onClick={() => controller.current?.abort()}
            >
              Cancel
            </Button>
          </div>
        )}
        {plan && (
          <div className="chat-plan">
            <strong>Review {plan.actions.length} actions</strong>
            <ol>
              {plan.actions.map((a, i) => (
                <li key={i}>
                  {a.type === 'set_code' ? (
                    <details>
                      <summary>Set simulator program</summary>
                      <pre>{a.key}</pre>
                    </details>
                  ) : (
                    `${a.type.replaceAll('_', ' ')} ${a.target ?? ''} ${a.key ?? ''} ${a.value ?? ''} ${a.pin ?? ''}`
                  )}
                </li>
              ))}
            </ol>
            <Button onClick={apply}>Apply to workbench</Button>
            <Button variant="ghost" onClick={() => setPlan(null)}>
              Dismiss
            </Button>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="chat-handoff">
        <Button variant="ghost" size="sm" onClick={() => setHandoff(!handoff)}>
          <Copy size={14} />
          ChatGPT / Codex handoff
        </Button>
        {handoff && (
          <div>
            <p>
              Uses your existing conversation manually. The site cannot spend
              your ChatGPT subscription as API credit.
            </p>
            <Button size="sm" variant="outline" onClick={copyContext}>
              Copy circuit context + request
            </Button>
            <textarea
              aria-label="Paste assistant JSON plan"
              value={importText}
              maxLength={50000}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste the JSON reply here…"
            />
            <Button
              size="sm"
              disabled={!importText.trim()}
              onClick={() => {
                try {
                  const reply = parsePlan(importText, state);
                  setPlan(reply);
                  setBase(JSON.stringify(state));
                  setMessages((m) => [
                    ...m,
                    { role: 'assistant', content: reply.message },
                  ]);
                  setImportText('');
                  setStatus(
                    'Imported plan validated. Review it before applying.',
                  );
                } catch (e) {
                  setStatus(e instanceof Error ? e.message : 'Invalid JSON');
                }
              }}
            >
              Import plan for review
            </Button>
          </div>
        )}
      </div>
      {undo && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onApply({ ...undo, running: false });
            setUndo(null);
            setPlan(null);
          }}
        >
          <Undo2 size={14} />
          Undo last plan
        </Button>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input
          aria-label="Message the lab assistant"
          placeholder={
            provider === 'offline'
              ? 'Try: load greenhouse'
              : 'Ask a question or describe a task…'
          }
          maxLength={4000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={busy || !input.trim()}
        >
          <Send size={17} />
        </Button>
      </form>
    </aside>
  );
}
