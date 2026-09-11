'use client';
import { Component, type ReactNode } from 'react';
export class FeatureBoundary extends Component<
  { name: string; children: ReactNode },
  { error: string; key: number }
> {
  state = { error: '', key: 0 };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.error ? (
      <section role="alert" className="feature-error">
        <strong>{this.props.name} encountered an error.</strong>
        <p>{this.state.error}</p>
        <button
          onClick={() => this.setState((s) => ({ error: '', key: s.key + 1 }))}
        >
          Restart this panel
        </button>
      </section>
    ) : (
      <div key={this.state.key}>{this.props.children}</div>
    );
  }
}
