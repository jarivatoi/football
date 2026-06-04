import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Remove base path for Netlify (deploy to root)
  // base: '/football/', // Only for GitHub Pages
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
})