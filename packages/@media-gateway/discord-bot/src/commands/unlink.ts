/**
 * /unlink command - Unlink Discord account from Media Gateway
 */

import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { UserLinkService } from "../services/user-link";
import { PostgreSQLConnectionPool } from "@media-gateway/database";

export const data = new SlashCommandBuilder()
  .setName("unlink")
  .setDescription("Unlink your Discord account from Media Gateway");

export async function execute(
  interaction: CommandInteraction,
  pool: PostgreSQLConnectionPool,
) {
  const userLinkService = new UserLinkService(pool);
  const discordId = interaction.user.id;

  // Check if user is linked
  const isLinked = await userLinkService.isLinked(discordId);

  if (!isLinked) {
    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle("⚠️ Not Linked")
      .setDescription(
        "Your Discord account is not linked to any Media Gateway account.",
      )
      .addFields({
        name: "Want to link an account?",
        value: "Use `/link instructions` to get started.",
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Create confirmation buttons
  const confirmButton = new ButtonBuilder()
    .setCustomId("unlink_confirm")
    .setLabel("Yes, Unlink")
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId("unlink_cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    confirmButton,
    cancelButton,
  );

  const embed = new EmbedBuilder()
    .setColor(0xff9900)
    .setTitle("⚠️ Confirm Unlink")
    .setDescription(
      "Are you sure you want to unlink your Discord account from Media Gateway?",
    )
    .addFields(
      {
        name: "You will lose access to:",
        value:
          "• Personalized recommendations\n• My List access\n• Daily briefings\n• Watch history sync",
        inline: false,
      },
      {
        name: "Note",
        value: "You can always link your account again later.",
        inline: false,
      },
    )
    .setTimestamp();

  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });

  try {
    // Wait for button interaction (30 second timeout)
    const confirmation = await response.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 30000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    if (confirmation.customId === "unlink_confirm") {
      await confirmation.deferUpdate();

      // Perform unlink
      const result = await userLinkService.unlinkUser(discordId);

      if (result.success) {
        const successEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("✅ Successfully Unlinked")
          .setDescription(
            "Your Discord account has been unlinked from Media Gateway.",
          )
          .addFields({
            name: "Want to link again?",
            value: "Use `/link instructions` whenever you're ready.",
            inline: false,
          })
          .setTimestamp();

        await confirmation.editReply({
          embeds: [successEmbed],
          components: [],
        });
      } else {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ Unlink Failed")
          .setDescription(result.message)
          .setTimestamp();

        await confirmation.editReply({
          embeds: [errorEmbed],
          components: [],
        });
      }
    } else {
      await confirmation.deferUpdate();

      const cancelEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("✅ Cancelled")
        .setDescription("Unlink cancelled. Your account remains linked.")
        .setTimestamp();

      await confirmation.editReply({
        embeds: [cancelEmbed],
        components: [],
      });
    }
  } catch (error) {
    // Timeout or other error
    const timeoutEmbed = new EmbedBuilder()
      .setColor(0x999999)
      .setTitle("⏱️ Timed Out")
      .setDescription("Unlink request timed out. Your account remains linked.")
      .setTimestamp();

    await interaction.editReply({
      embeds: [timeoutEmbed],
      components: [],
    });
  }
}

export default {
  data,
  execute,
};
