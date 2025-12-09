/**
 * Subscribe Command
 * Manages user subscriptions to daily briefs
 *
 * Commands:
 * - /subscribe daily - Subscribe to daily briefs in current channel
 * - /subscribe time HH:MM - Set preferred brief time
 * - /unsubscribe - Stop daily briefs
 */

import {
  SlashCommandBuilder,
  CommandInteraction,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { getPreferencesService } from "../services/user-preferences";
import type BriefScheduler from "../scheduler";

/**
 * Parse time string (HH:MM) to cron expression
 * @param timeStr - Time in format "HH:MM" (24-hour)
 * @returns Cron expression for daily execution
 */
function timeToCron(timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error("Invalid time format. Use HH:MM (24-hour format)");
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("Invalid time. Hours must be 0-23, minutes must be 0-59");
  }

  return `${minutes} ${hours} * * *`;
}

/**
 * Parse cron expression to time string
 * @param cron - Cron expression
 * @returns Time string in format "HH:MM"
 */
function cronToTime(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length < 2) return "08:00";

  const minutes = parts[0].padStart(2, "0");
  const hours = parts[1].padStart(2, "0");

  return `${hours}:${minutes}`;
}

/**
 * Subscribe command definition
 */
export const data = new SlashCommandBuilder()
  .setName("subscribe")
  .setDescription("Manage your daily media brief subscriptions")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("daily")
      .setDescription("Subscribe to daily briefs in this channel")
      .addStringOption((option) =>
        option
          .setName("token")
          .setDescription("Your Media Gateway API token")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("time")
      .setDescription("Set your preferred brief time")
      .addStringOption((option) =>
        option
          .setName("time")
          .setDescription("Time in HH:MM format (24-hour, e.g., 08:00)")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("timezone")
          .setDescription("Your timezone (e.g., America/New_York)")
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("status")
      .setDescription("Check your subscription status"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("unsubscribe")
      .setDescription("Unsubscribe from daily briefs"),
  );

/**
 * Execute subscribe command
 */
export async function execute(
  interaction: CommandInteraction,
  scheduler: BriefScheduler,
): Promise<void> {
  const subcommand = interaction.options.data[0]?.name;
  const userId = interaction.user.id;
  const preferencesService = getPreferencesService();

  try {
    switch (subcommand) {
      case "daily": {
        // Subscribe to daily briefs
        const token = interaction.options.get("token")?.value as string;

        // Verify channel is a text channel
        if (
          !interaction.channel ||
          interaction.channel.type !== ChannelType.GuildText
        ) {
          await interaction.reply({
            content: "❌ This command can only be used in a text channel!",
            ephemeral: true,
          });
          return;
        }

        const channelId = interaction.channel.id;

        // Link user to API
        try {
          const preferences = await preferencesService.linkUser(
            userId,
            token,
            channelId,
            "0 8 * * *", // Default 8am
            "America/New_York", // Default timezone
          );

          // Schedule the brief
          await scheduler.scheduleUserBrief(
            userId,
            channelId,
            preferences.cronTime,
            preferences.timezone,
          );

          const embed = new EmbedBuilder()
            .setTitle("✅ Subscription Activated")
            .setDescription(
              `You're now subscribed to daily media briefs in this channel!`,
            )
            .setColor(0x00ff00)
            .addFields(
              {
                name: "Channel",
                value: `<#${channelId}>`,
                inline: true,
              },
              {
                name: "Time",
                value: cronToTime(preferences.cronTime),
                inline: true,
              },
              {
                name: "Timezone",
                value: preferences.timezone,
                inline: true,
              },
            )
            .setFooter({
              text: "Use /subscribe time to change your preferred time",
            });

          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error: any) {
          await interaction.reply({
            content: `❌ Failed to subscribe: ${error.message}`,
            ephemeral: true,
          });
        }
        break;
      }

      case "time": {
        // Update preferred time
        const timeStr = interaction.options.get("time")?.value as string;
        const timezone =
          (interaction.options.get("timezone")?.value as string) || undefined;

        try {
          // Convert time to cron expression
          const cronTime = timeToCron(timeStr);

          // Get existing preferences
          const preferences = await preferencesService.getPreferences(userId);

          if (!preferences) {
            await interaction.reply({
              content:
                "❌ You need to subscribe first using `/subscribe daily`",
              ephemeral: true,
            });
            return;
          }

          // Update preferences
          const updated = await preferencesService.updatePreferences(userId, {
            cronTime,
            timezone: timezone || preferences.timezone,
          });

          if (!updated) {
            throw new Error("Failed to update preferences");
          }

          // Reschedule the job
          await scheduler.scheduleUserBrief(
            userId,
            updated.channelId || "",
            updated.cronTime,
            updated.timezone,
          );

          const embed = new EmbedBuilder()
            .setTitle("⏰ Brief Time Updated")
            .setDescription("Your daily brief schedule has been updated!")
            .setColor(0x0099ff)
            .addFields(
              {
                name: "New Time",
                value: timeStr,
                inline: true,
              },
              {
                name: "Timezone",
                value: updated.timezone,
                inline: true,
              },
            );

          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error: any) {
          await interaction.reply({
            content: `❌ Failed to update time: ${error.message}`,
            ephemeral: true,
          });
        }
        break;
      }

      case "status": {
        // Check subscription status
        try {
          const preferences = await preferencesService.getPreferences(userId);

          if (!preferences) {
            await interaction.reply({
              content:
                "❌ You are not subscribed to daily briefs. Use `/subscribe daily` to get started!",
              ephemeral: true,
            });
            return;
          }

          const job = scheduler.getUserJob(userId);

          const embed = new EmbedBuilder()
            .setTitle("📊 Subscription Status")
            .setColor(preferences.enabled ? 0x00ff00 : 0xff0000)
            .addFields(
              {
                name: "Status",
                value: preferences.enabled ? "✅ Active" : "❌ Inactive",
                inline: true,
              },
              {
                name: "Brief Time",
                value: cronToTime(preferences.cronTime),
                inline: true,
              },
              {
                name: "Timezone",
                value: preferences.timezone,
                inline: true,
              },
              {
                name: "Delivery",
                value: preferences.channelId
                  ? `Channel: <#${preferences.channelId}>`
                  : "Direct Message",
                inline: false,
              },
              {
                name: "Scheduled",
                value: job ? "✅ Yes" : "❌ No",
                inline: true,
              },
            )
            .setTimestamp(preferences.updatedAt);

          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error: any) {
          await interaction.reply({
            content: `❌ Failed to get status: ${error.message}`,
            ephemeral: true,
          });
        }
        break;
      }

      case "unsubscribe": {
        // Unsubscribe from briefs
        try {
          const preferences = await preferencesService.getPreferences(userId);

          if (!preferences) {
            await interaction.reply({
              content: "❌ You are not subscribed to daily briefs.",
              ephemeral: true,
            });
            return;
          }

          // Disable preferences
          await preferencesService.updatePreferences(userId, {
            enabled: false,
          });

          // Unschedule the job
          await scheduler.unscheduleUserBrief(userId);

          const embed = new EmbedBuilder()
            .setTitle("👋 Unsubscribed")
            .setDescription(
              "You have been unsubscribed from daily briefs. Your preferences are saved if you want to resubscribe later.",
            )
            .setColor(0xff9900)
            .setFooter({
              text: "Use /subscribe daily to resubscribe anytime",
            });

          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error: any) {
          await interaction.reply({
            content: `❌ Failed to unsubscribe: ${error.message}`,
            ephemeral: true,
          });
        }
        break;
      }

      default: {
        await interaction.reply({
          content: "❌ Unknown subcommand",
          ephemeral: true,
        });
      }
    }
  } catch (error) {
    console.error("Error in subscribe command:", error);
    await interaction.reply({
      content: "❌ An error occurred while processing your request.",
      ephemeral: true,
    });
  }
}
