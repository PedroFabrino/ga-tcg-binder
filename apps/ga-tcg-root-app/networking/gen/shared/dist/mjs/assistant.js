import { WireType } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
// @generated message type with reflection information, may provide speed optimized methods
class StatusResponse$Type extends MessageType {
    constructor() {
        super("StatusResponse", [
            { no: 1, name: "is_linked", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
            { no: 2, name: "collector_id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 3, name: "collector_name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 4, name: "friend_code", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 5, name: "notifications_enabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
            { no: 6, name: "deal_alert_mode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 7, name: "alert_channel_id", kind: "scalar", T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value) {
        const message = globalThis.Object.create((this.messagePrototype));
        message.isLinked = false;
        message.collectorId = "";
        message.collectorName = "";
        message.friendCode = "";
        message.notificationsEnabled = false;
        message.dealAlertMode = "";
        message.alertChannelId = "";
        if (value !== undefined)
            reflectionMergePartial(this, message, value);
        return message;
    }
    internalBinaryRead(reader, length, options, target) {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* bool is_linked */ 1:
                    message.isLinked = reader.bool();
                    break;
                case /* string collector_id */ 2:
                    message.collectorId = reader.string();
                    break;
                case /* string collector_name */ 3:
                    message.collectorName = reader.string();
                    break;
                case /* string friend_code */ 4:
                    message.friendCode = reader.string();
                    break;
                case /* bool notifications_enabled */ 5:
                    message.notificationsEnabled = reader.bool();
                    break;
                case /* string deal_alert_mode */ 6:
                    message.dealAlertMode = reader.string();
                    break;
                case /* string alert_channel_id */ 7:
                    message.alertChannelId = reader.string();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message, writer, options) {
        /* bool is_linked = 1; */
        if (message.isLinked !== false)
            writer.tag(1, WireType.Varint).bool(message.isLinked);
        /* string collector_id = 2; */
        if (message.collectorId !== "")
            writer.tag(2, WireType.LengthDelimited).string(message.collectorId);
        /* string collector_name = 3; */
        if (message.collectorName !== "")
            writer.tag(3, WireType.LengthDelimited).string(message.collectorName);
        /* string friend_code = 4; */
        if (message.friendCode !== "")
            writer.tag(4, WireType.LengthDelimited).string(message.friendCode);
        /* bool notifications_enabled = 5; */
        if (message.notificationsEnabled !== false)
            writer.tag(5, WireType.Varint).bool(message.notificationsEnabled);
        /* string deal_alert_mode = 6; */
        if (message.dealAlertMode !== "")
            writer.tag(6, WireType.LengthDelimited).string(message.dealAlertMode);
        /* string alert_channel_id = 7; */
        if (message.alertChannelId !== "")
            writer.tag(7, WireType.LengthDelimited).string(message.alertChannelId);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message StatusResponse
 */
export const StatusResponse = new StatusResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LinkRequest$Type extends MessageType {
    constructor() {
        super("LinkRequest", [
            { no: 1, name: "code", kind: "scalar", T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value) {
        const message = globalThis.Object.create((this.messagePrototype));
        message.code = "";
        if (value !== undefined)
            reflectionMergePartial(this, message, value);
        return message;
    }
    internalBinaryRead(reader, length, options, target) {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string code */ 1:
                    message.code = reader.string();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message, writer, options) {
        /* string code = 1; */
        if (message.code !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.code);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message LinkRequest
 */
export const LinkRequest = new LinkRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class LinkResponse$Type extends MessageType {
    constructor() {
        super("LinkResponse", [
            { no: 1, name: "success", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
            { no: 2, name: "collector_name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 3, name: "error", kind: "scalar", T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value) {
        const message = globalThis.Object.create((this.messagePrototype));
        message.success = false;
        message.collectorName = "";
        message.error = "";
        if (value !== undefined)
            reflectionMergePartial(this, message, value);
        return message;
    }
    internalBinaryRead(reader, length, options, target) {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* bool success */ 1:
                    message.success = reader.bool();
                    break;
                case /* string collector_name */ 2:
                    message.collectorName = reader.string();
                    break;
                case /* string error */ 3:
                    message.error = reader.string();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message, writer, options) {
        /* bool success = 1; */
        if (message.success !== false)
            writer.tag(1, WireType.Varint).bool(message.success);
        /* string collector_name = 2; */
        if (message.collectorName !== "")
            writer.tag(2, WireType.LengthDelimited).string(message.collectorName);
        /* string error = 3; */
        if (message.error !== "")
            writer.tag(3, WireType.LengthDelimited).string(message.error);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message LinkResponse
 */
export const LinkResponse = new LinkResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PreferencesRequest$Type extends MessageType {
    constructor() {
        super("PreferencesRequest", [
            { no: 1, name: "notifications_enabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
            { no: 2, name: "deal_alert_mode", kind: "scalar", T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value) {
        const message = globalThis.Object.create((this.messagePrototype));
        message.notificationsEnabled = false;
        message.dealAlertMode = "";
        if (value !== undefined)
            reflectionMergePartial(this, message, value);
        return message;
    }
    internalBinaryRead(reader, length, options, target) {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* bool notifications_enabled */ 1:
                    message.notificationsEnabled = reader.bool();
                    break;
                case /* string deal_alert_mode */ 2:
                    message.dealAlertMode = reader.string();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message, writer, options) {
        /* bool notifications_enabled = 1; */
        if (message.notificationsEnabled !== false)
            writer.tag(1, WireType.Varint).bool(message.notificationsEnabled);
        /* string deal_alert_mode = 2; */
        if (message.dealAlertMode !== "")
            writer.tag(2, WireType.LengthDelimited).string(message.dealAlertMode);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message PreferencesRequest
 */
export const PreferencesRequest = new PreferencesRequest$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PreferencesResponse$Type extends MessageType {
    constructor() {
        super("PreferencesResponse", [
            { no: 1, name: "success", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
            { no: 2, name: "notifications_enabled", kind: "scalar", T: 8 /*ScalarType.BOOL*/ },
            { no: 3, name: "deal_alert_mode", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 4, name: "alert_channel_id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 5, name: "error", kind: "scalar", T: 9 /*ScalarType.STRING*/ }
        ]);
    }
    create(value) {
        const message = globalThis.Object.create((this.messagePrototype));
        message.success = false;
        message.notificationsEnabled = false;
        message.dealAlertMode = "";
        message.alertChannelId = "";
        message.error = "";
        if (value !== undefined)
            reflectionMergePartial(this, message, value);
        return message;
    }
    internalBinaryRead(reader, length, options, target) {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* bool success */ 1:
                    message.success = reader.bool();
                    break;
                case /* bool notifications_enabled */ 2:
                    message.notificationsEnabled = reader.bool();
                    break;
                case /* string deal_alert_mode */ 3:
                    message.dealAlertMode = reader.string();
                    break;
                case /* string alert_channel_id */ 4:
                    message.alertChannelId = reader.string();
                    break;
                case /* string error */ 5:
                    message.error = reader.string();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message, writer, options) {
        /* bool success = 1; */
        if (message.success !== false)
            writer.tag(1, WireType.Varint).bool(message.success);
        /* bool notifications_enabled = 2; */
        if (message.notificationsEnabled !== false)
            writer.tag(2, WireType.Varint).bool(message.notificationsEnabled);
        /* string deal_alert_mode = 3; */
        if (message.dealAlertMode !== "")
            writer.tag(3, WireType.LengthDelimited).string(message.dealAlertMode);
        /* string alert_channel_id = 4; */
        if (message.alertChannelId !== "")
            writer.tag(4, WireType.LengthDelimited).string(message.alertChannelId);
        /* string error = 5; */
        if (message.error !== "")
            writer.tag(5, WireType.LengthDelimited).string(message.error);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message PreferencesResponse
 */
export const PreferencesResponse = new PreferencesResponse$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeckShortageCard$Type extends MessageType {
    constructor() {
        super("DeckShortageCard", [
            { no: 1, name: "card_slug", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "card_name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 3, name: "quantity", kind: "scalar", T: 5 /*ScalarType.INT32*/ }
        ]);
    }
    create(value) {
        const message = globalThis.Object.create((this.messagePrototype));
        message.cardSlug = "";
        message.cardName = "";
        message.quantity = 0;
        if (value !== undefined)
            reflectionMergePartial(this, message, value);
        return message;
    }
    internalBinaryRead(reader, length, options, target) {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string card_slug */ 1:
                    message.cardSlug = reader.string();
                    break;
                case /* string card_name */ 2:
                    message.cardName = reader.string();
                    break;
                case /* int32 quantity */ 3:
                    message.quantity = reader.int32();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message, writer, options) {
        /* string card_slug = 1; */
        if (message.cardSlug !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.cardSlug);
        /* string card_name = 2; */
        if (message.cardName !== "")
            writer.tag(2, WireType.LengthDelimited).string(message.cardName);
        /* int32 quantity = 3; */
        if (message.quantity !== 0)
            writer.tag(3, WireType.Varint).int32(message.quantity);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message DeckShortageCard
 */
export const DeckShortageCard = new DeckShortageCard$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DeckSummary$Type extends MessageType {
    constructor() {
        super("DeckSummary", [
            { no: 1, name: "id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "name", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 3, name: "champion", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 4, name: "format", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 5, name: "total_cards", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
            { no: 6, name: "hard_shortages_count", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
            { no: 7, name: "shared_shortages_count", kind: "scalar", T: 5 /*ScalarType.INT32*/ },
            { no: 8, name: "hard_shortages", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => DeckShortageCard },
            { no: 9, name: "shared_shortages", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => DeckShortageCard }
        ]);
    }
    create(value) {
        const message = globalThis.Object.create((this.messagePrototype));
        message.id = "";
        message.name = "";
        message.champion = "";
        message.format = "";
        message.totalCards = 0;
        message.hardShortagesCount = 0;
        message.sharedShortagesCount = 0;
        message.hardShortages = [];
        message.sharedShortages = [];
        if (value !== undefined)
            reflectionMergePartial(this, message, value);
        return message;
    }
    internalBinaryRead(reader, length, options, target) {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string id */ 1:
                    message.id = reader.string();
                    break;
                case /* string name */ 2:
                    message.name = reader.string();
                    break;
                case /* string champion */ 3:
                    message.champion = reader.string();
                    break;
                case /* string format */ 4:
                    message.format = reader.string();
                    break;
                case /* int32 total_cards */ 5:
                    message.totalCards = reader.int32();
                    break;
                case /* int32 hard_shortages_count */ 6:
                    message.hardShortagesCount = reader.int32();
                    break;
                case /* int32 shared_shortages_count */ 7:
                    message.sharedShortagesCount = reader.int32();
                    break;
                case /* repeated DeckShortageCard hard_shortages */ 8:
                    message.hardShortages.push(DeckShortageCard.internalBinaryRead(reader, reader.uint32(), options));
                    break;
                case /* repeated DeckShortageCard shared_shortages */ 9:
                    message.sharedShortages.push(DeckShortageCard.internalBinaryRead(reader, reader.uint32(), options));
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message, writer, options) {
        /* string id = 1; */
        if (message.id !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.id);
        /* string name = 2; */
        if (message.name !== "")
            writer.tag(2, WireType.LengthDelimited).string(message.name);
        /* string champion = 3; */
        if (message.champion !== "")
            writer.tag(3, WireType.LengthDelimited).string(message.champion);
        /* string format = 4; */
        if (message.format !== "")
            writer.tag(4, WireType.LengthDelimited).string(message.format);
        /* int32 total_cards = 5; */
        if (message.totalCards !== 0)
            writer.tag(5, WireType.Varint).int32(message.totalCards);
        /* int32 hard_shortages_count = 6; */
        if (message.hardShortagesCount !== 0)
            writer.tag(6, WireType.Varint).int32(message.hardShortagesCount);
        /* int32 shared_shortages_count = 7; */
        if (message.sharedShortagesCount !== 0)
            writer.tag(7, WireType.Varint).int32(message.sharedShortagesCount);
        /* repeated DeckShortageCard hard_shortages = 8; */
        for (let i = 0; i < message.hardShortages.length; i++)
            DeckShortageCard.internalBinaryWrite(message.hardShortages[i], writer.tag(8, WireType.LengthDelimited).fork(), options).join();
        /* repeated DeckShortageCard shared_shortages = 9; */
        for (let i = 0; i < message.sharedShortages.length; i++)
            DeckShortageCard.internalBinaryWrite(message.sharedShortages[i], writer.tag(9, WireType.LengthDelimited).fork(), options).join();
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message DeckSummary
 */
export const DeckSummary = new DeckSummary$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DecksResponse$Type extends MessageType {
    constructor() {
        super("DecksResponse", [
            { no: 1, name: "decks", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => DeckSummary }
        ]);
    }
    create(value) {
        const message = globalThis.Object.create((this.messagePrototype));
        message.decks = [];
        if (value !== undefined)
            reflectionMergePartial(this, message, value);
        return message;
    }
    internalBinaryRead(reader, length, options, target) {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* repeated DeckSummary decks */ 1:
                    message.decks.push(DeckSummary.internalBinaryRead(reader, reader.uint32(), options));
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message, writer, options) {
        /* repeated DeckSummary decks = 1; */
        for (let i = 0; i < message.decks.length; i++)
            DeckSummary.internalBinaryWrite(message.decks[i], writer.tag(1, WireType.LengthDelimited).fork(), options).join();
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message DecksResponse
 */
export const DecksResponse = new DecksResponse$Type();
//# sourceMappingURL=assistant.js.map