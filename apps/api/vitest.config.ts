import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["source"] },
  ssr: { resolve: { conditions: ["source"] } },
  // Generous timeouts: the suite runs against a real Postgres, often on a busy laptop; a slow run isn't a failure.
  test: { fileParallelism: false, testTimeout: 60_000, hookTimeout: 90_000 },
});
