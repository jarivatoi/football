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
        // Totelepep (default /api and /api/tp)
        '/api/tp': {
          target: 'https://www.totelepep.mu',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/tp/, ''),
          secure: false,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Accept', '*/*');
              proxyReq.setHeader('X-Requested-With', 'XMLHttpRequest');
            });
          }
        },
        // Stevenhills
        '/api/sh': {
          target: 'https://www.stevenhills.bet',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/sh/, ''),
          secure: false,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Accept', '*/*');
              proxyReq.setHeader('X-Requested-With', 'XMLHttpRequest');
            });
          }
        },
        // Superscore
        '/api/sc': {
          target: 'https://www.superscore.mu',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/sc/, ''),
          secure: false,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Accept', '*/*');
              proxyReq.setHeader('X-Requested-With', 'XMLHttpRequest');
            });
          }
        },
        // Valueplus
        '/api/vp': {
          target: 'https://www.valueplus.mu',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/vp/, ''),
          secure: false,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Accept', '*/*');
              proxyReq.setHeader('X-Requested-With', 'XMLHttpRequest');
            });
          }
        },
        // Legacy /api → totelepep (backward compatible)
        '/api': {
          target: 'https://www.totelepep.mu',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          secure: false,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Accept', '*/*');
              proxyReq.setHeader('X-Requested-With', 'XMLHttpRequest');
            });
          }
        }
      }
    }
  };
});