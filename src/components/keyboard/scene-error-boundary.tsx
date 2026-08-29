"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export interface SceneErrorFallbackProps {
  error: Error;
  reset: () => void;
}
export type SceneErrorFallback =
  ReactNode | ((props: SceneErrorFallbackProps) => ReactNode);

export interface SceneErrorBoundaryProps {
  children: ReactNode;
  fallback: SceneErrorFallback;
  onError?: (error: Error, info: ErrorInfo) => void;
  resetKey?: unknown;
}

interface SceneErrorBoundaryState {
  error: Error | null;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;

  return new Error(
    typeof error === "string" ? error : "The keyboard scene failed to load.",
  );
}

/** Keeps WebGL/WebGPU and asset-loading failures local to the scene subtree. */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  public state: SceneErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(
    error: unknown,
  ): SceneErrorBoundaryState {
    return { error: normalizeError(error) };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(normalizeError(error), info);
  }

  public componentDidUpdate(previousProps: SceneErrorBoundaryProps) {
    if (
      this.state.error !== null &&
      !Object.is(previousProps.resetKey, this.props.resetKey)
    ) {
      this.reset();
    }
  }

  private reset = () => {
    this.setState({ error: null });
  };

  public render() {
    const { children, fallback } = this.props;
    const { error } = this.state;

    if (error === null) return children;

    return typeof fallback === "function"
      ? fallback({ error, reset: this.reset })
      : fallback;
  }
}

export default SceneErrorBoundary;
