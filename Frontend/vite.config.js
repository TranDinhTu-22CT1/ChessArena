import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const vendorChunks = {
  react: ['react', 'react-dom'],
  firebase: ['firebase'],
  chess: ['chess.js'],
  icons: ['lucide-react']
};

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          const match = Object.entries(vendorChunks).find(([, packages]) =>
            packages.some((packageName) => id.includes(`/node_modules/${packageName}/`))
          );

          return match?.[0] || 'vendor';
        }
      }
    }
  }
});
