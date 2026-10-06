import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  readonly fallback: (error: Error) => ReactNode;
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error?: Error;
}

/** Keeps a failure to read from the cluster inside the documentation view, instead of in Lens's own tree. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}
