// Buy mode: furniture and appliances players place on their shop floor with City Coins.
// Each item adds "appeal"; total appeal gives a small, capped boost to NPC demand.

export interface DecorItem {
  key: string;
  name: string;
  category: "seating" | "power" | "comfort" | "utility";
  /** Price in City Coins (no cash value). */
  price: number;
  /** Footprint in floor tiles at rotation 0 (swapped for odd rotations). */
  w: number;
  h: number;
  appeal: number;
  /**
   * Art per rotation step. Four entries give a true 4-way turn; one entry is mirrored
   * for odd rotations.
   */
  views: string[];
}

export const SHOP_FLOOR = { cols: 8, rows: 6 } as const;

/** Each appeal point adds 1% NPC demand, capped at +20%. */
export const APPEAL = { perPoint: 0.01, maxBoost: 0.2 } as const;

/** Selling an item refunds this share of its price. */
export const DECOR_REFUND_SHARE = 0.5;

const art = (path: string) => `/art/furniture/${path}.webp`;

export const DECOR_ITEMS: readonly DecorItem[] = [
  {
    key: "plastic_chair",
    name: "Plastic chair",
    category: "seating",
    price: 150,
    w: 1,
    h: 1,
    appeal: 1,
    views: [art("plastic-chair-34"), art("plastic-chair-side"), art("plastic-chair-back"), art("plastic-chair-front")],
  },
  { key: "plastic_chair_classic", name: "Classic plastic chair", category: "seating", price: 120, w: 1, h: 1, appeal: 1, views: [art("plastic-chair-classic")] },
  { key: "bucket_set", name: "Bucket and bowl set", category: "utility", price: 80, w: 1, h: 1, appeal: 1, views: [art("bucket-set")] },
  { key: "standing_fan", name: "Standing fan", category: "comfort", price: 300, w: 1, h: 1, appeal: 2, views: [art("standing-fan")] },
  { key: "generator_small", name: "Small generator", category: "power", price: 700, w: 1, h: 1, appeal: 3, views: [art("generator-small")] },
  {
    key: "generator",
    name: "Big generator",
    category: "power",
    price: 1200,
    w: 2,
    h: 1,
    appeal: 5,
    views: [art("generator-34"), art("generator-side"), art("generator-back"), art("generator-front")],
  },
  { key: "sofa_ankara", name: "Sofa with Ankara cushions", category: "comfort", price: 900, w: 2, h: 1, appeal: 4, views: [art("sofa-ankara-cushions")] },
  { key: "adire_sofa_set", name: "Adire lounge set", category: "comfort", price: 2500, w: 3, h: 2, appeal: 8, views: [art("adire-sofa-set")] },
];

export const DECOR_BY_KEY: ReadonlyMap<string, DecorItem> = new Map(DECOR_ITEMS.map((i) => [i.key, i]));

export interface Placement {
  itemKey: string;
  x: number;
  y: number;
  /** 0–3, quarter turns. */
  rotation: number;
}

/** Tiles covered by a placement, after rotation. */
export function footprint(p: Placement): { x: number; y: number; w: number; h: number } | null {
  const item = DECOR_BY_KEY.get(p.itemKey);
  if (!item) return null;
  const odd = p.rotation % 2 === 1;
  return { x: p.x, y: p.y, w: odd ? item.h : item.w, h: odd ? item.w : item.h };
}

/** Null when valid; otherwise the reason. `others` must exclude the placement being moved. */
export function placementProblem(p: Placement, others: readonly Placement[]): string | null {
  if (!Number.isInteger(p.rotation) || p.rotation < 0 || p.rotation > 3) return "Rotation must be 0–3.";
  if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return "Pick a floor tile.";
  const f = footprint(p);
  if (!f) return "Unknown item.";
  if (f.x < 0 || f.y < 0 || f.x + f.w > SHOP_FLOOR.cols || f.y + f.h > SHOP_FLOOR.rows) return "That doesn't fit on the floor there.";
  for (const o of others) {
    const g = footprint(o);
    if (g && f.x < g.x + g.w && g.x < f.x + f.w && f.y < g.y + g.h && g.y < f.y + f.h) return "Something is already there.";
  }
  return null;
}

export function appealOf(placements: readonly Placement[]): number {
  return placements.reduce((sum, p) => sum + (DECOR_BY_KEY.get(p.itemKey)?.appeal ?? 0), 0);
}

export function demandBoost(appeal: number): number {
  return Math.min(APPEAL.maxBoost, appeal * APPEAL.perPoint);
}
