// Pets (see @hc/shared pets.ts): adopt one, name it, and care for it. Happiness drifts down without care and is
// lifted by feeding, play and walks; a happy pet at home makes your nights less lonely.

import { playerPets } from "@hc/db";
import { PETS, PET_BY_KIND, PET_CARE, PET_DRIFT_PER_HOUR, PET_NAME, chatProblem, petMood, type PetCare, type PetKind, type PetView } from "@hc/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError, notFound } from "../../lib/errors.js";
import { requireUser } from "../../plugins/auth.js";
import { loadNeeds, needsView, saveNeeds } from "./needs.js";
import { recordEvents } from "./quests.js";

type Pet = typeof playerPets.$inferSelect;
const HOUR = 3_600_000;

/** Happiness now: what was saved, less the drift since. */
export const happinessOf = (p: Pet, now: Date) => Math.max(0, Math.round(p.happiness - ((now.getTime() - p.happyAt.getTime()) / HOUR) * PET_DRIFT_PER_HOUR));

function view(p: Pet, now: Date): PetView {
  const cared = p.cared as Partial<Record<PetCare, string>>;
  const next = Object.fromEntries(
    (Object.keys(PET_CARE) as PetCare[]).map((k) => {
      const at = cared[k] ? Date.parse(cared[k]!) + PET_CARE[k].everyHours * HOUR : 0;
      return [k, at > now.getTime() ? new Date(at).toISOString() : null];
    }),
  ) as Record<PetCare, string | null>;
  const h = happinessOf(p, now);
  return { kind: p.kind as PetKind, name: p.name, happiness: h, mood: petMood(h), next, adoptedAt: p.adoptedAt.toISOString() };
}

const nameOk = (raw: string) => {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!PET_NAME.test(name)) throw new AppError(400, "bad_name", "Names are letters only, up to 20.");
  if (chatProblem(name)) throw new AppError(400, "bad_name", "Pick a kinder name.");
  return name;
};

/** Your pet, if it's happy (for a better night at home). */
export async function happyPet(tx: Tx, userId: string, now: Date) {
  const [p] = await tx.select().from(playerPets).where(eq(playerPets.userId, userId));
  return p && petMood(happinessOf(p, now)) === "happy" ? p : null;
}

export async function petRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const inTx = <T>(fn: (tx: Tx, now: Date) => Promise<T>) => app.db.transaction((tx) => fn(tx, new Date()));
  const mine = async (tx: Tx, userId: string) => {
    const [p] = await tx.select().from(playerPets).where(eq(playerPets.userId, userId)).for("update");
    return p ?? null;
  };

  app.get("/api/pets", async (request) => {
    const user = requireUser(request);
    return inTx(async (tx, now) => {
      const p = await mine(tx, user.id);
      return { pet: p ? view(p, now) : null };
    });
  });

  app.post("/api/pets", async (request, reply) => {
    const user = requireUser(request);
    const body = z.object({ kind: z.enum(PETS.map((p) => p.kind) as [PetKind, ...PetKind[]]), name: z.string().max(40) }).parse(request.body);
    const name = nameOk(body.name);
    const info = PET_BY_KIND.get(body.kind)!;
    const result = await inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      if (await mine(tx, user.id)) throw new AppError(409, "has_pet", "You already have a pet. One is plenty of love for now.");
      const { balance } = await postCoins(tx, user.id, -info.cost, "pet", `pet:${user.id}:${now.toISOString()}`);
      const [p] = await tx.insert(playerPets).values({ userId: user.id, kind: body.kind, name, happiness: 80, happyAt: now, adoptedAt: now }).returning();
      return { balance, pet: view(p!, now) };
    });
    return reply.code(201).send(result);
  });

  app.put("/api/pets/name", async (request) => {
    const user = requireUser(request);
    const name = nameOk(z.object({ name: z.string().max(40) }).parse(request.body).name);
    return inTx(async (tx, now) => {
      const p = await mine(tx, user.id);
      if (!p) throw notFound("Pet");
      const [q] = await tx.update(playerPets).set({ name }).where(eq(playerPets.userId, user.id)).returning();
      return { pet: view(q!, now) };
    });
  });

  // Feed, play or walk: always welcome; it counts (happiness, your needs) once per its own few hours.
  app.post<{ Params: { care: string } }>("/api/pets/:care", async (request) => {
    const user = requireUser(request);
    const care = z.enum(Object.keys(PET_CARE) as [PetCare, ...PetCare[]]).parse(request.params.care);
    const c = PET_CARE[care];
    return inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const p = await mine(tx, user.id);
      if (!p) throw notFound("Pet");
      const cared = p.cared as Partial<Record<PetCare, string>>;
      const counts = !cared[care] || now.getTime() - Date.parse(cared[care]!) >= c.everyHours * HOUR;
      let balance: number | undefined;
      if (counts && c.cost) balance = (await postCoins(tx, user.id, -c.cost, "pet", `pet:${care}:${user.id}:${now.toISOString()}`)).balance;
      let needs;
      if (counts) {
        const n = await loadNeeds(tx, user.id, now);
        needs = { ...n.needs };
        for (const [k, v] of Object.entries(c.gives) as [keyof typeof needs, number][]) needs[k] = Math.min(100, needs[k] + v);
        await saveNeeds(tx, user.id, needs, now, n.freeAt);
      }
      if (counts) await recordEvents(tx, user.id, [{ type: "pet_cared", key: care }], now, tz);
      const happiness = Math.min(100, happinessOf(p, now) + (counts ? c.happy : 0));
      const [q] = await tx
        .update(playerPets)
        .set({ happiness, happyAt: now, cared: counts ? { ...cared, [care]: now.toISOString() } : cared })
        .where(eq(playerPets.userId, user.id))
        .returning();
      return { counted: counts, balance, ...(needs ? needsView(needs) : {}), pet: view(q!, now) };
    });
  });

  // Rehome: someone kind takes them in (no refund).
  app.delete("/api/pets", async (request) => {
    const user = requireUser(request);
    await app.db.delete(playerPets).where(eq(playerPets.userId, user.id));
    return { pet: null };
  });
}
