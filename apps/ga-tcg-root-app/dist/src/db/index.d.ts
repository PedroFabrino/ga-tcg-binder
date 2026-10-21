import * as schema from "./schema";
export declare const client: import("@libsql/client/.").Client;
export declare const db: import("drizzle-orm/libsql").LibSQLDatabase<typeof schema> & {
    $client: import("@libsql/client/.").Client;
};
export declare function createInMemoryDb(): {
    client: import("@libsql/client/.").Client;
    db: import("drizzle-orm/libsql").LibSQLDatabase<typeof schema> & {
        $client: import("@libsql/client/.").Client;
    };
};
