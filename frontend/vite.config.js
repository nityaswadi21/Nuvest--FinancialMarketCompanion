import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/score':     'http://localhost:8000',
      '/optimize':  'http://localhost:8000',
      '/trajectory':'http://localhost:8000',
      '/portfolio': 'http://localhost:8000',
      '/predict':   'http://localhost:8000',
    }
  }
})
