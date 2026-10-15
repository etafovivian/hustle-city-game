// Beta stats for admins (see @hc/shared stats.ts): read-only counts over existing tables, in Lagos days. Active on a
// day = earned or spent coins (not the sign-up grant) or made quest progress that day. Admins are left out.

import { dayKey, type StatsView } from "@hc/shared";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireRole } from "../plugins/auth.js";

export async function statsRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;

  app.get("/api/admin/stats", async (request): Promise<StatsView> => {
    requireRole(request, "admin");
    const db = app.db;
    const rows = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
    const today = dayKey(new Date(), tz);
    // Players (not admins), and each day each was active, over the last 45 days.
    const players = sql`(select id from users where not ('admin' = any(roles)))`;
    const active = sql`(
      select user_id, (created_at at time zone ${tz})::date as d from game_ledger_entries
        where kind not in ('signup_grant', 'admin_adjustment') and created_at > now() - interval '45 days' and user_id in ${players}
      union
      select user_id, day::date from quest_progress
        where day ~ '^\\d{4}-\\d{2}-\\d{2}$' and day::date > current_date - 45 and user_id in ${players}
    )`;
    const t = sql`(${today})::date`;

    const [p] = await rows<Record<string, number>>(sql`
      with act as ${active}
      select
        (select count(*) from users where not ('admin' = any(roles)))::int as total,
        (select count(*) from users where not ('admin' = any(roles)) and (created_at at time zone ${tz})::date = ${t})::int as "newToday",
        (select count(*) from users where not ('admin' = any(roles)) and (created_at at time zone ${tz})::date > ${t} - 7)::int as "new7d",
        (select count(distinct user_id) from act where d = ${t})::int as "activeToday",
        (select count(distinct user_id) from act where d > ${t} - 7)::int as "active7d",
        (select count(distinct user_id) from act where d > ${t} - 30)::int as "active30d"`);

    const daily = await rows<{ day: string; signups: number; active: number }>(sql`
      with act as ${active}, days as (select generate_series(${t} - 13, ${t}, interval '1 day')::date as d)
      select to_char(days.d, 'YYYY-MM-DD') as day,
        (select count(*) from users where not ('admin' = any(roles)) and (created_at at time zone ${tz})::date = days.d)::int as signups,
        (select count(distinct user_id) from act where act.d = days.d)::int as active
      from days order by days.d`);

    const cohorts = await rows<{ day: string; signups: number; d1: number | null; d7: number | null }>(sql`
      with act as ${active},
        joined as (select id, (created_at at time zone ${tz})::date as d from users where not ('admin' = any(roles)) and (created_at at time zone ${tz})::date > ${t} - 14)
      select to_char(j.d, 'YYYY-MM-DD') as day, count(*)::int as signups,
        case when j.d + 1 <= ${t} then count(*) filter (where exists (select 1 from act where act.user_id = j.id and act.d = j.d + 1))::int end as d1,
        case when j.d + 7 <= ${t} then count(*) filter (where exists (select 1 from act where act.user_id = j.id and act.d = j.d + 7))::int end as d7
      from joined j group by j.d order by j.d desc`);

    // What people did in the last 7 days: [label, table/where] -> times and distinct players.
    const since = sql`now() - interval '7 days'`;
    const ledger = (label: string, where: ReturnType<typeof sql>) =>
      sql`select ${label} as label, count(*)::int as times, count(distinct user_id)::int as players from game_ledger_entries where created_at > ${since} and user_id in ${players} and ${where}`;
    const table = (label: string, from: ReturnType<typeof sql>, who: ReturnType<typeof sql>, at: ReturnType<typeof sql>) =>
      sql`select ${label} as label, count(*)::int as times, count(distinct ${who})::int as players from ${from} where ${at} > ${since} and ${who} in ${players}`;
    const use = await rows<{ label: string; times: number; players: number }>(sql`
      ${ledger("Shifts worked", sql`kind = 'shift_pay'`)}
      union all ${ledger("Rides, coaches and flights", sql`kind in ('ride', 'coach')`)}
      union all ${ledger("Things bought for home", sql`kind = 'home_item'`)}
      union all ${ledger("Cooked or ordered food at home", sql`kind = 'home_life'`)}
      union all ${ledger("Houses and land bought", sql`kind in ('house', 'land')`)}
      union all ${ledger("Quests claimed", sql`kind in ('quest_reward', 'intro_reward')`)}
      union all ${table("People met (Love)", sql`partner_bonds`, sql`user_id`, sql`created_at`)}
      union all ${ledger("Dates", sql`kind = 'love' and reference like 'love:date:%'`)}
      union all ${ledger("Gifts", sql`kind = 'love' and reference like 'love:gift:%'`)}
      union all ${ledger("Weddings", sql`kind = 'love' and reference like 'love:wedding:%'`)}
      union all ${table("Parties thrown", sql`house_parties`, sql`host_id`, sql`starts_at`)}
      union all ${table("Party guests", sql`party_guests`, sql`user_id`, sql`joined_at`)}
      union all ${table("Pets adopted", sql`player_pets`, sql`user_id`, sql`adopted_at`)}
      union all ${ledger("Pets fed", sql`kind = 'pet' and reference like 'pet:feed:%'`)}
      union all ${table("Hustle board jobs posted", sql`hustle_jobs`, sql`poster_id`, sql`created_at`)}`);

    const love = await rows<{ stage: string; n: number }>(sql`select stage, count(*)::int as n from partner_bonds where user_id in ${players} group by stage`);
    const pets = await rows<{ kind: string; n: number }>(sql`select kind, count(*)::int as n from player_pets where user_id in ${players} group by kind`);
    const [r] = await rows<{ newBugs: number; newIdeas: number; errors7d: number }>(sql`
      select count(*) filter (where kind = 'bug' and status = 'new')::int as "newBugs",
        count(*) filter (where kind = 'idea' and status = 'new')::int as "newIdeas",
        count(*) filter (where kind = 'error' and last_at > ${since})::int as "errors7d"
      from feedback`);

    return {
      day: today,
      players: p as StatsView["players"],
      daily,
      cohorts,
      use,
      love: Object.fromEntries(love.map((x) => [x.stage, x.n])),
      pets: Object.fromEntries(pets.map((x) => [x.kind, x.n])),
      reports: r!,
    };
  });
}
