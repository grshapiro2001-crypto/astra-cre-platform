import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global error handlers — last-resort defense against blank pages.
// If an uncaught error somehow escapes the React ErrorBoundary, these
// prevent the user from staring at a blank screen with no recovery option.
window.addEventListener('error', (event) => {
  console.error('[Global] Uncaught error:', event.error);
  const root = document.getElementById('root');
  if (root && root.innerHTML.trim() === '') {
    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;">
        <div style="text-align:center;max-width:400px;padding:2rem;">
          <h2 style="margin-bottom:0.5rem;">Something went wrong</h2>
          <p style="color:#999;margin-bottom:1.5rem;">An unexpected error occurred. Please refresh the page.</p>
          <button onclick="window.location.reload()" style="padding:0.5rem 1.5rem;border-radius:8px;border:none;background:#7c3aed;color:white;font-weight:600;cursor:pointer;">
            Refresh Page
          </button>
        </div>
      </div>`;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global] Unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
