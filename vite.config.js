import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const root = resolve(import.meta.dirname, 'frontend')

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve(root, 'src') } },
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'react', test: /node_modules\/(?:react|react-dom|scheduler)\// }],
        },
      },
    },
  },
})
