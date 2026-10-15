import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

// The build's id, sent with beta feedback and error reports (BUILD_ID in CI/Docker, else the git commit).
const build = (() => {
  if (process.env.BUILD_ID) return process.env.BUILD_ID;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
})();

export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(build) },
  resolve: { conditions: ["source"] },
  server: {
    port: 5190,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 4180}` },
  },
});
