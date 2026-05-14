import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Root-relative assets (`/file.png`). `./` breaks `publicUrl()` on nested routes
  // (e.g. `/demos/quantization` resolves `./q.png` → `/demos/q.png` → 404 on Vercel).
  base: '/minigames/',
});
