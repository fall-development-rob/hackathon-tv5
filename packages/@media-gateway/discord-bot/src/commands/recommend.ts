import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { z } from "zod";
import type { Command } from "./index";
import { createMediaGatewayAgent, MediaGatewayAgent } from "../mcp-client";

/**
 * Recommendation request schema
 */
const RecommendOptionsSchema = z.object({
  genre: z.string().optional(),
  mood: z.string().optional(),
  limit: z.number().min(1).max(10).default(5),
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
 * /recommend command - Get AI-powered content recommendations
 *
 * Usage:
 *   /recommend [genre] [mood] [limit]
 *
 * Examples:
 *   /recommend genre:action mood:exciting
 *   /recommend mood:relaxing limit:3
 */
export const recommendCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("recommend")
    .setDescription("Get AI-powered content recommendations")
    .addStringOption((option) =>
      option
        .setName("genre")
        .setDescription("Content genre (e.g., action, comedy, drama)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("mood")
        .setDescription(
          "Your current mood (e.g., exciting, relaxing, thrilling)",
        )
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Number of recommendations (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Parse and validate options
      const options = RecommendOptionsSchema.parse({
        genre: interaction.options.getString("genre"),
        mood: interaction.options.getString("mood"),
        limit: interaction.options.getInteger("limit") || 5,
      });

      // Get recommendations from Media Gateway API
      const mcpAgent = getAgent();

      // Use Discord user ID as the user identifier for personalization
      const userId = interaction.user.id;

      const recommendations = await mcpAgent.getRecommendations(userId, {
        limit: options.limit,
        genre: options.genre,
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎬 AI Recommendations")
        .setDescription("Here are your personalized content recommendations:")
        .setTimestamp();

      // Add filter information if provided
      const filters: string[] = [];
      if (options.genre) filters.push(`Genre: ${options.genre}`);
      if (options.mood) filters.push(`Mood: ${options.mood}`);

      if (filters.length > 0) {
        embed.addFields({
          name: "🎯 Filters",
          value: filters.join("\n"),
          inline: false,
        });
      }

      if (recommendations.length === 0) {
        embed.addFields({
          name: "📺 Recommendations",
          value:
            "No recommendations found matching your criteria. Try adjusting your filters or explore trending content with `/brief type:trending`.",
          inline: false,
        });
      } else {
        // Format recommendations
        const formattedRecs = recommendations.map((rec, index) => {
          const typeIcon = rec.mediaType === "movie" ? "🎬" : "📺";
          const rating = rec.rating ? `⭐ ${rec.rating.toFixed(1)}/10` : "";
          const year = rec.year ? `(${rec.year})` : "";
          const genres = rec.genre?.slice(0, 2).join(", ") || "Unknown";
          const overview = rec.description
            ? rec.description.substring(0, 80) +
              (rec.description.length > 80 ? "..." : "")
            : "";
          return `**${index + 1}. ${rec.title}** ${year}\n${typeIcon} ${genres} • ${rating}\n${overview}`;
        });

        embed.addFields({
          name: `📺 ${recommendations.length} Recommendation(s)`,
          value: formattedRecs.join("\n\n"),
          inline: false,
        });
      }

      embed.setFooter({
        text: `Powered by Media Gateway AI • Requested by ${interaction.user.username}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in recommend command:", error);

      const errorMessage =
        error instanceof z.ZodError
          ? `Invalid options: ${error.errors.map((e) => e.message).join(", ")}`
          : "An error occurred while fetching recommendations. Please try again later.";

      await interaction.editReply({ content: errorMessage });
    }
  },
};
