import {
  CommunityAppLogType,
  rootServer,
  type RootAppStartState,
} from "@rootsdk/server-app";
import { startMarketNotifier } from "./market-notifier";
import { startDealAlertNotifier } from "./deal-alert-notifier";
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

// Register the Assistant RPC service so client App frames can invoke methods.
try {
  rootServer.lifecycle.addService(new AssistantRpcService());
  void reportDiagnostic({ stage: "rpc-service-registered" });
} catch (err) {
  void reportDiagnostic({
    stage: "rpc-service-failed",
    message: err,
    level: CommunityAppLogType.Error,
  });
}

async function onStarting(state: RootAppStartState) {
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
