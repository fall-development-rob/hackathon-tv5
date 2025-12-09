/**
 * Discord Message Event Handler
 *
 * Handles incoming Discord messages and routes them to the conversation agent.
 */

import {
  Client,
  Events,
  Message,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import type { ConversationAgent } from "../services/conversation.js";
import type { MediaContent, PlatformAvailability } from "@media-gateway/core";

/**
 * Message handler configuration
 */
export interface MessageHandlerConfig {
  /** Bot user ID to check for mentions */
  botUserId: string;
  /** Whether to respond in DMs */
  respondToDMs: boolean;
  /** Whether to respond to mentions in channels */
  respondToMentions: boolean;
}

/**
 * Register message event handler
 */
export function registerMessageHandler(
  client: Client,
  conversationAgent: ConversationAgent,
  config: MessageHandlerConfig,
): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      // Ignore messages from bots
      if (message.author.bot) return;

      // Check if we should respond to this message
      const shouldRespond =
        (config.respondToDMs && message.channel.isDMBased()) ||
        (config.respondToMentions && message.mentions.has(config.botUserId));

      if (!shouldRespond) return;

      // Show typing indicator
      await message.channel.sendTyping();

      // Extract message content (remove bot mention if present)
      const content = message.content
        .replace(new RegExp(`<@!?${config.botUserId}>`, "g"), "")
        .trim();

      if (!content) {
        await message.reply(
          "Hey! What would you like to watch? I can help you discover movies and TV shows!",
        );
        return;
      }

      // Process message with conversation agent
      const response = await conversationAgent.processMessage(
        message.channelId,
        message.author.id,
        content,
      );

      // Send response
      // If response is short, send as plain text
      if (response.length <= 500) {
        await message.reply(response);
      } else {
        // For longer responses, use an embed
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription(response)
          .setFooter({ text: "Media Gateway • Entertainment Discovery" })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error handling message:", error);

      // Send error message to user
      try {
        await message.reply(
          "⚠️ Sorry, I encountered an issue processing your request. Please try again in a moment!",
        );
      } catch (replyError) {
        console.error("Failed to send error message:", replyError);
      }
    }
  });

  console.log("✅ Message event handler registered");
}

/**
 * Format content as Discord embed
 *
 * Creates a rich embed for displaying movie/TV content
 */
export function formatContentEmbed(
  content: MediaContent,
  availability: PlatformAvailability[],
  reason?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${content.title} (${content.releaseDate.split("-")[0]})`)
    .setDescription(content.overview)
    .setFooter({ text: "Media Gateway • Entertainment Discovery" });

  // Add poster image if available
  if (content.posterPath) {
    const posterUrl = `https://image.tmdb.org/t/p/w500${content.posterPath}`;
    embed.setThumbnail(posterUrl);
  }

  // Add metadata
  const metadata: string[] = [];
  metadata.push(`⭐ **Rating:** ${content.voteAverage.toFixed(1)}/10`);
  metadata.push(
    `📊 **Type:** ${content.mediaType === "movie" ? "Movie" : "TV Show"}`,
  );

  embed.addFields({ name: "Info", value: metadata.join("\n"), inline: false });

  // Add availability information
  if (availability.length > 0) {
    const availabilityText = availability
      .slice(0, 5) // Limit to first 5 platforms
      .map((platform) => {
        const icon = getAvailabilityIcon(platform.type);
        const priceText = platform.price
          ? ` - $${platform.price.toFixed(2)}`
          : "";
        return `${icon} **${platform.platformName}** (${platform.type}${priceText})`;
      })
      .join("\n");

    embed.addFields({
      name: "📺 Where to Watch",
      value: availabilityText,
      inline: false,
    });
  } else {
    embed.addFields({
      name: "📺 Where to Watch",
      value: "Availability information not found",
      inline: false,
    });
  }

  // Add recommendation reason if provided
  if (reason) {
    embed.addFields({
      name: "💡 Why This Match",
      value: reason,
      inline: false,
    });
  }

  return embed;
}

/**
 * Format multiple content items as embeds
 */
export function formatMultipleContentEmbeds(
  items: Array<{
    content: MediaContent;
    availability: PlatformAvailability[];
    reason?: string;
    score?: number;
  }>,
  title: string = "Recommendations",
): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];

  // Create a summary embed
  const summaryEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(
      `Found ${items.length} ${items.length === 1 ? "result" : "results"}`,
    )
    .setFooter({ text: "Media Gateway • Entertainment Discovery" })
    .setTimestamp();

  embeds.push(summaryEmbed);

  // Add individual content embeds (limit to 3 to avoid Discord limits)
  for (const item of items.slice(0, 3)) {
    embeds.push(
      formatContentEmbed(item.content, item.availability, item.reason),
    );
  }

  return embeds;
}

/**
 * Get icon for availability type
 */
function getAvailabilityIcon(type: string): string {
  switch (type) {
    case "subscription":
      return "🎬";
    case "rent":
      return "💵";
    case "buy":
      return "🛒";
    case "free":
      return "🆓";
    default:
      return "📺";
  }
}

/**
 * Handle slash commands for conversation control
 */
export function registerConversationCommands(
  client: Client,
  conversationAgent: ConversationAgent,
): void {
  // Register /clear command to reset conversation
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "clear") {
      try {
        conversationAgent.clearSession(
          interaction.channelId,
          interaction.user.id,
        );
        await interaction.reply({
          content: "✅ Conversation history cleared! Let's start fresh.",
          ephemeral: true,
        });
      } catch (error) {
        console.error("Error clearing conversation:", error);
        await interaction.reply({
          content: "⚠️ Failed to clear conversation history.",
          ephemeral: true,
        });
      }
    }

    if (interaction.commandName === "history") {
      try {
        const history = conversationAgent.getSessionHistory(
          interaction.channelId,
          interaction.user.id,
        );

        if (history.length === 0) {
          await interaction.reply({
            content: "No conversation history found.",
            ephemeral: true,
          });
          return;
        }

        const historyText = history
          .slice(-10) // Last 10 messages
          .map(
            (msg, idx) =>
              `**${idx + 1}. ${msg.role}:** ${msg.content.substring(0, 100)}...`,
          )
          .join("\n\n");

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Conversation History")
          .setDescription(historyText)
          .setFooter({ text: `${history.length} total messages` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error("Error getting conversation history:", error);
        await interaction.reply({
          content: "⚠️ Failed to retrieve conversation history.",
          ephemeral: true,
        });
      }
    }
  });

  console.log("✅ Conversation commands registered");
}
