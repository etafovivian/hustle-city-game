// Background worker. Stage A: housekeeping only. Later stages add notifications,
// webhook processing, reconciliation and payout jobs (PRD: System boundaries).
import { createDb, sessions } from "@hc/db";
import { lt } from "drizzle-orm";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const { db, client } = createDb(url, { max: 2 });

interface Job {
  name: string;
  everyMs: number;
  run: () => Promise<void>;
}

const jobs: Job[] = [
  {
    name: "expire-sessions",
    everyMs: 60 * 60 * 1000,
    run: async () => {
      const removed = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ t: sessions.tokenHash });
      if (removed.length) console.log(`[expire-sessions] removed ${removed.length}`);
    },
  },
];

const timers = jobs.map((job) => {
  const tick = () =>
    job.run().catch((err: unknown) => console.error(`[${job.name}] failed`, err));
  void tick();
  return setInterval(tick, job.everyMs);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    timers.forEach(clearInterval);
    void client.end().then(() => process.exit(0));
  });
}
console.log(`worker started with ${jobs.length} job(s)`);
