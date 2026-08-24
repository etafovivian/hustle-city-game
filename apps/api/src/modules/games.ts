// Games: Ayo against the computer (the server replays your moves to confirm a win, then rewards a few wins a day)
// and live Ayo with a friend (games kept in memory while you play).

import { gameLedgerEntries, profiles } from "@hc/db";
import { AYO_WIN, AYO_WINS_PER_DAY, ayoMoves, ayoPlay, ayoReplayVsComputer, ayoStart, dayKey, poolShoot, poolStart, type AyoState, type PoolState } from "@hc/shared";
import { createHash, randomUUID } from "node:crypto";
import { and, count, eq, like, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import { lockProfile } from "../lib/db.js";
import { AppError, notFound } from "../lib/errors.js";
import { requireUser } from "../plugins/auth.js";
import { nicknameOf, onlineByNick, sendPing } from "./presence.js";

interface LiveGame {
  id: string;
  players: [string, string];
  names: [string, string];
  state: AyoState;
  updated: number;
}

export async function playRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const live = new Map<string, LiveGame>();

  app.post("/api/games/ayo/win", async (request) => {
    const user = requireUser(request);
    const { moves } = z.object({ moves: z.array(z.number().int().min(0).max(11)).max(400) }).parse(request.body);
    const end = ayoReplayVsComputer(moves);
    if (!end || !end.over || end.winner !== 0) throw new AppError(400, "not_a_win", "That game wasn't a win.");
    const now = new Date();
    const day = dayKey(now, tz);
    const hash = createHash("sha256").update(moves.join(",")).digest("hex").slice(0, 16);
    return app.db.transaction(async (tx) => {
      await lockProfile(tx, user.id);
      const [{ n }] = (await tx
        .select({ n: count() })
        .from(gameLedgerEntries)
        .where(and(eq(gameLedgerEntries.userId, user.id), like(gameLedgerEntries.reference, `ayo:${day}:%`)))) as [{ n: number }];
      if (Number(n) >= AYO_WINS_PER_DAY) return { rewarded: false, message: "Well played! (Today's win rewards are used up.)" };
      const posting = await postCoins(tx, user.id, AYO_WIN.coins, "game_reward", `ayo:${day}:${hash}`);
      if (posting.applied) await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${AYO_WIN.xp}` }).where(eq(profiles.userId, user.id));
      return { rewarded: posting.applied, message: posting.applied ? `You won! +${AYO_WIN.coins} coins, +${AYO_WIN.xp} XP` : "You already claimed that game." };
    });
  });

  // ── Live games with a friend ──
  const view = (g: LiveGame, userId: string) => ({ id: g.id, names: g.names, state: g.state, you: g.players.indexOf(userId) as 0 | 1, moves: ayoMoves(g.state) });
  const prune = () => {
    const now = Date.now();
    for (const [id, g] of live) if (now - g.updated > 2 * 60 * 60_000) live.delete(id);
  };

  app.post("/api/games/ayo/challenge", async (request, reply) => {
    const user = requireUser(request);
    const { to } = z.object({ to: z.string().max(30) }).parse(request.body);
    const them = onlineByNick(to.replace(/^@/, ""));
    const meName = nicknameOf(user.id);
    if (!them || !meName || them.userId === user.id) throw new AppError(404, "not_here", "They need to be online to play.");
    prune();
    const g: LiveGame = { id: randomUUID(), players: [user.id, them.userId], names: [meName, them.nickname], state: ayoStart(), updated: Date.now() };
    live.set(g.id, g);
    sendPing(them.userId, { from: meName, kind: "challenge", place: null, text: g.id });
    return reply.code(201).send(view(g, user.id));
  });

  app.get<{ Params: { id: string } }>("/api/games/ayo/:id", async (request) => {
    const user = requireUser(request);
    const g = live.get(request.params.id);
    if (!g || !g.players.includes(user.id)) throw notFound("Game");
    return view(g, user.id);
  });

  app.post<{ Params: { id: string } }>("/api/games/ayo/:id/move", async (request) => {
    const user = requireUser(request);
    const { pit } = z.object({ pit: z.number().int().min(0).max(11) }).parse(request.body);
    const g = live.get(request.params.id);
    if (!g || !g.players.includes(user.id)) throw notFound("Game");
    if (g.players[g.state.turn] !== user.id) throw new AppError(409, "not_your_turn", "Wait for your turn.");
    if (!ayoMoves(g.state).includes(pit)) throw new AppError(400, "illegal", "You can't play that pit.");
    g.state = ayoPlay(g.state, pit);
    g.updated = Date.now();
    return view(g, user.id);
  });

  // ── Live snooker with a friend: the server plays each shot with the shared physics and decides. ──
  interface LivePool {
    id: string;
    players: [string, string];
    names: [string, string];
    /** The table before the last shot, and the shot, so the other phone can animate it. */
    before: PoolState;
    last: { angle: number; power: number } | null;
    state: PoolState;
    updated: number;
  }
  const tables = new Map<string, LivePool>();
  const poolView = (g: LivePool, userId: string) => ({ id: g.id, names: g.names, you: g.players.indexOf(userId) as 0 | 1, state: g.state, before: g.before, last: g.last });

  app.post("/api/games/snooker/challenge", async (request, reply) => {
    const user = requireUser(request);
    const { to } = z.object({ to: z.string().max(30) }).parse(request.body);
    const them = onlineByNick(to.replace(/^@/, ""));
    const meName = nicknameOf(user.id);
    if (!them || !meName || them.userId === user.id) throw new AppError(404, "not_here", "They need to be online to play.");
    const now = Date.now();
    for (const [id, t] of tables) if (now - t.updated > 2 * 60 * 60_000) tables.delete(id);
    const start = poolStart();
    const g: LivePool = { id: randomUUID(), players: [user.id, them.userId], names: [meName, them.nickname], before: start, last: null, state: start, updated: now };
    tables.set(g.id, g);
    sendPing(them.userId, { from: meName, kind: "challenge", place: null, text: `snooker:${g.id}` });
    return reply.code(201).send(poolView(g, user.id));
  });

  app.get<{ Params: { id: string } }>("/api/games/snooker/:id", async (request) => {
    const user = requireUser(request);
    const g = tables.get(request.params.id);
    if (!g || !g.players.includes(user.id)) throw notFound("Game");
    return poolView(g, user.id);
  });

  app.post<{ Params: { id: string } }>("/api/games/snooker/:id/shot", async (request) => {
    const user = requireUser(request);
    const { angle, power } = z.object({ angle: z.number().finite().min(-10).max(10), power: z.number().min(0).max(1) }).parse(request.body);
    const g = tables.get(request.params.id);
    if (!g || !g.players.includes(user.id)) throw notFound("Game");
    if (g.state.over) throw new AppError(409, "over", "That game is finished.");
    if (g.players[g.state.turn] !== user.id) throw new AppError(409, "not_your_turn", "Wait for your turn.");
    g.before = g.state;
    g.last = { angle, power };
    g.state = poolShoot(g.state, angle, power);
    g.updated = Date.now();
    return poolView(g, user.id);
  });
}
