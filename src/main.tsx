import { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

function hideSplash() {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 450);
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(error: unknown) { console.error('[ErrorBoundary]', error); }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#f0fdf4', fontFamily: 'system-ui, sans-serif' }}>
          <img src="/ChatGPT_Image_May_26,_2026,_09_16_01_PM.png" alt="Find Your Bench" style={{ width: 80, height: 80, borderRadius: 16, marginBottom: 20, objectFit: 'contain' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, textAlign: 'center', maxWidth: 320 }}>
            The app ran into an unexpected error. Refreshing usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Refresh App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');
const root = createRoot(rootEl);

root.render(
  <ErrorBoundary>
    <App onReady={hideSplash} />
  </ErrorBoundary>
);
