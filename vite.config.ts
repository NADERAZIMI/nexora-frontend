import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/mexc-public': {
        target: 'https://api.mexc.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/mexc-public/, ''),
      },
    },
  },
});
