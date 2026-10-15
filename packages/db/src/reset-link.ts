// Server-side command: print a one-time password reset link for an account (while email isn't set up).
//   node packages/db/dist/reset-link.js <email> <web base url>
import { createDb } from "./index.js";
import { issueResetLink } from "./resets.js";

const [email, base] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!email || !base || !url) {
  console.error("usage: DATABASE_URL=... node reset-link.js <email> <web base url>");
  process.exit(2);
}
const { db, client } = createDb(url, { max: 1 });
try {
  const link = await issueResetLink(db, email, base, null, "cli");
  if (!link) {
    console.error("No account with that email.");
    process.exitCode = 1;
  } else {
    console.log(`Reset link (works once, expires ${link.expiresAt.toISOString()}):\n${link.url}`);
  }
} finally {
  await client.end();
}
