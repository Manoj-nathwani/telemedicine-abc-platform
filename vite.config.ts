import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    open: true
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true
      }
    }
  }
})
