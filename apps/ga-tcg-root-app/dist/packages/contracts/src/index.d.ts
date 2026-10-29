/**
 * @ga/contracts
 * Shared domain models, camera vision types, and WebSocket protocol definitions
 * for Grand Archive TCG Collector & Companion Scanner.
 */
export interface Point {
    x: number;
    y: number;
}
/** Ordered corners: [topLeft, topRight, bottomRight, bottomLeft]. */
export type Quad = [Point, Point, Point, Point];
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export declare const CARD_W = 630;
export declare const CARD_H = 880;
export declare const CARD_ASPECT: number;
export type FrameVerdict = "ready" | "hold" | "glare" | "blurry" | "unstable" | "no_card";
export interface QualityGateConfig {
    minCoverage: number;
    maxCornerDeltaPx: number;
    minSharpness: number;
    maxGlareRatio: number;
    glareLuminance: number;
    requiredFrames: number;
}
export declare const DEFAULT_QUALITY_GATE: QualityGateConfig;
export interface ScanFrameMetrics {
    timestamp: number;
    quad: Quad | null;
    /** Quad area / guide area, 0..1+. */
    coverage: number;
    /** Largest corner movement vs previous frame (Infinity when no previous quad). */
    maxCornerDeltaPx: number;
    laplacianVariance: number;
    /** Fraction of card pixels with luminance above the glare threshold. */
    glareRatio: number;
    /** Consecutive frames that passed coverage, stability and sharpness. */
    stableFrames: number;
    verdict: FrameVerdict;
    hint?: string;
}
export type CaptureSource = "auto" | "manual_quad" | "manual_guide_crop";
/** Grand Archive TCG finishes are strictly Normal (non-foil) or Foil. */
export type CardVariant = "normal" | "foil";
export interface CardMatchResult {
    editionId: string;
    cardSlug: string;
    cardName: string;
    setPrefix: string;
    collectorNumber: string;
    imageUrl: string;
    /** Composite certainty 0..100. */
    confidence: number;
    sVisual: number;
    sOcr: number | null;
    signals: {
        collectorMatch: boolean;
        ocrFallback: boolean;
    };
}
export interface CommittedCardPayload {
    editionId: string;
    cardSlug: string;
    cardName: string;
    setPrefix: string;
    collectorNumber: string;
    imageUrl: string;
    foil: boolean;
    confidence: number;
    timestamp: number;
}
export interface PairingQrPayload {
    action: "pair_scanner";
    sessionId: string;
    wsEndpoint: string;
    token: string;
    webFallbackUrl?: string;
}
export type SessionConnectionStatus = "DISCONNECTED" | "CONNECTING" | "ACTIVE_SCANNING" | "RECONNECTING";
export type SessionRole = "scanner" | "receiver";
export interface WsMessageBase {
    sessionId: string;
    timestamp: number;
}
export interface WsJoinMessage extends WsMessageBase {
    type: "SESSION_JOIN";
    token: string;
    role: SessionRole;
    deviceName?: string;
}
export interface WsPingMessage extends WsMessageBase {
    type: "SESSION_PING";
}
export interface WsScanIdentifyRequest extends WsMessageBase {
    type: "SCAN_IDENTIFY_REQUEST";
    requestId: string;
    phash: string;
    headerText: string;
    footerText: string;
}
export interface WsScanFrameProcessRequest extends WsMessageBase {
    type: "SCAN_FRAME_PROCESS_REQUEST";
    requestId: string;
    imageBase64: string;
    cropRect?: Rect;
}
export interface WsCardPreviewMessage extends WsMessageBase {
    type: "CARD_PREVIEW";
    tempId: string;
    cardName: string;
    confidence: number;
}
export interface WsCardCommittedMessage extends WsMessageBase {
    type: "CARD_COMMITTED";
    card: CommittedCardPayload;
}
export interface WsCardUpdateFinishMessage extends WsMessageBase {
    type: "CARD_UPDATE_FINISH";
    editionId: string;
    timestamp: number;
    foil: boolean;
}
export interface WsDisconnectMessage extends WsMessageBase {
    type: "SESSION_DISCONNECT";
}
export type WsClientMessage = WsJoinMessage | WsPingMessage | WsScanIdentifyRequest | WsScanFrameProcessRequest | WsCardPreviewMessage | WsCardCommittedMessage | WsCardUpdateFinishMessage | WsDisconnectMessage;
export interface WsStatusMessage extends WsMessageBase {
    type: "SESSION_STATUS";
    status: "waiting_for_companion" | "paired" | "disconnected";
    pairedDevice?: string;
    activeScanners: number;
}
export interface WsPongMessage extends WsMessageBase {
    type: "SESSION_PONG";
}
export interface ScanFrameDebugData {
    phash: string;
    headerText: string;
    footerText: string;
    glareRatio: number;
    topCandidates?: CardMatchResult[];
    cardImageBase64?: string;
    headerImageBase64?: string;
    footerImageBase64?: string;
}
export interface WsScanIdentifyResponse extends WsMessageBase {
    type: "SCAN_IDENTIFY_RESPONSE";
    requestId: string;
    candidates: CardMatchResult[];
    debug?: ScanFrameDebugData;
}
export interface WsScanFrameDebugMessage extends WsMessageBase {
    type: "SCAN_FRAME_DEBUG";
    debug: ScanFrameDebugData;
}
export interface WsBroadcastCommittedMessage extends WsMessageBase {
    type: "CARD_BROADCAST";
    card: CommittedCardPayload;
}
export interface WsBroadcastFinishUpdateMessage extends WsMessageBase {
    type: "CARD_FINISH_UPDATED";
    editionId: string;
    timestamp: number;
    foil: boolean;
}
export interface WsErrorMessage {
    type: "ERROR";
    code: string;
    message: string;
    sessionId?: string;
}
export type WsServerMessage = WsStatusMessage | WsPongMessage | WsScanIdentifyResponse | WsScanFrameDebugMessage | WsBroadcastCommittedMessage | WsBroadcastFinishUpdateMessage | WsErrorMessage;
export declare function isWsClientMessage(data: unknown): data is WsClientMessage;
export declare function isWsServerMessage(data: unknown): data is WsServerMessage;
export interface FeatureFlags {
    scanner: boolean;
}
export declare const DEFAULT_FEATURE_FLAGS: FeatureFlags;
/**
 * Safely parse a boolean feature flag from environment variables or strings.
 * Defaults to `false` unless explicitly truthy ("true", "1", "yes", "on").
 */
export declare function parseFeatureFlag(val: unknown, defaultValue?: boolean): boolean;
export * from "./i18n";
export * from "./i18n-root-app";
export * from "./fulfillment";
export * from "./assistant";
export * from "./sets";
export * from "./table";
export * from "./webrtc";
export * from "./root-bot";
