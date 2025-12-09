/**
 * /link command - Link Discord account to Media Gateway
 */

import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { UserLinkService } from "../services/user-link";
import { PostgreSQLConnectionPool } from "@media-gateway/database";

export const data = new SlashCommandBuilder()
  .setName("link")
  .setDescription("Link your Discord account to Media Gateway")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("code")
      .setDescription("Link using a code from the Media Gateway website")
      .addStringOption((option) =>
        option
          .setName("code")
          .setDescription("8-character link code from website")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("credentials")
      .setDescription(
        "Link directly with your email and password (less secure)",
      )
      .addStringOption((option) =>
        option
          .setName("email")
          .setDescription("Your Media Gateway email")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("password")
          .setDescription("Your Media Gateway password")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("instructions")
      .setDescription("Show instructions for linking your account"),
  );

export async function execute(
  interaction: CommandInteraction,
  pool: PostgreSQLConnectionPool,
) {
  const subcommand = interaction.options.data[0].name;
  const userLinkService = new UserLinkService(pool);
  const discordId = interaction.user.id;

  // Check if already linked
  const isLinked = await userLinkService.isLinked(discordId);

  if (subcommand === "instructions") {
    const embed = new EmbedBuilder()
      .setColor(isLinked ? 0x00ff00 : 0x0099ff)
      .setTitle("🔗 Link Your Discord Account")
      .setDescription(
        isLinked
          ? "✅ Your Discord account is already linked to Media Gateway!"
          : "Link your Discord account to access personalized features:",
      )
      .addFields(
        {
          name: "🌟 Benefits",
          value:
            "• Access your My List\n• Get personalized recommendations\n• Sync your watch history\n• Daily content briefings",
          inline: false,
        },
        {
          name: "🔐 Secure Linking (Recommended)",
          value:
            '1. Visit the Media Gateway website\n2. Go to Settings → Discord Integration\n3. Click "Generate Link Code"\n4. Use `/link code YOUR-CODE` in Discord',
          inline: false,
        },
        {
          name: "⚡ Quick Linking",
          value:
            "Use `/link credentials` with your email and password\n⚠️ Note: This method is less secure",
          inline: false,
        },
      )
      .setFooter({
        text: "Your credentials are never stored by the Discord bot",
      })
      .setTimestamp();

    if (isLinked) {
      embed.addFields({
        name: "📝 Next Steps",
        value: "Try `/profile` to see your linked account info!",
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (isLinked) {
    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle("⚠️ Already Linked")
      .setDescription(
        "Your Discord account is already linked to a Media Gateway account.",
      )
      .addFields({
        name: "Want to link a different account?",
        value: "Use `/unlink` first, then link again.",
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (subcommand === "code") {
    await interaction.deferReply({ ephemeral: true });

    const code = interaction.options.get("code")?.value as string;
    const result = await userLinkService.linkUserWithCode(discordId, code);

    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Successfully Linked!")
        .setDescription(
          "Your Discord account has been linked to Media Gateway.",
        )
        .addFields({
          name: "🎉 What's Next?",
          value:
            "• Use `/profile` to view your account\n• Try `/trending` for personalized picks\n• Set up daily briefings with `/settings`",
          inline: false,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Linking Failed")
        .setDescription(result.message)
        .addFields({
          name: "Troubleshooting",
          value:
            "• Make sure your code is correct\n• Codes expire after 15 minutes\n• Generate a new code if needed",
          inline: false,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  } else if (subcommand === "credentials") {
    await interaction.deferReply({ ephemeral: true });

    const email = interaction.options.get("email")?.value as string;
    const password = interaction.options.get("password")?.value as string;

    const result = await userLinkService.linkUserWithCredentials(
      discordId,
      email,
      password,
    );

    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Successfully Linked!")
        .setDescription(
          "Your Discord account has been linked to Media Gateway.",
        )
        .addFields(
          {
            name: "🎉 What's Next?",
            value:
              "• Use `/profile` to view your account\n• Try `/trending` for personalized picks\n• Set up daily briefings with `/settings`",
            inline: false,
          },
          {
            name: "🔒 Security Note",
            value:
              "Your password was used only for verification and is not stored.",
            inline: false,
          },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Linking Failed")
        .setDescription(result.message)
        .addFields({
          name: "Troubleshooting",
          value:
            "• Check your email and password\n• Make sure you have a Media Gateway account\n• Try using `/link code` instead",
          inline: false,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}

export default {
  data,
  execute,
};
