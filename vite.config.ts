import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy /api/binance vers le backend (qui a les fallbacks Binance)
      '/api/binance': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Proxy API vers le backend local
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Augmenter la limite de taille des chunks
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react', 'zustand'],
  },
})
