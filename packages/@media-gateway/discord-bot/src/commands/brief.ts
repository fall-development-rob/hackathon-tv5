import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { z } from "zod";
import type { Command } from "./index";

/**
 * Brief options schema
 */
const BriefOptionsSchema = z.object({
  type: z.enum(["daily", "weekly", "trending"]).default("daily"),
});

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

      // TODO: Integrate with Media Gateway API and user preferences
      // For now, return a placeholder response

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

      // Different content based on brief type
      if (options.type === "daily") {
        embed.addFields(
          {
            name: "🎬 New Releases",
            value:
              "• **The Last of Us S2** - Episode 3 is now available\n• **Dune: Part Three** - Trailer released",
            inline: false,
          },
          {
            name: "⭐ Recommended for You",
            value:
              "• **Severance** - Based on your love for sci-fi thrillers\n• **The Bear** - Continues your culinary drama interest",
            inline: false,
          },
          {
            name: "⏰ Continue Watching",
            value:
              "• **Breaking Bad** - S3E7 (42 min left)\n• **The Office** - S5E12",
            inline: false,
          },
        );
      } else if (options.type === "weekly") {
        embed.addFields(
          {
            name: "📈 This Week's Highlights",
            value:
              "• 12 new episodes added to your watchlist\n• 3 movies matching your preferences released\n• 5 shows you follow returned with new seasons",
            inline: false,
          },
          {
            name: "🎯 Completion Progress",
            value:
              "• Finished 3 series this week 🎉\n• 45% through your current watchlist",
            inline: false,
          },
        );
      } else if (options.type === "trending") {
        embed.addFields(
          {
            name: "🔥 Top Trending",
            value:
              "1. **The Last of Us** - Post-apocalyptic drama\n2. **Wednesday** - Addams Family spinoff\n3. **The Mandalorian** - Star Wars series",
            inline: false,
          },
          {
            name: "💬 Most Discussed",
            value:
              "• **Succession** finale reactions\n• **Barbie** movie debate continues\n• **Oppenheimer** critical analysis",
            inline: false,
          },
        );
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
          : "An error occurred while fetching your brief.";

      await interaction.editReply({ content: errorMessage });
    }
  },
};
