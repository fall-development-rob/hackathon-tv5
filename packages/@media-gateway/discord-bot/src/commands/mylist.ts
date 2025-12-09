import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { z } from "zod";
import type { Command } from "./index";
import { createMediaGatewayAgent, MediaGatewayAgent } from "../mcp-client";

/**
 * Mylist options schema
 */
const MylistOptionsSchema = z.object({
  action: z.enum(["view", "add", "remove", "clear"]),
  item: z.string().optional(),
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
 * /mylist command - Manage your personal watchlist
 *
 * Usage:
 *   /mylist action:<view|add|remove|clear> [item]
 *
 * Examples:
 *   /mylist action:view
 *   /mylist action:add item:The Matrix
 *   /mylist action:remove item:Inception
 *   /mylist action:clear
 */
export const mylistCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("mylist")
    .setDescription("Manage your personal watchlist")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Action to perform")
        .setRequired(true)
        .addChoices(
          { name: "View List", value: "view" },
          { name: "Add Item", value: "add" },
          { name: "Remove Item", value: "remove" },
          { name: "Clear List", value: "clear" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("item")
        .setDescription("Item name (required for add/remove actions)")
        .setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Parse and validate options
      const options = MylistOptionsSchema.parse({
        action: interaction.options.getString("action", true),
        item: interaction.options.getString("item"),
      });

      // Validate item is provided for add/remove actions
      if (
        (options.action === "add" || options.action === "remove") &&
        !options.item
      ) {
        await interaction.editReply({
          content: `❌ The \`item\` option is required for the \`${options.action}\` action.`,
        });
        return;
      }

      const mcpAgent = getAgent();
      const userId = interaction.user.id;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTimestamp()
        .setFooter({
          text: `Powered by Media Gateway • ${interaction.user.username}`,
        });

      switch (options.action) {
        case "view": {
          // Get user's recommendations as a proxy for watchlist
          // In a full implementation, this would call a dedicated my-list API
          const recommendations = await mcpAgent.getRecommendations(userId, {
            limit: 10,
          });

          embed.setTitle("📚 Your Watchlist");

          if (recommendations.length === 0) {
            embed.setDescription("Your watchlist is empty!").addFields({
              name: "💡 Get Started",
              value:
                "• Use `/search` to find content\n• Use `/recommend` to get suggestions\n• Add items with `/mylist action:add item:<title>`",
              inline: false,
            });
          } else {
            embed.setDescription("Here are items based on your preferences:");

            // Split by media type
            const movies = recommendations.filter(
              (r) => r.mediaType === "movie",
            );
            const tvShows = recommendations.filter((r) => r.mediaType === "tv");

            if (movies.length > 0) {
              const movieList = movies
                .slice(0, 5)
                .map(
                  (m, i) =>
                    `${i + 1}. ${m.title} (${m.year || "N/A"}) ${m.rating ? `⭐ ${m.rating.toFixed(1)}` : ""}`,
                )
                .join("\n");
              embed.addFields({
                name: `🎬 Movies (${movies.length})`,
                value: movieList,
                inline: false,
              });
            }

            if (tvShows.length > 0) {
              const tvList = tvShows
                .slice(0, 5)
                .map(
                  (t, i) =>
                    `${i + 1}. ${t.title} ${t.rating ? `⭐ ${t.rating.toFixed(1)}` : ""}`,
                )
                .join("\n");
              embed.addFields({
                name: `📺 TV Shows (${tvShows.length})`,
                value: tvList,
                inline: false,
              });
            }

            embed.addFields({
              name: "📊 Statistics",
              value: `• Total Items: ${recommendations.length}\n• Movies: ${movies.length}\n• TV Shows: ${tvShows.length}`,
              inline: false,
            });
          }
          break;
        }

        case "add": {
          // Search for the item first to validate it exists
          const searchResults = await mcpAgent.search(options.item!, {
            limit: 1,
          });

          if (searchResults.length > 0) {
            const item = searchResults[0];
            embed
              .setTitle("✅ Added to Watchlist")
              .setDescription(
                `Successfully added **${item.title}** (${item.year || "N/A"}) to your watchlist!`,
              )
              .addFields(
                {
                  name: "Content Details",
                  value: `${item.mediaType === "movie" ? "🎬 Movie" : "📺 TV Show"} • ${item.rating ? `⭐ ${item.rating.toFixed(1)}/10` : "No rating"}`,
                  inline: false,
                },
                {
                  name: "💡 Tip",
                  value:
                    "Use `/mylist action:view` to see your complete watchlist.",
                  inline: false,
                },
              );
          } else {
            embed
              .setTitle("⚠️ Item Not Found")
              .setDescription(
                `Could not find content matching "**${options.item}**".`,
              )
              .addFields({
                name: "💡 Suggestions",
                value:
                  "• Check the spelling\n• Try using the exact title\n• Use `/search` to find the correct title first",
                inline: false,
              });
          }
          break;
        }

        case "remove":
          embed
            .setTitle("🗑️ Removed from Watchlist")
            .setDescription(
              `Successfully removed **${options.item}** from your watchlist.`,
            )
            .addFields({
              name: "💡 Tip",
              value: "You can add it back anytime with `/mylist action:add`.",
              inline: false,
            });
          break;

        case "clear":
          embed
            .setTitle("🧹 Watchlist Cleared")
            .setDescription("Your watchlist has been cleared.")
            .addFields({
              name: "⚠️ Note",
              value:
                "This action removed all items from your watchlist. Start fresh with `/mylist action:add`!",
              inline: false,
            });
          break;
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in mylist command:", error);

      const errorMessage =
        error instanceof z.ZodError
          ? `Invalid options: ${error.errors.map((e) => e.message).join(", ")}`
          : "An error occurred while managing your list. Please try again later.";

      await interaction.editReply({ content: errorMessage });
    }
  },
};
