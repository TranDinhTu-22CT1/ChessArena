import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const vendorChunks = {
  react: ['react', 'react-dom'],
  firebase: ['firebase'],
  chess: ['chess.js'],
  icons: ['lucide-react']
};

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const target = env.VITE_PROXY_API_URL || 'http://127.0.0.1:3000';
  const proxy = { '/api': { target, changeOrigin: true, timeout: 0, proxyTimeout: 0 } };
  return {
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: (env.VITE_ALLOWED_HOSTS || '').split(',').map((host) => host.trim()).filter(Boolean),
    proxy
  },
  preview: { host: '0.0.0.0', strictPort: true, proxy },
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
  };
});
