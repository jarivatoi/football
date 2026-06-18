import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { totelepepExtractor } from './services/totelepepExtractor';
import { matchSpecificExtractor } from './services/matchSpecificExtractor';

// Make extractor available globally for debugging
(window as any).totelepepExtractor = totelepepExtractor;
(window as any).matchSpecificExtractor = matchSpecificExtractor;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
