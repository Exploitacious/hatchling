import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Catches render errors so a single broken screen can't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[renderer] uncaught error:', error, info)
  }

  private readonly handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-hatch-bg p-6 text-center">
          <h1 className="text-lg font-semibold text-hatch-danger">Something went wrong</h1>
          <p className="max-w-md text-sm text-hatch-muted">{this.state.error.message}</p>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-md bg-hatch-accent px-4 py-2 text-sm font-medium text-black hover:bg-hatch-accent-hover"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
