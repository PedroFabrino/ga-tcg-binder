/**
 * One row per app install in a community. Holds the hash of the per-install
 * API token the Root bot uses to authenticate to the Root bot API. The raw
 * token is never stored; the bot keeps it in Root's per-install key-value
 * store (`dataStore.appData`).
 */
export declare const rootBotInstalls: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "root_bot_installs";
    schema: undefined;
    columns: {
        appId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "app_id";
            tableName: "root_bot_installs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        communityId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "community_id";
            tableName: "root_bot_installs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        tokenHash: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "token_hash";
            tableName: "root_bot_installs";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "root_bot_installs";
            dataType: "date";
            columnType: "SQLiteTimestamp";
            data: Date;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        revokedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "revoked_at";
            tableName: "root_bot_installs";
            dataType: "date";
            columnType: "SQLiteTimestamp";
            data: Date;
            driverParam: number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
    };
    dialect: "sqlite";
}>;
export type RootBotInstallRow = typeof rootBotInstalls.$inferSelect;
export type InsertRootBotInstallRow = typeof rootBotInstalls.$inferInsert;
