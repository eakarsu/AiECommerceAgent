import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react({ include: /\.(js|jsx|ts|tsx)$/ })],
  envDir: '..',
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.(js|jsx)$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  server: {
    port: 4800,
    proxy: {
      '/api': {
        target: 'http://localhost:4801',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:4801',
        changeOrigin: true
      }
    }
  }
})
