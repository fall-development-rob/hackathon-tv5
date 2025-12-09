import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { z } from "zod";
import type { Command } from "./index";

/**
 * Recommendation request schema
 */
const RecommendOptionsSchema = z.object({
  genre: z.string().optional(),
  mood: z.string().optional(),
  limit: z.number().min(1).max(10).default(5),
});

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

      // TODO: Integrate with Media Gateway API and Anthropic AI
      // For now, return a placeholder response

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

      // Placeholder recommendations
      const recommendations = [
        "1. **The Matrix** (Sci-Fi) - A mind-bending journey into virtual reality",
        "2. **Inception** (Thriller) - Dreams within dreams",
        "3. **Interstellar** (Sci-Fi) - Space exploration epic",
      ].slice(0, options.limit);

      embed.addFields({
        name: "📺 Recommendations",
        value: recommendations.join("\n\n"),
        inline: false,
      });

      embed.setFooter({
        text: `Powered by Media Gateway AI • Requested by ${interaction.user.username}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in recommend command:", error);

      const errorMessage =
        error instanceof z.ZodError
          ? `Invalid options: ${error.errors.map((e) => e.message).join(", ")}`
          : "An error occurred while fetching recommendations.";

      await interaction.editReply({ content: errorMessage });
    }
  },
};
