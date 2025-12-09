/**
 * Utility to check if user is linked and prompt if not
 */

import { EmbedBuilder, CommandInteraction } from "discord.js";
import { UserLinkService } from "../services/user-link";

/**
 * Check if user is linked and return appropriate response
 * @param interaction - Discord interaction
 * @param service - UserLinkService instance
 * @param featureName - Name of the feature requiring linking
 * @returns true if linked, false if not (and sends prompt to link)
 */
export async function requireLinkedAccount(
  interaction: CommandInteraction,
  service: UserLinkService,
  featureName: string = "this feature",
): Promise<boolean> {
  const isLinked = await service.isLinked(interaction.user.id);

  if (!isLinked) {
    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle("🔗 Account Not Linked")
      .setDescription(`Link your Discord account to access ${featureName}!`)
      .addFields(
        {
          name: "🌟 Benefits",
          value:
            "• Personalized recommendations\n• Access your My List\n• Daily content briefings\n• Watch history sync",
          inline: false,
        },
        {
          name: "🚀 Get Started",
          value: "Use `/link instructions` to learn how to link your account.",
          inline: false,
        },
      )
      .setFooter({ text: "Basic features are still available without linking" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return false;
  }

  return true;
}

/**
 * Get linked user ID or send prompt
 * @param interaction - Discord interaction
 * @param service - UserLinkService instance
 * @param featureName - Name of the feature requiring linking
 * @returns user_id if linked, null if not
 */
export async function getLinkedUserOrPrompt(
  interaction: CommandInteraction,
  service: UserLinkService,
  featureName: string = "this feature",
): Promise<string | null> {
  const userId = await service.getLinkedUser(interaction.user.id);

  if (!userId) {
    await requireLinkedAccount(interaction, service, featureName);
    return null;
  }

  return userId;
}
