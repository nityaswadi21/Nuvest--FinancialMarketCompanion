import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/predict': 'http://localhost:8000',
      '/recommend': 'http://localhost:8000',
      '/trajectory': 'http://localhost:8000',
      '/score': 'http://localhost:8000',
      '/optimize': 'http://localhost:8000',
    }
  }
})
