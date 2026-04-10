import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'
import { getTranslations } from '../../i18n'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this would log to an error tracking service (Sentry, etc.)
    void error
    void info
  }

  render() {
    const t = getTranslations()
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">{t.errorBoundary.title}</h2>
          <p className="text-sm text-zinc-400 max-w-sm mb-6">
            {this.state.error?.message ?? t.errorBoundary.fallbackDescription}
          </p>
          <Button onClick={() => this.setState({ hasError: false })}>
            {t.errorBoundary.retry}
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
