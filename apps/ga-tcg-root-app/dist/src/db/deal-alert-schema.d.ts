/**
 * Tracks the single rolling deal-alert message for one recipient on one
 * destination (Discord DM or a Root private channel) so the bot can delete or
 * replace the previous snapshot before sending an updated one. `lastListingKeys`
 * holds a JSON array of the listing identities shown in the last snapshot and is
 * used to detect whether the match list has changed.
 *
 * Keyed by `(destination, recipientId)` so a single table serves every platform:
 * `recipientId` is the Discord user id for `discord-dm` and the Root user id for
 * `root-alert`.
 */
export declare const dealAlertMessages: import("drizzle-orm/sqlite-core").SQLiteTableWithColumns<{
    name: "deal_alert_messages";
    schema: undefined;
    columns: {
        destination: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "destination";
            tableName: "deal_alert_messages";
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
        recipientId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "recipient_id";
            tableName: "deal_alert_messages";
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
        channelId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "channel_id";
            tableName: "deal_alert_messages";
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
        messageId: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "message_id";
            tableName: "deal_alert_messages";
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
        lastListingKeys: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "last_listing_keys";
            tableName: "deal_alert_messages";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, object>;
        updatedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "updated_at";
            tableName: "deal_alert_messages";
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
export type DealAlertMessageRow = typeof dealAlertMessages.$inferSelect;
export type InsertDealAlertMessageRow = typeof dealAlertMessages.$inferInsert;
