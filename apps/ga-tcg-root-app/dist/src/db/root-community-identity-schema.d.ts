/**
 * Which Root users have been seen in which community. Root identities are
 * global, so this mapping is what lets the Root bot API scope deal alerts (and
 * identity lookups) to the authenticated community instead of every install.
 */
export declare const rootCommunityIdentities: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "root_community_identities";
    schema: undefined;
    columns: {
        communityId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "community_id";
            tableName: "root_community_identities";
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
        providerUserId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "provider_user_id";
            tableName: "root_community_identities";
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
            tableName: "root_community_identities";
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
    };
    dialect: "sqlite";
}>;
export type RootCommunityIdentityRow = typeof rootCommunityIdentities.$inferSelect;
