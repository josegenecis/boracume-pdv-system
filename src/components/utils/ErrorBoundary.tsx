import React from 'react'

type Props = { children: React.ReactNode, fallback?: React.ReactNode }
type State = { hasError: boolean, error?: any }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError(error: any) { return { hasError: true, error } }
  componentDidCatch(error: any, info: any) { console.error('ErrorBoundary:', error, info) }
  render() {
    if (this.state.hasError) return this.props.fallback || <div className="p-4 text-sm text-red-600">Falha ao carregar. Recarregue a página.</div>
    return this.props.children
  }
}

