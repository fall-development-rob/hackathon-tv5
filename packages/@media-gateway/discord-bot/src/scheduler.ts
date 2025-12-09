/**
 * Brief Scheduler
 * Manages scheduled daily briefs using node-cron
 *
 * Features:
 * - Cron-based scheduling for daily briefs
 * - Per-user scheduling with configurable times
 * - Timezone support
 * - Automatic brief generation and delivery
 * - Integration with Discord bot for message delivery
 */

import cron from "node-cron";
import type { Client, TextChannel } from "discord.js";
import { getPreferencesService } from "./services/user-preferences";
import { getGeneratorService } from "./services/brief-generator";
import { getFormatterService } from "./services/brief-formatter";

/**
 * Scheduled job entry
 */
interface ScheduledJob {
  discordUserId: string;
  channelId: string | null;
  task: cron.ScheduledTask;
  cronTime: string;
  timezone: string;
}

/**
 * BriefScheduler class
 * Manages all scheduled brief jobs
 */
export class BriefScheduler {
  private client: Client;
  private jobs: Map<string, ScheduledJob> = new Map();
  private preferencesService = getPreferencesService();
  private generatorService = getGeneratorService();
  private formatterService = getFormatterService();
  private apiToken: string | null = null;
  private isRunning = false;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Set API authentication token for brief generation
   */
  setApiToken(token: string): void {
    this.apiToken = token;
    this.preferencesService.setApiToken(token);
  }

  /**
   * Start all scheduled jobs
   * Loads all enabled subscriptions and schedules them
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ Scheduler already running");
      return;
    }

    try {
      console.log("🚀 Starting Brief Scheduler...");

      // Get all enabled subscriptions
      const subscriptions =
        await this.preferencesService.getEnabledSubscriptions();

      console.log(`   Found ${subscriptions.length} enabled subscriptions`);

      // Schedule each subscription
      for (const subscription of subscriptions) {
        await this.scheduleUserBrief(
          subscription.discordUserId,
          subscription.channelId || "",
          subscription.cronTime,
          subscription.timezone,
        );
      }

      this.isRunning = true;
      console.log("✅ Brief Scheduler started successfully");
    } catch (error) {
      console.error("❌ Failed to start scheduler:", error);
      throw error;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  async stop(): Promise<void> {
    console.log("🛑 Stopping Brief Scheduler...");

    // Stop all scheduled tasks
    for (const [userId, job] of this.jobs.entries()) {
      job.task.stop();
      console.log(`   Stopped job for user ${userId}`);
    }

    this.jobs.clear();
    this.isRunning = false;
    console.log("✅ Brief Scheduler stopped");
  }

  /**
   * Schedule a brief for a specific user
   * @param userId - Discord user ID
   * @param channelId - Discord channel ID (empty string for DM)
   * @param cronTime - Cron expression (e.g., "0 8 * * *" for 8am daily)
   * @param timezone - IANA timezone (e.g., "America/New_York")
   */
  async scheduleUserBrief(
    userId: string,
    channelId: string,
    cronTime: string = "0 8 * * *",
    timezone: string = "America/New_York",
  ): Promise<void> {
    try {
      // Validate cron expression
      if (!cron.validate(cronTime)) {
        throw new Error(`Invalid cron expression: ${cronTime}`);
      }

      // Unschedule existing job if present
      if (this.jobs.has(userId)) {
        await this.unscheduleUserBrief(userId);
      }

      // Create scheduled task
      const task = cron.schedule(
        cronTime,
        async () => {
          await this.executeBrief(userId, channelId);
        },
        {
          scheduled: true,
          timezone,
        },
      );

      // Store job reference
      const job: ScheduledJob = {
        discordUserId: userId,
        channelId: channelId || null,
        task,
        cronTime,
        timezone,
      };

      this.jobs.set(userId, job);

      console.log(
        `✅ Scheduled brief for user ${userId} at ${cronTime} (${timezone})`,
      );
    } catch (error) {
      console.error(`❌ Failed to schedule brief for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Unschedule a user's brief
   * @param userId - Discord user ID
   */
  async unscheduleUserBrief(userId: string): Promise<void> {
    const job = this.jobs.get(userId);

    if (!job) {
      console.log(`⚠️ No scheduled job found for user ${userId}`);
      return;
    }

    // Stop the cron task
    job.task.stop();

    // Remove from jobs map
    this.jobs.delete(userId);

    console.log(`✅ Unscheduled brief for user ${userId}`);
  }

  /**
   * Execute a brief for a user
   * Called by the cron scheduler
   * @param userId - Discord user ID
   * @param channelId - Discord channel ID (empty string for DM)
   */
  private async executeBrief(userId: string, channelId: string): Promise<void> {
    try {
      console.log(`📊 Executing brief for user ${userId}...`);

      // Get user preferences to retrieve API user ID
      const preferences = await this.preferencesService.getPreferences(userId);

      if (!preferences || !preferences.enabled) {
        console.log(`⚠️ Brief disabled or user not found: ${userId}`);
        return;
      }

      // Generate brief using API
      // Note: In production, each user should have their own API token
      // For now, we'll use a shared token or fetch it from preferences
      if (!this.apiToken) {
        console.error("❌ No API token configured for brief generation");
        return;
      }

      const brief = await this.generatorService.generateBrief(
        preferences.apiUserId,
        this.apiToken,
      );

      // Format brief for Discord
      const embed = this.formatterService.formatAsEmbed(brief);

      // Send brief to channel or DM
      if (channelId) {
        // Send to specific channel
        await this.sendToChannel(channelId, embed);
      } else {
        // Send as DM to user
        await this.sendToDM(userId, embed);
      }

      console.log(`✅ Brief delivered to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to execute brief for user ${userId}:`, error);
    }
  }

  /**
   * Send embed to a Discord channel
   */
  private async sendToChannel(channelId: string, embed: any): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} not found or not a text channel`);
      }

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      console.error(`Failed to send to channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Send embed as DM to a Discord user
   */
  private async sendToDM(userId: string, embed: any): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      await user.send({ embeds: [embed] });
    } catch (error) {
      console.error(`Failed to send DM to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all scheduled jobs
   * @returns Map of user IDs to scheduled jobs
   */
  getScheduledJobs(): Map<string, ScheduledJob> {
    return new Map(this.jobs);
  }

  /**
   * Get job status for a specific user
   * @param userId - Discord user ID
   * @returns Job info or null if not scheduled
   */
  getUserJob(userId: string): ScheduledJob | null {
    return this.jobs.get(userId) || null;
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get total number of scheduled jobs
   */
  getJobCount(): number {
    return this.jobs.size;
  }

  /**
   * Manually trigger a brief for a user (for testing)
   * @param userId - Discord user ID
   * @param channelId - Optional channel ID (uses user's preference if not provided)
   */
  async triggerBrief(userId: string, channelId?: string): Promise<void> {
    const preferences = await this.preferencesService.getPreferences(userId);

    if (!preferences) {
      throw new Error(`User ${userId} has no preferences configured`);
    }

    const targetChannelId = channelId || preferences.channelId || "";
    await this.executeBrief(userId, targetChannelId);
  }
}

/**
 * Export scheduler class
 */
export default BriefScheduler;
