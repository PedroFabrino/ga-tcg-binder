/**
 * The state key for a community's Root bot data. Market delivery and deal-alert
 * state use this so one community's ledger can never be read by another.
 */
export function rootBotDestination(communityId: string): string {
  return `root:${communityId}`;
}
