import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-white p-5 text-[13px] text-[var(--text-muted)]">
            <AlertTriangle size={14} className="shrink-0 text-amber-500" />
            Ce bloc est temporairement indisponible.
          </div>
        )
      )
    }
    return this.props.children
  }
}
