"use client"

import type { ReactNode } from "react"
import { Component } from "react"

interface SceneErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface SceneErrorBoundaryState {
  failed: boolean
}

/** 将渲染错误限制在场景内；切换素材时由调用方的 key 重建边界。 */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  public state: SceneErrorBoundaryState = { failed: false }

  public static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true }
  }

  public render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
