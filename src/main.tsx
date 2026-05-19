import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error suppression for known environment issues
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message && (
      event.message.includes('fetch') || 
      event.message.includes('oklch') ||
      event.message.includes('oklab')
    )) {
      event.preventDefault();
      console.warn('Suppressed:', event.message);
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
