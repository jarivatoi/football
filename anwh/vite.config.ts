import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command, mode }) => {
  // Simple base path logic - use environment variables or default to GitHub Pages
  const base = process.env.NETLIFY === 'true' ? '/' : '/anwh/';
  
  console.log('Build environment:', { command, mode, base, netlify: process.env.NETLIFY });
  
  return {
    base,
    plugins: [react()],
    resolve: {
      alias: [{ find: "@", replacement: path.resolve(__dirname, "./src") }],
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});