import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { z } from "zod";
import type { Command } from "./index";
import { createMediaGatewayAgent, MediaGatewayAgent } from "../mcp-client";

/**
 * Search request schema
 */
const SearchOptionsSchema = z.object({
  query: z.string().min(1).max(100),
  type: z.enum(["movie", "tv", "all"]).default("all"),
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

      // Search using Media Gateway API
      const mcpAgent = getAgent();
      const searchResults = await mcpAgent.search(options.query, {
        type: options.type === "all" ? undefined : options.type,
        limit: options.limit,
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🔍 Search Results: "${options.query}"`)
        .setDescription(
          `Showing ${options.type === "all" ? "all content" : options.type === "movie" ? "movies" : "TV shows"}`,
        )
        .setTimestamp();

      if (searchResults.length === 0) {
        embed.addFields({
          name: "No Results",
          value: `No ${options.type === "all" ? "content" : options.type === "movie" ? "movies" : "TV shows"} found matching "${options.query}". Try different keywords or check spelling.`,
          inline: false,
        });
      } else {
        // Format search results
        const formattedResults = searchResults.map((result, index) => {
          const typeIcon = result.mediaType === "movie" ? "🎬" : "📺";
          const rating = result.rating
            ? `⭐ ${result.rating.toFixed(1)}/10`
            : "";
          const year = result.year ? `(${result.year})` : "";
          const overview = result.description
            ? result.description.substring(0, 100) +
              (result.description.length > 100 ? "..." : "")
            : "No description available";
          return `**${index + 1}. ${result.title}** ${year}\n${typeIcon} ${result.mediaType === "movie" ? "Movie" : "TV Show"} • ${rating}\n${overview}`;
        });

        embed.addFields({
          name: `📚 Found ${searchResults.length} result(s)`,
          value: formattedResults.join("\n\n"),
          inline: false,
        });
      }

      embed.setFooter({
        text: `Powered by Media Gateway • Requested by ${interaction.user.username}`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in search command:", error);

      const errorMessage =
        error instanceof z.ZodError
          ? `Invalid options: ${error.errors.map((e) => e.message).join(", ")}`
          : "An error occurred while searching. Please try again later.";

      await interaction.editReply({ content: errorMessage });
    }
  },
};
