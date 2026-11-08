import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import theme from './tailwind.config'

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss(theme), autoprefixer()] } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
