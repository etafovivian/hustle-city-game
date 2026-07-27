// Request/response shapes shared by the API and the web client.

import type { CustomerOrder } from "./economy.js";
import type { AvatarConfig } from "./profile.js";

export type Role = "player" | "business_owner" | "business_staff" | "admin";

export interface Me {
  id: string;
  email: string;
  nickname: string;
  nicknameHidden: boolean;
  avatar: AvatarConfig;
  roles: Role[];
  /** City Coins — game currency, no cash value. */
  coins: number;
  xp: number;
  hustle: string;
  dream: string;
}

export interface QuestView {
  key: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardXp: number;
  claimed: boolean;
}

export interface IntroStepView {
  label: string;
  target: number;
  progress: number;
}

export interface QuestBoard {
  day: string;
  daily: QuestView[];
  intro: {
    title: string;
    description: string;
    steps: IntroStepView[];
    rewardCoins: number;
    rewardXp: number;
    claimed: boolean;
  };
}

export interface ShopLineView {
  itemKey: string;
  name: string;
  quantity: number;
  price: number;
  wholesaleCost: number;
  referencePrice: number;
}

export interface ShopView {
  id: string;
  name: string;
  lines: ShopLineView[];
  /** Coins earned from NPC sales, waiting to be collected. */
  uncollected: number;
  /** Sales recorded by the settlement that ran for this request. */
  recentSales: { itemKey: string; units: number; revenue: number }[];
  order: (CustomerOrder & { fulfilled: boolean }) | null;
}

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  coinsEarned: number;
  isMe: boolean;
}

export interface BusinessSummary {
  id: string;
  name: string;
  kind: "retail" | "artisan" | "office";
  category: string;
  serviceArea: string;
  pickupAddress: string | null;
  description: string;
  isMock: boolean;
  products: ProductSummary[];
  /** Reviews from completed quote requests only. */
  rating: { average: number; count: number } | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  /** Price in kobo (integer). Display as NGN. */
  priceKobo: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  photoUrl: string | null;
}

export interface DecorPlacementView {
  id: string;
  itemKey: string;
  x: number;
  y: number;
  rotation: number;
}

export interface DecorView {
  floor: { cols: number; rows: number };
  placements: DecorPlacementView[];
  appeal: number;
  /** Demand boost from appeal, e.g. 0.12 = +12%. */
  boost: number;
}

/** A player's shop shown on the city map. */
export interface NeighbourShop {
  shopId: string;
  shopName: string;
  nickname: string;
  hustle: string;
  appeal: number;
  isMe: boolean;
}

/** Another player's shop as a visitor sees it: no balances, takings or exact stock counts. */
export interface ShopVisit {
  shopId: string;
  shopName: string;
  nickname: string;
  hustle: string;
  isMe: boolean;
  decor: DecorView;
  prices: { itemKey: string; name: string; price: number; inStock: boolean }[];
}

export interface ApiError {
  error: string;
  message: string;
}
