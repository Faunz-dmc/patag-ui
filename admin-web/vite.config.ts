import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (Object.keys(env).some(key => /VITE_.*(SERVICE_ROLE|SECRET|PASSWORD|DB_URL)/.test(key)) || env.VITE_MAPBOX_TOKEN?.startsWith('sk.')) throw Error('Private credentials must never use VITE_ variables.');
  return {
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:4101' } } },
    preview: { host: '127.0.0.1', port: 5173, proxy: { '/api': { target: 'http://127.0.0.1:4101' } } },
  };
});
