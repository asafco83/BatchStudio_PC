import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, background: '#0c0c0d', color: '#e4e4e8', fontFamily: 'monospace', minHeight: '100vh' }}>
          <h1 style={{ color: '#f87171', fontSize: 18, marginBottom: 16 }}>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#a8a8b0', marginBottom: 16 }}>
            {this.state.error?.toString()}
          </pre>
          <details style={{ fontSize: 11, color: '#5c5c63' }}>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Stack trace</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            onClick={() => { this.setState({ hasError: false, error: null, errorInfo: null }); }}
            style={{ marginTop: 20, padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
          >
            Try to recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
