/**
 * Starts the market notification poller.
 *
 * Reads configuration from environment variables and begins polling the
 * `market_notifications` outbox table at the configured interval. Pending
 * notifications are grouped by store, formatted as Markdown chunks under
 * Root message limits, and sent incrementally to the configured Root community
 * channel.
 */
export declare function startMarketNotifier(): void;
