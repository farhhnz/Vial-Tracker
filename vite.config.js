
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ganti 'nama-repo' dengan nama repository GitHub Anda
export default defineConfig({
  plugins: [react()],
  base: '/Vial-Tracker/', 
})
