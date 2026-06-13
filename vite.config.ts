import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Use '/football/' base for production (GitHub Pages)
  // Use '/' base for development (localhost)
  const isProd = command === 'build';
  
  return {
    plugins: [react()],
    base: isProd ? '/football/' : '/',
    server: {
      proxy: {
        '/api': {
          target: 'https://www.totelepep.mu',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          secure: false
        }
      }
    }
  };
});