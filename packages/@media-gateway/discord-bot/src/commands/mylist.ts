import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { z } from "zod";
import type { Command } from "./index";

/**
 * Mylist options schema
 */
const MylistOptionsSchema = z.object({
  action: z.enum(["view", "add", "remove", "clear"]),
  item: z.string().optional(),
});

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

      // TODO: Integrate with Media Gateway API and user database
      // For now, return placeholder responses

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTimestamp()
        .setFooter({
          text: `Powered by Media Gateway • ${interaction.user.username}`,
        });

      switch (options.action) {
        case "view":
          embed
            .setTitle("📚 Your Watchlist")
            .setDescription("Here are the items in your watchlist:")
            .addFields(
              {
                name: "🎬 Movies (3)",
                value:
                  "1. The Matrix (1999)\n2. Inception (2010)\n3. Interstellar (2014)",
                inline: false,
              },
              {
                name: "📺 TV Shows (2)",
                value: "1. Breaking Bad\n2. The Office",
                inline: false,
              },
              {
                name: "📊 Statistics",
                value:
                  "• Total Items: 5\n• Estimated Watch Time: 12h 45m\n• Last Updated: Today",
                inline: false,
              },
            );
          break;

        case "add":
          embed
            .setTitle("✅ Added to Watchlist")
            .setDescription(
              `Successfully added **${options.item}** to your watchlist!`,
            )
            .addFields({
              name: "💡 Tip",
              value:
                "Use `/mylist action:view` to see your complete watchlist.",
              inline: false,
            });
          break;

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
              name: "⚠️ Warning",
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
          : "An error occurred while managing your list.";

      await interaction.editReply({ content: errorMessage });
    }
  },
};
