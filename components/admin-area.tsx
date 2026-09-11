'use client';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { normalizeState, type LabState } from '@/lib/lab-state';
export function AdminArea({
  onLoad,
  onLogout,
}: {
  onLoad: (s: LabState) => void;
  onLogout: () => void;
}) {
  const [admin, setAdmin] = useState(false),
    [password, setPassword] = useState(''),
    [message, setMessage] = useState('Checking session…'),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s: any) => {
        setAdmin(s.admin);
        setMessage(
          s.admin
            ? 'Admin session active.'
            : s.configured
              ? 'Sign in to access private projects.'
              : 'Admin access has not been configured.',
        );
      })
      .catch(() => setMessage('Unable to check admin session.'));
  }, []);
  useEffect(() => {
    if (!admin) return;
    const handler = async (event: MessageEvent) => {
      const frame = document.querySelector<HTMLIFrameElement>(
        '#private-project-frame',
      );
      if (
        event.origin !== location.origin ||
        event.source !== frame?.contentWindow ||
        event.data?.type !== 'open-private-project'
      )
        return;
      try {
        const r = await fetch('/api/admin/session', { cache: 'no-store' });
        const s: any = await r.json();
        if (!s.admin) {
          setAdmin(false);
          return;
        }
        onLoad({ ...normalizeState(event.data.state, true), restricted: true });
      } catch {
        setMessage('Private project could not be opened.');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [admin, onLoad]);
  return (
    <section className="admin-area">
      <div className="master-section-heading">
        <div>
          <h1>Admin projects</h1>
          <p role="status">{message}</p>
        </div>
        {admin && (
          <Button
            variant="outline"
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch('/api/admin/session', {
                  method: 'DELETE',
                });
                if (!r.ok) throw Error('Logout failed.');
                setAdmin(false);
                setMessage('Signed out.');
                onLogout();
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            Sign out
          </Button>
        )}
      </div>
      {admin ? (
        <iframe
          id="private-project-frame"
          src="/api/admin/content?file=index.html"
          title="Private admin projects"
          style={{ width: '100%', height: '82vh', border: 0 }}
        />
      ) : (
        <form
          className="admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await fetch('/api/admin/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password }),
              });
              const data: any = await r.json();
              if (!r.ok) throw Error(data.error);
              setAdmin(true);
              setPassword('');
              setMessage('Admin session active.');
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Username
            <Input value="admin" autoComplete="username" readOnly />
          </label>
          <label>
            Password
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Admin login'}
          </Button>
        </form>
      )}
    </section>
  );
}
