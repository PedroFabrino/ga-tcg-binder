import type { BinaryWriteOptions } from "@protobuf-ts/runtime";
import type { IBinaryWriter } from "@protobuf-ts/runtime";
import type { BinaryReadOptions } from "@protobuf-ts/runtime";
import type { IBinaryReader } from "@protobuf-ts/runtime";
import type { PartialMessage } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
/**
 * @generated from protobuf message StatusResponse
 */
export interface StatusResponse {
    /**
     * @generated from protobuf field: bool is_linked = 1
     */
    isLinked: boolean;
    /**
     * @generated from protobuf field: string collector_id = 2
     */
    collectorId: string;
    /**
     * @generated from protobuf field: string collector_name = 3
     */
    collectorName: string;
    /**
     * @generated from protobuf field: string friend_code = 4
     */
    friendCode: string;
    /**
     * @generated from protobuf field: bool notifications_enabled = 5
     */
    notificationsEnabled: boolean;
    /**
     * @generated from protobuf field: string deal_alert_mode = 6
     */
    dealAlertMode: string;
    /**
     * @generated from protobuf field: string alert_channel_id = 7
     */
    alertChannelId: string;
}
/**
 * @generated from protobuf message LinkRequest
 */
export interface LinkRequest {
    /**
     * @generated from protobuf field: string code = 1
     */
    code: string;
}
/**
 * @generated from protobuf message LinkResponse
 */
export interface LinkResponse {
    /**
     * @generated from protobuf field: bool success = 1
     */
    success: boolean;
    /**
     * @generated from protobuf field: string collector_name = 2
     */
    collectorName: string;
    /**
     * @generated from protobuf field: string error = 3
     */
    error: string;
}
/**
 * @generated from protobuf message PreferencesRequest
 */
export interface PreferencesRequest {
    /**
     * @generated from protobuf field: bool notifications_enabled = 1
     */
    notificationsEnabled: boolean;
    /**
     * @generated from protobuf field: string deal_alert_mode = 2
     */
    dealAlertMode: string;
}
/**
 * @generated from protobuf message PreferencesResponse
 */
export interface PreferencesResponse {
    /**
     * @generated from protobuf field: bool success = 1
     */
    success: boolean;
    /**
     * @generated from protobuf field: bool notifications_enabled = 2
     */
    notificationsEnabled: boolean;
    /**
     * @generated from protobuf field: string deal_alert_mode = 3
     */
    dealAlertMode: string;
    /**
     * @generated from protobuf field: string alert_channel_id = 4
     */
    alertChannelId: string;
    /**
     * @generated from protobuf field: string error = 5
     */
    error: string;
}
/**
 * @generated from protobuf message DeckShortageCard
 */
export interface DeckShortageCard {
    /**
     * @generated from protobuf field: string card_slug = 1
     */
    cardSlug: string;
    /**
     * @generated from protobuf field: string card_name = 2
     */
    cardName: string;
    /**
     * @generated from protobuf field: int32 quantity = 3
     */
    quantity: number;
}
/**
 * @generated from protobuf message DeckSummary
 */
export interface DeckSummary {
    /**
     * @generated from protobuf field: string id = 1
     */
    id: string;
    /**
     * @generated from protobuf field: string name = 2
     */
    name: string;
    /**
     * @generated from protobuf field: string champion = 3
     */
    champion: string;
    /**
     * @generated from protobuf field: string format = 4
     */
    format: string;
    /**
     * @generated from protobuf field: int32 total_cards = 5
     */
    totalCards: number;
    /**
     * @generated from protobuf field: int32 hard_shortages_count = 6
     */
    hardShortagesCount: number;
    /**
     * @generated from protobuf field: int32 shared_shortages_count = 7
     */
    sharedShortagesCount: number;
    /**
     * @generated from protobuf field: repeated DeckShortageCard hard_shortages = 8
     */
    hardShortages: DeckShortageCard[];
    /**
     * @generated from protobuf field: repeated DeckShortageCard shared_shortages = 9
     */
    sharedShortages: DeckShortageCard[];
}
/**
 * @generated from protobuf message DecksResponse
 */
export interface DecksResponse {
    /**
     * @generated from protobuf field: repeated DeckSummary decks = 1
     */
    decks: DeckSummary[];
}
declare class StatusResponse$Type extends MessageType<StatusResponse> {
    constructor();
    create(value?: PartialMessage<StatusResponse>): StatusResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: StatusResponse): StatusResponse;
    internalBinaryWrite(message: StatusResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message StatusResponse
 */
export declare const StatusResponse: StatusResponse$Type;
declare class LinkRequest$Type extends MessageType<LinkRequest> {
    constructor();
    create(value?: PartialMessage<LinkRequest>): LinkRequest;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: LinkRequest): LinkRequest;
    internalBinaryWrite(message: LinkRequest, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message LinkRequest
 */
export declare const LinkRequest: LinkRequest$Type;
declare class LinkResponse$Type extends MessageType<LinkResponse> {
    constructor();
    create(value?: PartialMessage<LinkResponse>): LinkResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: LinkResponse): LinkResponse;
    internalBinaryWrite(message: LinkResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message LinkResponse
 */
export declare const LinkResponse: LinkResponse$Type;
declare class PreferencesRequest$Type extends MessageType<PreferencesRequest> {
    constructor();
    create(value?: PartialMessage<PreferencesRequest>): PreferencesRequest;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: PreferencesRequest): PreferencesRequest;
    internalBinaryWrite(message: PreferencesRequest, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message PreferencesRequest
 */
export declare const PreferencesRequest: PreferencesRequest$Type;
declare class PreferencesResponse$Type extends MessageType<PreferencesResponse> {
    constructor();
    create(value?: PartialMessage<PreferencesResponse>): PreferencesResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: PreferencesResponse): PreferencesResponse;
    internalBinaryWrite(message: PreferencesResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message PreferencesResponse
 */
export declare const PreferencesResponse: PreferencesResponse$Type;
declare class DeckShortageCard$Type extends MessageType<DeckShortageCard> {
    constructor();
    create(value?: PartialMessage<DeckShortageCard>): DeckShortageCard;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: DeckShortageCard): DeckShortageCard;
    internalBinaryWrite(message: DeckShortageCard, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message DeckShortageCard
 */
export declare const DeckShortageCard: DeckShortageCard$Type;
declare class DeckSummary$Type extends MessageType<DeckSummary> {
    constructor();
    create(value?: PartialMessage<DeckSummary>): DeckSummary;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: DeckSummary): DeckSummary;
    internalBinaryWrite(message: DeckSummary, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message DeckSummary
 */
export declare const DeckSummary: DeckSummary$Type;
declare class DecksResponse$Type extends MessageType<DecksResponse> {
    constructor();
    create(value?: PartialMessage<DecksResponse>): DecksResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: DecksResponse): DecksResponse;
    internalBinaryWrite(message: DecksResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message DecksResponse
 */
export declare const DecksResponse: DecksResponse$Type;
export {};
