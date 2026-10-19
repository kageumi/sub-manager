import { Component } from 'react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export class PageBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Workspace error:', error)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
          <Alert variant="destructive" className="max-w-sm">
            <AlertTitle>页面无法打开</AlertTitle>
          </Alert>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </main>
      )
    }
    return this.props.children
  }
}
