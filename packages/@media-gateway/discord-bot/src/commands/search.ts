import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { z } from "zod";
import type { Command } from "./index";

/**
 * Search request schema
 */
const SearchOptionsSchema = z.object({
  query: z.string().min(1).max(100),
  type: z.enum(["movie", "tv", "all"]).default("all"),
  limit: z.number().min(1).max(10).default(5),
});

/**
 * /search command - Search for movies and TV shows
 *
 * Usage:
 *   /search query:<search term> [type] [limit]
 *
 * Examples:
 *   /search query:star wars type:movie
 *   /search query:breaking bad type:tv limit:3
 */
export const searchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for movies and TV shows")
    .addStringOption((option) =>
      option.setName("query").setDescription("Search term").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Content type to search")
        .setRequired(false)
        .addChoices(
          { name: "Movies", value: "movie" },
          { name: "TV Shows", value: "tv" },
          { name: "All", value: "all" },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Number of results (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Parse and validate options
      const options = SearchOptionsSchema.parse({
        query: interaction.options.getString("query", true),
        type: interaction.options.getString("type") || "all",
        limit: interaction.options.getInteger("limit") || 5,
      });

      // TODO: Integrate with Media Gateway API
      // For now, return a placeholder response

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🔍 Search Results: "${options.query}"`)
        .setDescription(
          `Showing ${options.type === "all" ? "all content" : options.type === "movie" ? "movies" : "TV shows"}`,
        )
        .setTimestamp();

      // Placeholder search results
      const results = [
        "**The Matrix** (1999)\n📺 Movie • ⭐ 8.7/10\nA computer hacker learns about the true nature of reality.",

        "**Inception** (2010)\n📺 Movie • ⭐ 8.8/10\nA thief who steals corporate secrets through dream-sharing technology.",

        "**Interstellar** (2014)\n📺 Movie • ⭐ 8.6/10\nA team of explorers travel through a wormhole in space.",
      ].slice(0, options.limit);

      embed.addFields({
        name: `📚 Found ${results.length} result(s)`,
        value: results.join("\n\n"),
        inline: false,
      });

      embed.setFooter({
        text: `Powered by Media Gateway • Requested by ${interaction.user.username}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in search command:", error);

      const errorMessage =
        error instanceof z.ZodError
          ? `Invalid options: ${error.errors.map((e) => e.message).join(", ")}`
          : "An error occurred while searching.";

      await interaction.editReply({ content: errorMessage });
    }
  },
};
