import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { z } from "zod";
import type { Command } from "./index";
import { createMediaGatewayAgent, MediaGatewayAgent } from "../mcp-client";

/**
 * Brief options schema
 */
const BriefOptionsSchema = z.object({
  type: z.enum(["daily", "weekly", "trending"]).default("daily"),
});

// Singleton agent instance
let agent: MediaGatewayAgent | null = null;

function getAgent(): MediaGatewayAgent {
  if (!agent) {
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const apiBaseUrl =
      process.env.MEDIA_GATEWAY_API_URL || "http://localhost:3001/v1";
    agent = createMediaGatewayAgent(apiKey, { apiBaseUrl });
  }
  return agent;
}

/**
 * /brief command - Get your personalized content brief
 *
 * Usage:
 *   /brief [type]
 *
 * Examples:
 *   /brief type:daily
 *   /brief type:weekly
 *   /brief type:trending
 */
export const briefCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("brief")
    .setDescription("Get your personalized content brief")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type of brief")
        .setRequired(false)
        .addChoices(
          { name: "Daily Brief", value: "daily" },
          { name: "Weekly Digest", value: "weekly" },
          { name: "Trending Now", value: "trending" },
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Parse and validate options
      const options = BriefOptionsSchema.parse({
        type: interaction.options.getString("type") || "daily",
      });

      const mcpAgent = getAgent();
      const userId = interaction.user.id;

      const briefTitles = {
        daily: "📅 Your Daily Content Brief",
        weekly: "📊 Your Weekly Digest",
        trending: "🔥 Trending Now",
      };

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(briefTitles[options.type])
        .setDescription(
          `Personalized content brief for ${interaction.user.username}`,
        )
        .setTimestamp();

      // Fetch real data based on brief type
      if (options.type === "daily" || options.type === "weekly") {
        // Get personalized recommendations
        const recommendations = await mcpAgent.getRecommendations(userId, {
          limit: 5,
        });
        const trending = await mcpAgent.getTrending(3);

        if (options.type === "daily") {
          // Format trending as "New Releases"
          const newReleases =
            trending.length > 0
              ? trending
                  .map(
                    (item) =>
                      `• **${item.title}** - ${item.description?.substring(0, 50) || "Trending now"}...`,
                  )
                  .join("\n")
              : "• No new releases today. Check back tomorrow!";

          embed.addFields({
            name: "🎬 Trending Now",
            value: newReleases,
            inline: false,
          });

          // Format recommendations
          const recList =
            recommendations.length > 0
              ? recommendations
                  .slice(0, 3)
                  .map(
                    (rec) =>
                      `• **${rec.title}** - ${rec.genre?.slice(0, 2).join(", ") || "Recommended for you"}`,
                  )
                  .join("\n")
              : "• Link your account with `/link` to get personalized recommendations!";

          embed.addFields({
            name: "⭐ Recommended for You",
            value: recList,
            inline: false,
          });

          embed.addFields({
            name: "💡 Quick Actions",
            value:
              "• Use `/search` to find specific content\n• Use `/recommend` for more suggestions\n• Use `/mylist` to manage your watchlist",
            inline: false,
          });
        } else {
          // Weekly digest
          embed.addFields({
            name: "📈 This Week's Highlights",
            value: `• ${trending.length} trending titles this week\n• ${recommendations.length} new recommendations based on your preferences`,
            inline: false,
          });

          if (recommendations.length > 0) {
            const topPicks = recommendations
              .slice(0, 3)
              .map(
                (rec, i) =>
                  `${i + 1}. **${rec.title}** (${rec.mediaType === "movie" ? "🎬" : "📺"}) - ${rec.rating ? `⭐ ${rec.rating.toFixed(1)}` : ""}`,
              )
              .join("\n");

            embed.addFields({
              name: "🎯 Top Picks for You",
              value: topPicks,
              inline: false,
            });
          }
        }
      } else {
        // Trending view
        const trending = await mcpAgent.getTrending(10);

        if (trending.length > 0) {
          const trendingList = trending
            .slice(0, 5)
            .map((item, i) => {
              const medal =
                i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
              const typeIcon = item.mediaType === "movie" ? "🎬" : "📺";
              return `${medal} **${item.title}** ${typeIcon} - ${item.description?.substring(0, 40) || ""}...`;
            })
            .join("\n");

          embed.addFields({
            name: "🔥 Top Trending",
            value: trendingList,
            inline: false,
          });

          // Add genre breakdown
          const genres = trending.reduce(
            (acc, item) => {
              item.genre?.forEach((g) => {
                acc[g] = (acc[g] || 0) + 1;
              });
              return acc;
            },
            {} as Record<string, number>,
          );

          const topGenres = Object.entries(genres)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([genre]) => genre)
            .join(", ");

          if (topGenres) {
            embed.addFields({
              name: "📊 Hot Genres",
              value: topGenres || "Various genres trending",
              inline: false,
            });
          }
        } else {
          embed.addFields({
            name: "🔥 Trending",
            value:
              "No trending content available at the moment. Check back later!",
            inline: false,
          });
        }
      }

      embed.setFooter({
        text: `Powered by Media Gateway AI • Updated ${new Date().toLocaleDateString()}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in brief command:", error);

      const errorMessage =
        error instanceof z.ZodError
          ? `Invalid options: ${error.errors.map((e) => e.message).join(", ")}`
          : "An error occurred while fetching your brief. Please try again later.";

      await interaction.editReply({ content: errorMessage });
    }
  },
};
