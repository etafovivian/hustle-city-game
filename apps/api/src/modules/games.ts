// Games: Ayo and chess against the computer (the server replays your moves to confirm a win, then rewards a few wins
// a day), and live tables: Ayo, snooker and chess with another player. A table can be set at a place (the snooker
// spot, the hangout…): sit down and wait, and anyone there can join, or challenge someone by name; others watch.
// Live tables are kept in memory while you play.

import { gameLedgerEntries, profiles } from "@hc/db";
import { AYO_WIN, AYO_WINS_PER_DAY, ayoMoves, ayoPlay, ayoReplayVsComputer, ayoStart, CHESS_CPU_DEPTH, chessBest, chessLegal, chessPlay, chessResign, chessStart, dayKey, poolShoot, poolStart, type AyoState, type ChessMove, type ChessState, type PoolState, type TableGame, PLAY_NIGHT } from "@hc/shared";
import { createHash, randomUUID } from "node:crypto";
import { and, count, eq, like, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import { lockProfile } from "../lib/db.js";
import { AppError, notFound } from "../lib/errors.js";
import { requireUser } from "../plugins/auth.js";
import { nicknameOf, onlineByNick, sendPing } from "./presence.js";
import { playNightAt } from "./crew.js";

type TableState = AyoState | PoolState | ChessState;
interface Table {
  id: string;
  game: TableGame;
  /** The place the table is at (null: played on the phone). */
  place: string | null;
  /** Seat 1 is empty while the table waits for someone to join. */
  players: [string, string | null];
  names: [string, string | null];
  state: TableState;
  /** Snooker: the table before the last shot, and the shot, so every phone can animate it. */
  before: PoolState | null;
  last: { angle: number; power: number; spin: number } | null;
  updated: number;
}
const START: Record<TableGame, () => TableState> = { ayo: ayoStart, snooker: poolStart, chess: chessStart };
const LABEL: Record<TableGame, string> = { ayo: "Ayo", snooker: "snooker", chess: "chess" };
const move = z.object({ from: z.number().int().min(0).max(63), to: z.number().int().min(0).max(63), promo: z.enum(["q", "r", "b", "n"]).optional() });

export async function playRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const tables = new Map<string, Table>();

  app.post("/api/games/ayo/win", async (request) => {
    const user = requireUser(request);
    const { moves } = z.object({ moves: z.array(z.number().int().min(0).max(11)).max(400) }).parse(request.body);
    const end = ayoReplayVsComputer(moves);
    if (!end || !end.over || end.winner !== 0) throw new AppError(400, "not_a_win", "That game wasn't a win.");
    return reward(user.id, "ayo", moves.join(","));
  });

  // Chess against the Professor: replay the game; your moves must be legal and the computer's must be the ones it plays.
  app.post("/api/games/chess/win", async (request) => {
    const user = requireUser(request);
    const { moves } = z.object({ moves: z.array(move).max(600) }).parse(request.body);
    let s = chessStart();
    for (const [i, m] of moves.entries()) {
      if (s.over) break;
      if (i % 2 === 1) {
        const cpu = chessBest(s, CHESS_CPU_DEPTH, () => 0);
        if (cpu.from !== m.from || cpu.to !== m.to) throw new AppError(400, "not_a_win", "That game wasn't a win.");
      }
      if (!chessLegal(s, m)) throw new AppError(400, "not_a_win", "That game wasn't a win.");
      s = chessPlay(s, m);
    }
    if (!s.over || s.winner !== 0) throw new AppError(400, "not_a_win", "That game wasn't a win.");
    return reward(user.id, "chess", JSON.stringify(moves));
  });

  /** A few rewarded wins a day per game; the same game can't be claimed twice. */
  const reward = (userId: string, game: "ayo" | "chess", record: string) => {
    const now = new Date();
    const day = dayKey(now, tz);
    const hash = createHash("sha256").update(record).digest("hex").slice(0, 16);
    const prefix = game === "ayo" ? "ayo" : "chess";
    return app.db.transaction(async (tx) => {
      await lockProfile(tx, userId);
      const [{ n }] = (await tx
        .select({ n: count() })
        .from(gameLedgerEntries)
        .where(and(eq(gameLedgerEntries.userId, userId), like(gameLedgerEntries.reference, `${prefix}:${day}:%`)))) as [{ n: number }];
      if (Number(n) >= AYO_WINS_PER_DAY) return { rewarded: false, message: "Well played! (Today's win rewards are used up.)" };
      const posting = await postCoins(tx, userId, AYO_WIN.coins, "game_reward", `${prefix}:${day}:${hash}`);
      if (posting.applied) await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${AYO_WIN.xp}` }).where(eq(profiles.userId, userId));
      return { rewarded: posting.applied, message: posting.applied ? `You won! +${AYO_WIN.coins} coins, +${AYO_WIN.xp} XP` : "You already claimed that game." };
    });
  };

  // Play nights: a table game won at the place while it's on pays the winner (a few a night, once per game).
  const prized = new Set<string>();
  const prize = async (t: Table) => {
    const st = t.state as { over: boolean; winner: 0 | 1 | null };
    if (!st.over || st.winner === null || !t.place || !t.players[1] || prized.has(t.id)) return;
    const now = new Date();
    const night = playNightAt(t.place, now);
    if (!night) return;
    prized.add(t.id);
    const winner = t.players[st.winner]!;
    const day = dayKey(now, tz);
    await app.db.transaction(async (tx) => {
      await lockProfile(tx, winner);
      const [{ n }] = (await tx
        .select({ n: count() })
        .from(gameLedgerEntries)
        .where(and(eq(gameLedgerEntries.userId, winner), like(gameLedgerEntries.reference, `playnight:${day}:%`)))) as [{ n: number }];
      if (Number(n) >= PLAY_NIGHT.winsPerNight) return;
      const posting = await postCoins(tx, winner, PLAY_NIGHT.winCoins, "game_reward", `playnight:${day}:${t.id}`);
      if (posting.applied) sendPing(winner, { from: "Hustle City", kind: "note", place: t.place, text: `🏆 ${night.name} prize: +${PLAY_NIGHT.winCoins} coins for winning that ${LABEL[t.game]} game!` });
    });
  };

  // ── Live tables ──
  const view = (t: Table, userId: string) => {
    const seat = t.players.indexOf(userId);
    return {
      id: t.id,
      game: t.game,
      place: t.place,
      names: t.names,
      you: seat === 0 || seat === 1 ? (seat as 0 | 1) : null,
      waiting: t.players[1] === null,
      state: t.state,
      before: t.before,
      last: t.last,
      moves: t.game === "ayo" ? ayoMoves(t.state as AyoState) : undefined,
    };
  };
  const prune = () => {
    const now = Date.now();
    for (const [id, t] of tables) if (now - t.updated > (t.players[1] ? 2 * 60 * 60_000 : 20 * 60_000)) tables.delete(id);
  };
  const newTable = (game: TableGame, place: string | null, host: { id: string; name: string }, guest: { id: string; name: string } | null): Table => {
    prune();
    const state = START[game]();
    const t: Table = { id: randomUUID(), game, place, players: [host.id, guest?.id ?? null], names: [host.name, guest?.name ?? null], state, before: game === "snooker" ? (state as PoolState) : null, last: null, updated: Date.now() };
    tables.set(t.id, t);
    return t;
  };
  const gameParam = z.object({ game: z.enum(["ayo", "snooker", "chess"]) });
  const placeField = z.string().regex(/^[a-z0-9_@:+-]{2,60}$/i).nullable().optional();
  /** A table you're playing at (or 404), checked for your turn when `turn` is set. */
  const myTable = (id: string, userId: string, game: TableGame, turn = true) => {
    const t = tables.get(id);
    if (!t || t.game !== game || !t.players.includes(userId)) throw notFound("Game");
    if (!turn) return t;
    if (t.players[1] === null) throw new AppError(409, "waiting", "Wait for someone to sit down.");
    if ((t.state as { over: boolean }).over) throw new AppError(409, "over", "That game is finished.");
    if (t.players[(t.state as { turn: 0 | 1 }).turn] !== userId) throw new AppError(409, "not_your_turn", "Wait for your turn.");
    return t;
  };

  // Challenge someone by name (they must be online); their phone opens the game.
  app.post<{ Params: { game: string } }>("/api/games/:game/challenge", async (request, reply) => {
    const user = requireUser(request);
    const { game } = gameParam.parse(request.params);
    const { to, place } = z.object({ to: z.string().max(30), place: placeField }).parse(request.body);
    const them = onlineByNick(to.replace(/^@/, ""));
    const meName = nicknameOf(user.id);
    if (!them || !meName || them.userId === user.id) throw new AppError(404, "not_here", "They need to be online to play.");
    const t = newTable(game, place ?? null, { id: user.id, name: meName }, { id: them.userId, name: them.nickname });
    sendPing(them.userId, { from: meName, kind: "challenge", place: t.place, text: game === "ayo" ? t.id : `${game}:${t.id}` });
    return reply.code(201).send(view(t, user.id));
  });

  // Sit at a table at a place and wait: anyone there can join. One waiting table per player.
  app.post<{ Params: { game: string } }>("/api/games/:game/open", async (request, reply) => {
    const user = requireUser(request);
    const { game } = gameParam.parse(request.params);
    const { place } = z.object({ place: z.string().regex(/^[a-z0-9_@:+-]{2,60}$/i) }).parse(request.body);
    const meName = nicknameOf(user.id);
    if (!meName) throw new AppError(409, "offline", "Come online on the map first.");
    for (const [id, t] of tables) if (t.players[0] === user.id && t.players[1] === null) tables.delete(id);
    return reply.code(201).send(view(newTable(game, place, { id: user.id, name: meName }, null), user.id));
  });

  // The tables at a place: who's waiting for a partner, and games you can watch.
  app.get<{ Params: { place: string } }>("/api/games/at/:place", async (request) => {
    const user = requireUser(request);
    prune();
    return [...tables.values()]
      .filter((t) => t.place === request.params.place && !(t.state as { over: boolean }).over)
      .map((t) => ({ id: t.id, game: t.game, names: t.names, waiting: t.players[1] === null, mine: t.players.includes(user.id) }));
  });

  app.post<{ Params: { id: string } }>("/api/games/table/:id/join", async (request) => {
    const user = requireUser(request);
    const t = tables.get(request.params.id);
    const meName = nicknameOf(user.id);
    if (!t) throw notFound("Game");
    if (t.players.includes(user.id)) return view(t, user.id);
    if (t.players[1] !== null) throw new AppError(409, "taken", "Someone already sat down. Watch, or wait for the next game.");
    if (!meName) throw new AppError(409, "offline", "Come online on the map first.");
    t.players[1] = user.id;
    t.names[1] = meName;
    t.updated = Date.now();
    sendPing(t.players[0], { from: meName, kind: "join", place: t.place, text: `sat down to play ${LABEL[t.game]} with you` });
    return view(t, user.id);
  });

  // Leave: an empty table is cleared; a game in play is resigned (the other player wins).
  app.post<{ Params: { id: string } }>("/api/games/table/:id/leave", async (request) => {
    const user = requireUser(request);
    const t = tables.get(request.params.id);
    if (!t || !t.players.includes(user.id)) throw notFound("Game");
    const st = t.state as { over: boolean };
    if (t.players[1] === null) tables.delete(t.id);
    else if (!st.over) {
      const seat = t.players.indexOf(user.id) as 0 | 1;
      t.state = t.game === "chess" ? chessResign(t.state as ChessState, seat) : ({ ...(t.state as object), over: true, winner: seat === 0 ? 1 : 0, note: `@${t.names[seat]} left the table.` } as TableState);
      t.updated = Date.now();
    }
    return { ok: true };
  });

  // Anyone can look at a table (players and people watching).
  app.get<{ Params: { game: string; id: string } }>("/api/games/:game/:id", async (request) => {
    const user = requireUser(request);
    const { game } = gameParam.parse(request.params);
    const t = tables.get(request.params.id);
    if (!t || t.game !== game) throw notFound("Game");
    return view(t, user.id);
  });

  app.post<{ Params: { id: string } }>("/api/games/ayo/:id/move", async (request) => {
    const user = requireUser(request);
    const { pit } = z.object({ pit: z.number().int().min(0).max(11) }).parse(request.body);
    const t = myTable(request.params.id, user.id, "ayo");
    if (!ayoMoves(t.state as AyoState).includes(pit)) throw new AppError(400, "illegal", "You can't play that pit.");
    t.state = ayoPlay(t.state as AyoState, pit);
    t.updated = Date.now();
    await prize(t);
    return view(t, user.id);
  });

  app.post<{ Params: { id: string } }>("/api/games/chess/:id/move", async (request) => {
    const user = requireUser(request);
    const m: ChessMove = move.parse(request.body);
    const t = myTable(request.params.id, user.id, "chess");
    if (!chessLegal(t.state as ChessState, m)) throw new AppError(400, "illegal", "That piece can't go there.");
    t.state = chessPlay(t.state as ChessState, m);
    t.updated = Date.now();
    await prize(t);
    return view(t, user.id);
  });

  // Snooker: the server plays each shot with the shared physics and decides.
  app.post<{ Params: { id: string } }>("/api/games/snooker/:id/shot", async (request) => {
    const user = requireUser(request);
    const { angle, power, spin } = z.object({ angle: z.number().finite().min(-10).max(10), power: z.number().min(0).max(1), spin: z.number().min(-1).max(1).default(0) }).parse(request.body);
    const t = myTable(request.params.id, user.id, "snooker");
    t.before = t.state as PoolState;
    t.last = { angle, power, spin };
    t.state = poolShoot(t.state as PoolState, angle, power, spin);
    t.updated = Date.now();
    await prize(t);
    return view(t, user.id);
  });
}
