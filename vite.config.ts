import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so GitHub project pages (and local preview) resolve assets.
  base: './',
  plugins: [react(), tailwindcss()],
})
