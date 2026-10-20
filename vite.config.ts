import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/bybit-public': {
        target: 'https://api.bybit.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\\/bybit-public/, ''),
      },
      '/mexc-public': {
        target: 'https://api.mexc.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/mexc-public/, ''),
      },
    },
  },
});
