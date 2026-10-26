import { CommunityAppLogType } from "@rootsdk/server-app";
export interface DiagnosticEvent {
    stage: string;
    message?: unknown;
    communityId?: string;
    level?: CommunityAppLogType;
}
/**
 * Records a startup/poll event in three places, best-effort: stdout, Root's
 * community log, and the web app's `root_bot_diagnostics` table. Root's pod log
 * shipper is unreliable, so the HTTP sink is the dependable one. Never throws
 * and never blocks startup on the SDK.
 */
export declare function reportDiagnostic(event: DiagnosticEvent): Promise<void>;
