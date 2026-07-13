import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { updateManager } from './utils/updateManager';
import './utils/maintenanceMode';

// iPhone fullscreen support
function enableFullscreen() {
  // Hide address bar on iPhone
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    setTimeout(() => {
      window.scrollTo(0, 1);
    }, 100);
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        window.scrollTo(0, 1);
      }, 100);
    });
  }
}

// Enhanced app initialization with error handling
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  const root = createRoot(rootElement);
  
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  // Enable fullscreen after render
  enableFullscreen();
  
} catch (error) {
  console.error('Failed to initialize app:', error);
  
  // Fallback: Show error message and reload button
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
        color: #374151;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        text-align: center;
        padding: 20px;
      ">
        <div>
          <h1 style="font-size: 24px; margin-bottom: 20px; font-weight: 600; color: #1f2937;">⚠️ App Error</h1>
          <p style="font-size: 16px; margin-bottom: 30px; color: #6b7280;">Something went wrong. Please try reloading the app.</p>
          <button onclick="window.location.reload()" style="
            background: #6366f1; 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 8px; 
            font-size: 16px; 
            font-weight: 600;
            cursor: pointer;
          ">Reload App</button>
        </div>
      </div>
    `;
  }
}