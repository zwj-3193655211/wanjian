import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mediapipe/tasks-vision': path.resolve(__dirname, './src/stubs/tasks-vision.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@mediapipe/hands', '@mediapipe/tasks-vision'],
  },
  build: {
    commonjsOptions: {
      ignoreTryCatch: false,
    },
  },
  server: {
    host: true,
    port: 5173
  }
})
