import { Crown, Gem, HandHeart, Trophy, type LucideIcon } from "lucide-react";

/** One icon per dream, shared by onboarding and the Phone's Dream app. */
export const DREAM_ICON: Record<string, LucideIcon> = { market_royalty: Crown, showroom: Gem, junction_legend: Trophy, padi: HandHeart };
export const dreamIcon = (key: string): LucideIcon => DREAM_ICON[key] ?? Trophy;
