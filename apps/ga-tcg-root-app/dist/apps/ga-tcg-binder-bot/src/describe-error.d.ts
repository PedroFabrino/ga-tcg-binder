/**
 * Renders an error and its `cause` chain on a single log line, exposing the
 * Root `errorCode` (RootApiException) and Node error codes such as
 * `UND_ERR_CONNECT_TIMEOUT` that `err.message` alone hides.
 */
export declare function describeError(err: unknown): string;
