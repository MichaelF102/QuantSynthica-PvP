'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Banner } from './Banner';
import { PANEL_SHELL } from './Panel';

type Props = { name: string; children: ReactNode };
type State = { failed: boolean };

/** Keeps one broken card from taking down the page (CLAUDE.md §6 rule 7). */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}] failed to render`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={`${PANEL_SHELL} p-4`}>
        <Banner kind="error" onRetry={() => this.setState({ failed: false })}>
          The {this.props.name} could not be shown.
        </Banner>
      </div>
    );
  }
}
