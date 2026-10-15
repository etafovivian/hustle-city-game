// "Bring your crew": every player has an invite link (?crew=<nickname>). A friend who joins with it starts with bonus
// coins and you're in each other's contacts; once they've really played (some XP), you get a reward, up to a cap.
export const CREW = {
  /** Coins the new player gets for joining with a link. */
  welcome: 1_000,
  /** What the inviter gets when the friend has played. */
  reward: 2_000,
  rewardXp: 100,
  /** XP the friend needs before the reward is paid (a few activities, a lecture or a shift). */
  qualifyXp: 150,
  /** Rewarded invites per player. */
  maxRewards: 20,
};
export interface CrewView {
  code: string;
  friends: { nickname: string; played: boolean }[];
  rewarded: number;
}
