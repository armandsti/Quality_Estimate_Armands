import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Proxy removed for Vercel deployment - will use serverless functions
    // API keys removed - will be handled securely via Vercel serverless functions
  };
});
