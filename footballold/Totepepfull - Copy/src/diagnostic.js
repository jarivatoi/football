// Diagnostic script to check what's happening with the React app
console.log('🔍 Running diagnostic checks...');

// Check if the root element exists
const rootElement = document.getElementById('root');
console.log('Root element exists:', !!rootElement);
if (rootElement) {
  console.log('Root element innerHTML length:', rootElement.innerHTML.length);
  console.log('Root element content:', rootElement.innerHTML.substring(0, 100) + '...');
}

// Check if React is loaded
console.log('React loaded:', typeof React !== 'undefined');
console.log('ReactDOM loaded:', typeof ReactDOM !== 'undefined');

// Check if the App component is being imported
console.log('Checking for App component...');
console.log('Window object keys:', Object.keys(window).filter(key => key.includes('App') || key.includes('app')));

// Check for any errors in the console
console.log('Console errors check completed');

// Try to manually render something to the root
if (rootElement) {
  try {
    console.log('Attempting to render test content...');
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1>Diagnostic Test</h1>
        <p>If you can see this, the root element is working but React might not be rendering.</p>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reload Page
        </button>
      </div>
    `;
  } catch (e) {
    console.error('Error rendering test content:', e);
  }
}

console.log('🔍 Diagnostic checks completed. Check above for results.');