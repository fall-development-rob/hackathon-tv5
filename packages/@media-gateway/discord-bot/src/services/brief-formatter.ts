/**
 * Brief Formatter Service
 * Formats brief content for Discord display
 *
 * Creates rich embeds and formatted messages for Discord
 */

import { EmbedBuilder } from "discord.js";
import type { BriefContent } from "./brief-generator";

/**
 * BriefFormatterService class
 * Formats briefs for Discord display
 */
export class BriefFormatterService {
  /**
   * Format brief content as Discord embed
   * @param brief - Generated brief content
   * @returns Discord embed
   */
  formatAsEmbed(brief: BriefContent): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle("📺 Your Daily Media Brief")
      .setColor(0x5865f2)
      .setTimestamp(brief.generatedAt)
      .setFooter({ text: "Media Gateway" });

    // Add recommendations section
    if (brief.recommendations.length > 0) {
      const recommendationsText = brief.recommendations
        .slice(0, 3)
        .map(
          (rec, idx) =>
            `${idx + 1}. **${rec.title}** (${rec.type})\n` +
            `   📍 ${rec.provider} • ${rec.reason}`,
        )
        .join("\n\n");

      embed.addFields({
        name: "🎬 Recommended for You",
        value: recommendationsText,
      });
    }

    // Add watchlist updates section
    if (brief.watchlistUpdates.length > 0) {
      const watchlistText = brief.watchlistUpdates
        .slice(0, 3)
        .map((item) => `• **${item.title}** - ${item.status}`)
        .join("\n");

      embed.addFields({
        name: "📋 Watchlist Updates",
        value: watchlistText,
      });
    }

    // Add trending content section
    if (brief.trendingContent.length > 0) {
      const trendingText = brief.trendingContent
        .slice(0, 3)
        .map(
          (item) =>
            `• **${item.title}** (${item.type}) - ${item.popularity}% trending`,
        )
        .join("\n");

      embed.addFields({
        name: "🔥 Trending Now",
        value: trendingText,
      });
    }

    return embed;
  }

  /**
   * Format brief content as plain text
   * @param brief - Generated brief content
   * @returns Formatted text
   */
  formatAsText(brief: BriefContent): string {
    let text = "📺 **Your Daily Media Brief**\n\n";

    // Add recommendations
    if (brief.recommendations.length > 0) {
      text += "🎬 **Recommended for You:**\n";
      brief.recommendations.slice(0, 3).forEach((rec, idx) => {
        text += `${idx + 1}. ${rec.title} (${rec.type})\n`;
        text += `   📍 ${rec.provider} • ${rec.reason}\n\n`;
      });
    }

    // Add watchlist updates
    if (brief.watchlistUpdates.length > 0) {
      text += "📋 **Watchlist Updates:**\n";
      brief.watchlistUpdates.slice(0, 3).forEach((item) => {
        text += `• ${item.title} - ${item.status}\n`;
      });
      text += "\n";
    }

    // Add trending content
    if (brief.trendingContent.length > 0) {
      text += "🔥 **Trending Now:**\n";
      brief.trendingContent.slice(0, 3).forEach((item) => {
        text += `• ${item.title} (${item.type}) - ${item.popularity}% trending\n`;
      });
    }

    return text;
  }
}

/**
 * Export formatter service
 */
export function getFormatterService(): BriefFormatterService {
  return new BriefFormatterService();
}
