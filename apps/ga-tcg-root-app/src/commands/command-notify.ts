import { CommunityAppLogType } from "@rootsdk/server-app";
import { reportDiagnostic } from "../diagnostics";

export interface NotifyCommandDeps {
  findCollectorId: (userId: string) => Promise<string | null>;
  setNotificationPreference: (
    providerUserId: string,
    enabled: boolean,
    mode?: "all" | "hard"
  ) => Promise<void>;
  provisionDealAlerts: () => Promise<void>;
  removeDealAlertChannel: (recipientId: string) => Promise<void>;
  ensureRecipientChannel: (recipientId: string) => Promise<string | null>;
  configureFromChannel: (channelId: string) => Promise<string | undefined>;
  isCommunityAdmin: (userId: string) => Promise<boolean>;
}

export async function handleNotifyCommand(
  argString: string,
  userId: string,
  deps: NotifyCommandDeps
): Promise<string> {
  const parts = argString.toLowerCase().split(/\s+/).filter(Boolean);
  let action = parts[0];
  let modeArg = parts[1];

  if (action === "all" || action === "hard") {
    modeArg = action;
    action = "on";
  }

  if (action !== "on" && action !== "off") {
    return (
      "⚠️ **Usage:** `/notify on [all|hard]`, `/notify all|hard`, or `/notify off`\n" +
      "• `/notify on all`: Alert on all shortages (hard + shared) and general wantlist\n" +
      "• `/notify on hard`: Alert only on hard shortages and general wantlist\n" +
      "• `/notify off`: Turn off private deal alerts"
    );
  }

  let mode: "all" | "hard" | undefined;
  if (action === "on") {
    if (modeArg === "hard") mode = "hard";
    else if (modeArg === "all") mode = "all";
    else if (modeArg === undefined) mode = undefined;
    else {
      return (
        "⚠️ **Usage:** `/notify on [all|hard]`\n" +
        "Unknown mode. Use `all` (everything) or `hard` (hard shortages + wantlist)."
      );
    }
  }

  const collectorId = await deps.findCollectorId(userId);

  if (!collectorId) {
    return (
      "⚠️ **Grand Archive Binder Account Not Linked**\n" +
      "Link or register your account first:\n" +
      "• Run `/register` to create a new binder account instantly\n" +
      "• Or run `/link <code>` using your pairing code from GA Binder web app."
    );
  }

  if (action === "on") {
    await deps.setNotificationPreference(
      userId,
      true,
      ...(mode !== undefined ? [mode] : [])
    );

    let alertsChannelId: string | null = null;
    try {
      alertsChannelId = await deps.ensureRecipientChannel(userId);
    } catch (err) {
      await reportDiagnostic({
        stage: "notify-create-channel-failed",
        message: err,
        level: CommunityAppLogType.Error,
      });
    }

    try {
      await deps.provisionDealAlerts();
    } catch (err) {
      await reportDiagnostic({
        stage: "notify-provision-failed",
        message: err,
        level: CommunityAppLogType.Error,
      });
    }

    const scope = mode === "hard" ? " (hard shortages + wantlist)" : "";
    return alertsChannelId
      ? `🔔 **Deal alerts enabled${scope}.** Your alerts will arrive in [your private channel](root://channel/${alertsChannelId}).`
      : `🔔 **Deal alerts enabled${scope}.** Your private channel will be created on the next marketplace sync.`;
  }

  await deps.setNotificationPreference(userId, false);
  await deps.removeDealAlertChannel(userId);
  return "🔕 **Deal alerts disabled.**\nYour private deal-alert channel has been removed.";
}

export async function handleSetupCommand(
  argString: string,
  userId: string,
  channelId: string | undefined,
  deps: NotifyCommandDeps
): Promise<string> {
  if (!(await deps.isCommunityAdmin(userId))) {
    return "⚠️ Only community admins (Manage Apps) or the owner can run `/setup`.";
  }

  if (!channelId) {
    return "⚠️ Run `/setup` inside the channel you want market updates posted to.";
  }

  if (argString.toLowerCase() !== "confirm") {
    return (
      "⚠️ **Market setup.** I'll create a dedicated **GA Market** group with a **#market** channel for store updates, and per-user alert channels will live there too.\n" +
      "Run `/setup confirm` to apply it."
    );
  }

  const marketChannelName = await deps.configureFromChannel(channelId);
  return `✅ **Setup complete.** I created the **GA Market** group with a **#${marketChannelName}** channel for market updates, and per-user alert channels will be created there.`;
}
