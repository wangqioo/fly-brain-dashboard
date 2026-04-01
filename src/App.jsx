import { Component } from 'react'
import Dashboard from './components/Dashboard'
import './App.css'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('React Error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: 20, background: '#111' }}>
          <h2>Error</h2>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  )
}

export default App
