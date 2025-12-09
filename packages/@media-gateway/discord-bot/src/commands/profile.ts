/**
 * /profile command - Display user profile and linked account info
 */

import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { UserLinkService } from "../services/user-link";
import { PostgreSQLConnectionPool } from "@media-gateway/database";

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View your Media Gateway profile and linked account info");

export async function execute(
  interaction: CommandInteraction,
  pool: PostgreSQLConnectionPool,
) {
  await interaction.deferReply({ ephemeral: true });

  const userLinkService = new UserLinkService(pool);
  const discordId = interaction.user.id;

  // Check if user is linked
  const isLinked = await userLinkService.isLinked(discordId);

  if (!isLinked) {
    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle("🔗 Account Not Linked")
      .setDescription(
        "Link your Discord account to Media Gateway to access personalized features!",
      )
      .addFields(
        {
          name: "🌟 Why Link?",
          value:
            "• Access your My List\n• Get personalized recommendations\n• Sync watch history\n• Daily content briefings",
          inline: false,
        },
        {
          name: "🚀 Get Started",
          value: "Use `/link instructions` to learn how to link your account.",
          inline: false,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Get full user profile
  const profile = await userLinkService.getUserProfile(discordId);

  if (!profile) {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Error Loading Profile")
      .setDescription("Failed to load your profile. Please try again later.")
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Format linked date
  const linkedDate = new Date(profile.linked_at);
  const linkedDateStr = linkedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build subscription platforms string
  const platforms =
    profile.subscription_platforms.length > 0
      ? profile.subscription_platforms.join(", ")
      : "Not set (use `/settings platforms` to configure)";

  // Build embed
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("👤 Your Media Gateway Profile")
    .setDescription(`Linked since ${linkedDateStr}`)
    .addFields(
      {
        name: "📧 Email",
        value: profile.email || "Not available",
        inline: true,
      },
      {
        name: "👤 Username",
        value: profile.username || "Not set",
        inline: true,
      },
      {
        name: "📝 My List",
        value: `${profile.my_list_count} items`,
        inline: true,
      },
      {
        name: "🎬 Subscription Platforms",
        value: platforms,
        inline: false,
      },
      {
        name: "⚙️ Preferences",
        value: [
          `Daily Briefing: ${profile.preferences.brief_enabled ? "✅ Enabled" : "❌ Disabled"}`,
          `Brief Time: ${profile.preferences.brief_time}`,
          `Region: ${profile.preferences.preferred_region}`,
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter({
      text: `User ID: ${profile.user_id.substring(0, 8)}...`,
    })
    .setTimestamp();

  // Add thumbnail (Discord avatar)
  embed.setThumbnail(interaction.user.displayAvatarURL());

  await interaction.editReply({ embeds: [embed] });
}

export default {
  data,
  execute,
};
