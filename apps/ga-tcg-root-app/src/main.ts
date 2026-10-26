import {
  CommunityAppLogType,
  rootServer,
  type RootBotStartState,
} from "@rootsdk/server-bot";
import { startMarketNotifier } from "./market-notifier";
import { startDealAlertNotifier } from "./deal-alert-notifier";
import { registerRootCommandHandlers } from "./command-handlers";
import { AssistantRpcService } from "./assistant-rpc-service";
import { createCommunityConfig } from "./community-config";
import { logCommunityContext } from "./channel-diagnostics";
import { getRootBotToken } from "./root-bot-auth";
import { reportDiagnostic } from "./diagnostics";

// First beacon, before the SDK lifecycle. If this row never appears, the
// process is not running or cannot reach the API at all.
void reportDiagnostic({
  stage: "boot",
  message: `process started; COMMUNITY_ID=${process.env.COMMUNITY_ID ?? "(unset)"} APP_ID=${process.env.APP_ID ?? "(unset)"}`,
});

async function onStarting(state: RootBotStartState) {
  const communityId = String(
    state.communityId ?? process.env.COMMUNITY_ID ?? ""
  );

  await reportDiagnostic({
    stage: "starting",
    communityId,
    message: `community ${communityId || "(empty)"}`,
  });

  // Authenticate immediately so startup is observable and polling has a token,
  // instead of waiting for the first scheduled job.
  try {
    await getRootBotToken({ communityId });
    await reportDiagnostic({ stage: "install-ok", communityId });
  } catch (err) {
    await reportDiagnostic({
      stage: "install-failed",
      communityId,
      message: err,
      level: CommunityAppLogType.Error,
    });
  }

  let sectionId: string | undefined;
  let broadcastChannelId: string | undefined;

  try {
    const config = createCommunityConfig(rootServer.dataStore.appData);
    [sectionId, broadcastChannelId] = await Promise.all([
      config.getAlertSectionId(),
      config.getBroadcastChannelId(),
    ]);
  } catch (err) {
    await reportDiagnostic({
      stage: "config-read-failed",
      communityId,
      message: err,
      level: CommunityAppLogType.Warn,
    });
  }

  void logCommunityContext({ sectionId, broadcastChannelId });

  try {
    await startMarketNotifier({ communityId });
    await reportDiagnostic({ stage: "market-notifier-started", communityId });
  } catch (err) {
    await reportDiagnostic({
      stage: "market-notifier-failed",
      communityId,
      message: err,
      level: CommunityAppLogType.Error,
    });
  }

  try {
    await startDealAlertNotifier({ communityId });
    await reportDiagnostic({ stage: "deal-alert-notifier-started", communityId });
  } catch (err) {
    await reportDiagnostic({
      stage: "deal-alert-notifier-failed",
      communityId,
      message: err,
      level: CommunityAppLogType.Error,
    });
  }

  try {
    registerRootCommandHandlers(communityId);
    await reportDiagnostic({ stage: "commands-registered", communityId });
  } catch (err) {
    await reportDiagnostic({
      stage: "commands-failed",
      communityId,
      message: err,
      level: CommunityAppLogType.Error,
    });
  }

  try {
    const assistantRpcService = new AssistantRpcService(communityId);
    (rootServer.lifecycle as unknown as { addService(s: unknown): void }).addService(
      assistantRpcService
    );
    await reportDiagnostic({ stage: "rpc-service-registered", communityId });
  } catch (err) {
    await reportDiagnostic({
      stage: "rpc-service-failed",
      communityId,
      message: err,
      level: CommunityAppLogType.Error,
    });
  }

  await reportDiagnostic({ stage: "startup-complete", communityId });
}

(async () => {
  try {
    await rootServer.lifecycle.start(onStarting);
  } catch (err) {
    await reportDiagnostic({
      stage: "lifecycle-failed",
      message: err,
      level: CommunityAppLogType.Fatal,
    });
    process.exitCode = 1;
  }
})();
