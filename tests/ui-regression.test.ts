import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import React from 'react';
import { buildTemplate } from '../lib/templates';
import { circuitTrace } from '../lib/pipeline';

test('chat send, apply and story playback remain usable without canvas support', async () => {
  const window = new Window({ url: 'http://localhost:3001' });
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'MutationObserver',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'HTMLInputElement',
    'Event',
    'MouseEvent',
    'ResizeObserver',
  ])
    Object.defineProperty(globalThis, key, {
      value: (window as any)[key],
      configurable: true,
      writable: true,
    });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { render, fireEvent, waitFor, cleanup, act } =
    await import('@testing-library/react');
  const { ChatPanel } = await import('../components/chat-panel');
  const { PipelinePlayer } = await import('../components/pipeline-player');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ available: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  try {
    let applied: any;
    const chat = render(
      React.createElement(ChatPanel, {
        state: buildTemplate('dimmer'),
        onApply: (s) => {
          applied = s;
        },
        onClose: () => {},
      }),
    );
    fireEvent.change(chat.getByLabelText('Message the lab assistant'), {
      target: { value: 'set led 33' },
    });
    fireEvent.click(chat.getByLabelText('Send message'));
    await waitFor(() => assert.ok(chat.getByText('Apply to workbench')));
    fireEvent.click(chat.getByText('Apply to workbench'));
    assert.equal(applied.devices.find((d: any) => d.type === 'led').value, 33);
    assert.ok(chat.getByLabelText('Send message'));
    cleanup();
    const player = render(
      React.createElement(PipelinePlayer, {
        trace: circuitTrace(buildTemplate('dimmer'), '', false, 0),
      }),
    );
    fireEvent.click(player.getByText('Play story'));
    assert.ok(player.getByText('Pause'));
    await act(() => new Promise((resolve) => setTimeout(resolve, 180)));
    assert.ok(
      Number(player.getByLabelText('Playback position').getAttribute('value')) >
        0,
    );
    fireEvent.change(player.getByLabelText('Playback position'), {
      target: { value: '0' },
    });
    fireEvent.click(player.getByLabelText('Next step'));
    assert.equal(
      (player.getByLabelText('Playback position') as HTMLInputElement).value,
      '1',
    );
    fireEvent.click(player.getByText('Export video'));
    assert.match(
      player.getByRole('status').textContent ?? '',
      /cannot record|unavailable/,
    );
    assert.ok(player.getByText('Play story'));
    cleanup();
    const empty = render(
      React.createElement(PipelinePlayer, {
        trace: { title: 'Empty', summary: '', steps: [] },
      }),
    );
    fireEvent.click(empty.getByText('Play story'));
    assert.ok(empty.getByText('No steps yet'));
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    await window.happyDOM.close();
  }
});
