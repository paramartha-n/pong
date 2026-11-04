import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    // three/webgpu is a large rendering library; one chunk is intentional.
    chunkSizeWarningLimit: 1000,
  },
});
