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
    /**
     * @generated from protobuf field: bool is_admin = 8
     */
    isAdmin: boolean;
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
 * @generated from protobuf message RegisterResponse
 */
export interface RegisterResponse {
    /**
     * @generated from protobuf field: bool success = 1
     */
    success: boolean;
    /**
     * @generated from protobuf field: string collector_name = 2
     */
    collectorName: string;
    /**
     * @generated from protobuf field: string friend_code = 3
     */
    friendCode: string;
    /**
     * @generated from protobuf field: string error = 4
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
    /**
     * @generated from protobuf field: string omnidex_text = 10
     */
    omnidexText: string;
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
/**
 * @generated from protobuf message AutocompleteChoiceItem
 */
export interface AutocompleteChoiceItem {
    /**
     * @generated from protobuf field: string name = 1
     */
    name: string;
    /**
     * @generated from protobuf field: string value = 2
     */
    value: string;
    /**
     * @generated from protobuf field: string element = 3
     */
    element: string;
    /**
     * @generated from protobuf field: string type = 4
     */
    type: string;
    /**
     * @generated from protobuf field: int32 quantity = 5
     */
    quantity: number;
    /**
     * @generated from protobuf field: bool foil = 6
     */
    foil: boolean;
}
/**
 * @generated from protobuf message AutocompleteRpcRequest
 */
export interface AutocompleteRpcRequest {
    /**
     * @generated from protobuf field: string type = 1
     */
    type: string;
    /**
     * @generated from protobuf field: string query = 2
     */
    query: string;
}
/**
 * @generated from protobuf message AutocompleteRpcResponse
 */
export interface AutocompleteRpcResponse {
    /**
     * @generated from protobuf field: repeated AutocompleteChoiceItem results = 1
     */
    results: AutocompleteChoiceItem[];
}
/**
 * @generated from protobuf message PersonalWantRpcItem
 */
export interface PersonalWantRpcItem {
    /**
     * @generated from protobuf field: string card_slug = 1
     */
    cardSlug: string;
    /**
     * @generated from protobuf field: string card_name = 2
     */
    cardName: string;
    /**
     * @generated from protobuf field: string element = 3
     */
    element: string;
    /**
     * @generated from protobuf field: string type = 4
     */
    type: string;
    /**
     * @generated from protobuf field: int32 desired_quantity = 5
     */
    desiredQuantity: number;
    /**
     * @generated from protobuf field: bool foil = 6
     */
    foil: boolean;
}
/**
 * @generated from protobuf message PersonalWantsRpcResponse
 */
export interface PersonalWantsRpcResponse {
    /**
     * @generated from protobuf field: repeated PersonalWantRpcItem wants = 1
     */
    wants: PersonalWantRpcItem[];
}
/**
 * @generated from protobuf message AddWantRpcRequest
 */
export interface AddWantRpcRequest {
    /**
     * @generated from protobuf field: string card = 1
     */
    card: string;
    /**
     * @generated from protobuf field: int32 quantity = 2
     */
    quantity: number;
    /**
     * @generated from protobuf field: bool foil = 3
     */
    foil: boolean;
    /**
     * @generated from protobuf field: string omnidex_url = 4
     */
    omnidexUrl: string;
    /**
     * @generated from protobuf field: string omnidex_text = 5
     */
    omnidexText: string;
}
/**
 * @generated from protobuf message AddWantRpcResponse
 */
export interface AddWantRpcResponse {
    /**
     * @generated from protobuf field: bool success = 1
     */
    success: boolean;
    /**
     * @generated from protobuf field: string message = 2
     */
    message: string;
    /**
     * @generated from protobuf field: string error = 3
     */
    error: string;
    /**
     * @generated from protobuf field: repeated AutocompleteChoiceItem suggestions = 4
     */
    suggestions: AutocompleteChoiceItem[];
}
/**
 * @generated from protobuf message RemoveWantRpcRequest
 */
export interface RemoveWantRpcRequest {
    /**
     * @generated from protobuf field: string card = 1
     */
    card: string;
    /**
     * @generated from protobuf field: int32 quantity = 2
     */
    quantity: number;
}
/**
 * @generated from protobuf message RemoveWantRpcResponse
 */
export interface RemoveWantRpcResponse {
    /**
     * @generated from protobuf field: bool success = 1
     */
    success: boolean;
    /**
     * @generated from protobuf field: bool removed = 2
     */
    removed: boolean;
    /**
     * @generated from protobuf field: int32 remaining_quantity = 3
     */
    remainingQuantity: number;
    /**
     * @generated from protobuf field: string card_name = 4
     */
    cardName: string;
    /**
     * @generated from protobuf field: string error = 5
     */
    error: string;
    /**
     * @generated from protobuf field: repeated AutocompleteChoiceItem suggestions = 6
     */
    suggestions: AutocompleteChoiceItem[];
}
/**
 * @generated from protobuf message ImportDeckRpcRequest
 */
export interface ImportDeckRpcRequest {
    /**
     * @generated from protobuf field: string url = 1
     */
    url: string;
    /**
     * @generated from protobuf field: string text = 2
     */
    text: string;
}
/**
 * @generated from protobuf message ImportDeckRpcResponse
 */
export interface ImportDeckRpcResponse {
    /**
     * @generated from protobuf field: bool success = 1
     */
    success: boolean;
    /**
     * @generated from protobuf field: string deck_name = 2
     */
    deckName: string;
    /**
     * @generated from protobuf field: string error = 3
     */
    error: string;
}
/**
 * @generated from protobuf message UpdateDeckRpcRequest
 */
export interface UpdateDeckRpcRequest {
    /**
     * @generated from protobuf field: string deck_id = 1
     */
    deckId: string;
    /**
     * @generated from protobuf field: string url = 2
     */
    url: string;
    /**
     * @generated from protobuf field: string text = 3
     */
    text: string;
    /**
     * @generated from protobuf field: string name = 4
     */
    name: string;
    /**
     * @generated from protobuf field: string champion = 5
     */
    champion: string;
}
/**
 * @generated from protobuf message UpdateDeckRpcResponse
 */
export interface UpdateDeckRpcResponse {
    /**
     * @generated from protobuf field: bool success = 1
     */
    success: boolean;
    /**
     * @generated from protobuf field: string deck_name = 2
     */
    deckName: string;
    /**
     * @generated from protobuf field: string error = 3
     */
    error: string;
}
/**
 * @generated from protobuf message CommunityChannelOption
 */
export interface CommunityChannelOption {
    /**
     * @generated from protobuf field: string id = 1
     */
    id: string;
    /**
     * @generated from protobuf field: string name = 2
     */
    name: string;
    /**
     * @generated from protobuf field: string group_name = 3
     */
    groupName: string;
}
/**
 * @generated from protobuf message AdminSettingsResponse
 */
export interface AdminSettingsResponse {
    /**
     * @generated from protobuf field: bool is_admin = 1
     */
    isAdmin: boolean;
    /**
     * @generated from protobuf field: string broadcast_channel_id = 2
     */
    broadcastChannelId: string;
    /**
     * @generated from protobuf field: string broadcast_channel_name = 3
     */
    broadcastChannelName: string;
    /**
     * @generated from protobuf field: repeated CommunityChannelOption text_channels = 4
     */
    textChannels: CommunityChannelOption[];
}
/**
 * @generated from protobuf message SetBroadcastChannelRequest
 */
export interface SetBroadcastChannelRequest {
    /**
     * @generated from protobuf field: string channel_id = 1
     */
    channelId: string;
}
/**
 * @generated from protobuf message SetBroadcastChannelResponse
 */
export interface SetBroadcastChannelResponse {
    /**
     * @generated from protobuf field: bool success = 1
     */
    success: boolean;
    /**
     * @generated from protobuf field: string broadcast_channel_id = 2
     */
    broadcastChannelId: string;
    /**
     * @generated from protobuf field: string broadcast_channel_name = 3
     */
    broadcastChannelName: string;
    /**
     * @generated from protobuf field: string error = 4
     */
    error: string;
}
/**
 * @generated from protobuf message ProvisionMarketChannelsResponse
 */
export interface ProvisionMarketChannelsResponse {
    /**
     * @generated from protobuf field: bool success = 1
     */
    success: boolean;
    /**
     * @generated from protobuf field: string broadcast_channel_id = 2
     */
    broadcastChannelId: string;
    /**
     * @generated from protobuf field: string broadcast_channel_name = 3
     */
    broadcastChannelName: string;
    /**
     * @generated from protobuf field: string assistant_channel_id = 4
     */
    assistantChannelId: string;
    /**
     * @generated from protobuf field: string error = 5
     */
    error: string;
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
declare class RegisterResponse$Type extends MessageType<RegisterResponse> {
    constructor();
    create(value?: PartialMessage<RegisterResponse>): RegisterResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: RegisterResponse): RegisterResponse;
    internalBinaryWrite(message: RegisterResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message RegisterResponse
 */
export declare const RegisterResponse: RegisterResponse$Type;
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
declare class AutocompleteChoiceItem$Type extends MessageType<AutocompleteChoiceItem> {
    constructor();
    create(value?: PartialMessage<AutocompleteChoiceItem>): AutocompleteChoiceItem;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: AutocompleteChoiceItem): AutocompleteChoiceItem;
    internalBinaryWrite(message: AutocompleteChoiceItem, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message AutocompleteChoiceItem
 */
export declare const AutocompleteChoiceItem: AutocompleteChoiceItem$Type;
declare class AutocompleteRpcRequest$Type extends MessageType<AutocompleteRpcRequest> {
    constructor();
    create(value?: PartialMessage<AutocompleteRpcRequest>): AutocompleteRpcRequest;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: AutocompleteRpcRequest): AutocompleteRpcRequest;
    internalBinaryWrite(message: AutocompleteRpcRequest, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message AutocompleteRpcRequest
 */
export declare const AutocompleteRpcRequest: AutocompleteRpcRequest$Type;
declare class AutocompleteRpcResponse$Type extends MessageType<AutocompleteRpcResponse> {
    constructor();
    create(value?: PartialMessage<AutocompleteRpcResponse>): AutocompleteRpcResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: AutocompleteRpcResponse): AutocompleteRpcResponse;
    internalBinaryWrite(message: AutocompleteRpcResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message AutocompleteRpcResponse
 */
export declare const AutocompleteRpcResponse: AutocompleteRpcResponse$Type;
declare class PersonalWantRpcItem$Type extends MessageType<PersonalWantRpcItem> {
    constructor();
    create(value?: PartialMessage<PersonalWantRpcItem>): PersonalWantRpcItem;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: PersonalWantRpcItem): PersonalWantRpcItem;
    internalBinaryWrite(message: PersonalWantRpcItem, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message PersonalWantRpcItem
 */
export declare const PersonalWantRpcItem: PersonalWantRpcItem$Type;
declare class PersonalWantsRpcResponse$Type extends MessageType<PersonalWantsRpcResponse> {
    constructor();
    create(value?: PartialMessage<PersonalWantsRpcResponse>): PersonalWantsRpcResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: PersonalWantsRpcResponse): PersonalWantsRpcResponse;
    internalBinaryWrite(message: PersonalWantsRpcResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message PersonalWantsRpcResponse
 */
export declare const PersonalWantsRpcResponse: PersonalWantsRpcResponse$Type;
declare class AddWantRpcRequest$Type extends MessageType<AddWantRpcRequest> {
    constructor();
    create(value?: PartialMessage<AddWantRpcRequest>): AddWantRpcRequest;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: AddWantRpcRequest): AddWantRpcRequest;
    internalBinaryWrite(message: AddWantRpcRequest, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message AddWantRpcRequest
 */
export declare const AddWantRpcRequest: AddWantRpcRequest$Type;
declare class AddWantRpcResponse$Type extends MessageType<AddWantRpcResponse> {
    constructor();
    create(value?: PartialMessage<AddWantRpcResponse>): AddWantRpcResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: AddWantRpcResponse): AddWantRpcResponse;
    internalBinaryWrite(message: AddWantRpcResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message AddWantRpcResponse
 */
export declare const AddWantRpcResponse: AddWantRpcResponse$Type;
declare class RemoveWantRpcRequest$Type extends MessageType<RemoveWantRpcRequest> {
    constructor();
    create(value?: PartialMessage<RemoveWantRpcRequest>): RemoveWantRpcRequest;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: RemoveWantRpcRequest): RemoveWantRpcRequest;
    internalBinaryWrite(message: RemoveWantRpcRequest, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message RemoveWantRpcRequest
 */
export declare const RemoveWantRpcRequest: RemoveWantRpcRequest$Type;
declare class RemoveWantRpcResponse$Type extends MessageType<RemoveWantRpcResponse> {
    constructor();
    create(value?: PartialMessage<RemoveWantRpcResponse>): RemoveWantRpcResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: RemoveWantRpcResponse): RemoveWantRpcResponse;
    internalBinaryWrite(message: RemoveWantRpcResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message RemoveWantRpcResponse
 */
export declare const RemoveWantRpcResponse: RemoveWantRpcResponse$Type;
declare class ImportDeckRpcRequest$Type extends MessageType<ImportDeckRpcRequest> {
    constructor();
    create(value?: PartialMessage<ImportDeckRpcRequest>): ImportDeckRpcRequest;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: ImportDeckRpcRequest): ImportDeckRpcRequest;
    internalBinaryWrite(message: ImportDeckRpcRequest, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message ImportDeckRpcRequest
 */
export declare const ImportDeckRpcRequest: ImportDeckRpcRequest$Type;
declare class ImportDeckRpcResponse$Type extends MessageType<ImportDeckRpcResponse> {
    constructor();
    create(value?: PartialMessage<ImportDeckRpcResponse>): ImportDeckRpcResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: ImportDeckRpcResponse): ImportDeckRpcResponse;
    internalBinaryWrite(message: ImportDeckRpcResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message ImportDeckRpcResponse
 */
export declare const ImportDeckRpcResponse: ImportDeckRpcResponse$Type;
declare class UpdateDeckRpcRequest$Type extends MessageType<UpdateDeckRpcRequest> {
    constructor();
    create(value?: PartialMessage<UpdateDeckRpcRequest>): UpdateDeckRpcRequest;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: UpdateDeckRpcRequest): UpdateDeckRpcRequest;
    internalBinaryWrite(message: UpdateDeckRpcRequest, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message UpdateDeckRpcRequest
 */
export declare const UpdateDeckRpcRequest: UpdateDeckRpcRequest$Type;
declare class UpdateDeckRpcResponse$Type extends MessageType<UpdateDeckRpcResponse> {
    constructor();
    create(value?: PartialMessage<UpdateDeckRpcResponse>): UpdateDeckRpcResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: UpdateDeckRpcResponse): UpdateDeckRpcResponse;
    internalBinaryWrite(message: UpdateDeckRpcResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message UpdateDeckRpcResponse
 */
export declare const UpdateDeckRpcResponse: UpdateDeckRpcResponse$Type;
declare class CommunityChannelOption$Type extends MessageType<CommunityChannelOption> {
    constructor();
    create(value?: PartialMessage<CommunityChannelOption>): CommunityChannelOption;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: CommunityChannelOption): CommunityChannelOption;
    internalBinaryWrite(message: CommunityChannelOption, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message CommunityChannelOption
 */
export declare const CommunityChannelOption: CommunityChannelOption$Type;
declare class AdminSettingsResponse$Type extends MessageType<AdminSettingsResponse> {
    constructor();
    create(value?: PartialMessage<AdminSettingsResponse>): AdminSettingsResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: AdminSettingsResponse): AdminSettingsResponse;
    internalBinaryWrite(message: AdminSettingsResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message AdminSettingsResponse
 */
export declare const AdminSettingsResponse: AdminSettingsResponse$Type;
declare class SetBroadcastChannelRequest$Type extends MessageType<SetBroadcastChannelRequest> {
    constructor();
    create(value?: PartialMessage<SetBroadcastChannelRequest>): SetBroadcastChannelRequest;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: SetBroadcastChannelRequest): SetBroadcastChannelRequest;
    internalBinaryWrite(message: SetBroadcastChannelRequest, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message SetBroadcastChannelRequest
 */
export declare const SetBroadcastChannelRequest: SetBroadcastChannelRequest$Type;
declare class SetBroadcastChannelResponse$Type extends MessageType<SetBroadcastChannelResponse> {
    constructor();
    create(value?: PartialMessage<SetBroadcastChannelResponse>): SetBroadcastChannelResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: SetBroadcastChannelResponse): SetBroadcastChannelResponse;
    internalBinaryWrite(message: SetBroadcastChannelResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message SetBroadcastChannelResponse
 */
export declare const SetBroadcastChannelResponse: SetBroadcastChannelResponse$Type;
declare class ProvisionMarketChannelsResponse$Type extends MessageType<ProvisionMarketChannelsResponse> {
    constructor();
    create(value?: PartialMessage<ProvisionMarketChannelsResponse>): ProvisionMarketChannelsResponse;
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: ProvisionMarketChannelsResponse): ProvisionMarketChannelsResponse;
    internalBinaryWrite(message: ProvisionMarketChannelsResponse, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter;
}
/**
 * @generated MessageType for protobuf message ProvisionMarketChannelsResponse
 */
export declare const ProvisionMarketChannelsResponse: ProvisionMarketChannelsResponse$Type;
export {};
