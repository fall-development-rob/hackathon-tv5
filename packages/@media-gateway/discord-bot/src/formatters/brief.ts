/**
 * Daily brief embed formatter
 * Creates rich, multi-section daily entertainment briefings
 */

import { EmbedBuilder } from "discord.js";

export interface BriefContent {
  id: string;
  title: string;
  type: "movie" | "tv";
  rating?: number;
  posterPath?: string;
  platforms?: string[];
  trendingRank?: number;
  releaseDate?: string;
  isNew?: boolean;
}

export interface DailyBriefData {
  trending: BriefContent[];
  personalized: BriefContent[];
  newReleases: BriefContent[];
  userName?: string;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const BRIEF_COLOR = 0xf39c12; // Gold

/**
 * Formats a brief content item as a compact string
 */
function formatBriefItem(content: BriefContent): string {
  const icon = content.type === "movie" ? "🎬" : "📺";
  const rating = content.rating ? ` ⭐${content.rating.toFixed(1)}` : "";
  const platforms =
    content.platforms && content.platforms.length > 0
      ? ` • 📺 ${content.platforms.slice(0, 2).join(", ")}`
      : "";
  const newBadge = content.isNew ? " 🆕" : "";

  return `${icon} **${content.title}**${rating}${platforms}${newBadge}`;
}

/**
 * Creates the trending section field
 */
function createTrendingSection(trending: BriefContent[]): string {
  if (trending.length === 0) {
    return "_No trending content today_";
  }

  return trending
    .slice(0, 3)
    .map((item, index) => {
      const medals = ["🥇", "🥈", "🥉"];
      const medal = medals[index] || "📊";
      return `${medal} ${formatBriefItem(item)}`;
    })
    .join("\n");
}

/**
 * Creates the personalized recommendations section
 */
function createPersonalizedSection(personalized: BriefContent[]): string {
  if (personalized.length === 0) {
    return "_Update your preferences for personalized picks!_";
  }

  return personalized
    .slice(0, 3)
    .map((item) => `✨ ${formatBriefItem(item)}`)
    .join("\n");
}

/**
 * Creates the new releases section
 */
function createNewReleasesSection(newReleases: BriefContent[]): string {
  if (newReleases.length === 0) {
    return "_No new releases on your platforms today_";
  }

  return newReleases
    .slice(0, 3)
    .map((item) => {
      const date = item.releaseDate ? ` (${item.releaseDate})` : "";
      return `🆕 ${formatBriefItem(item)}${date}`;
    })
    .join("\n");
}

/**
 * Creates a comprehensive daily brief embed
 */
export function createDailyBriefEmbed(data: DailyBriefData): EmbedBuilder {
  const greeting = data.userName ? `${data.userName}'s` : "Your";
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const embed = new EmbedBuilder()
    .setColor(BRIEF_COLOR)
    .setTitle("🎬 Your Daily Entertainment Brief")
    .setDescription(
      `Good morning! Here's what's hot in entertainment today.\n` +
        `*${currentDate}*`,
    )
    .setTimestamp();

  // Add poster from top trending item
  if (data.trending.length > 0 && data.trending[0].posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}${data.trending[0].posterPath}`);
  }

  // Section 1: Trending Today
  embed.addFields({
    name: "🔥 Trending Today",
    value: createTrendingSection(data.trending),
    inline: false,
  });

  // Section 2: Personalized Recommendations
  embed.addFields({
    name: "✨ New for You",
    value: createPersonalizedSection(data.personalized),
    inline: false,
  });

  // Section 3: New Releases
  embed.addFields({
    name: "📺 Just Released",
    value: createNewReleasesSection(data.newReleases),
    inline: false,
  });

  // Add separator
  embed.addFields({
    name: "\u200B",
    value: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    inline: false,
  });

  // Add call to action
  embed.addFields({
    name: "💬 Want More?",
    value:
      "• Reply to chat with me for detailed recommendations\n" +
      '• Ask me "What should I watch tonight?"\n' +
      "• Search with `/search <title>`\n" +
      "• Get recommendations with `/recommend`",
    inline: false,
  });

  embed.setFooter({
    text: `${greeting} Daily Brief • Powered by AI • Reply anytime to chat!`,
  });

  return embed;
}

/**
 * Creates a compact version of the daily brief for mobile
 */
export function createCompactBriefEmbed(data: DailyBriefData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRIEF_COLOR)
    .setTitle("🎬 Daily Brief")
    .setTimestamp();

  const sections: string[] = [];

  // Trending
  if (data.trending.length > 0) {
    sections.push(
      "**🔥 Trending**\n" +
        data.trending
          .slice(0, 2)
          .map((item) => formatBriefItem(item))
          .join("\n"),
    );
  }

  // Personalized
  if (data.personalized.length > 0) {
    sections.push(
      "**✨ For You**\n" +
        data.personalized
          .slice(0, 2)
          .map((item) => formatBriefItem(item))
          .join("\n"),
    );
  }

  // New releases
  if (data.newReleases.length > 0) {
    sections.push(
      "**🆕 New**\n" +
        data.newReleases
          .slice(0, 2)
          .map((item) => formatBriefItem(item))
          .join("\n"),
    );
  }

  embed.setDescription(sections.join("\n\n"));
  embed.setFooter({ text: "Reply to chat for more!" });

  return embed;
}

/**
 * Creates a weekly summary embed
 */
export function createWeeklySummaryEmbed(
  topTrending: BriefContent[],
  topRecommended: BriefContent[],
  stats: { totalWatched?: number; totalRecommendations?: number },
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRIEF_COLOR)
    .setTitle("📊 Your Week in Entertainment")
    .setDescription("Here's a recap of your entertainment week!")
    .setTimestamp();

  // Top trending of the week
  if (topTrending.length > 0) {
    embed.addFields({
      name: "🔥 Top Trending This Week",
      value: topTrending
        .slice(0, 5)
        .map((item, i) => `${i + 1}. ${formatBriefItem(item)}`)
        .join("\n"),
      inline: false,
    });
  }

  // Your top picks
  if (topRecommended.length > 0) {
    embed.addFields({
      name: "⭐ Your Top Picks",
      value: topRecommended
        .slice(0, 5)
        .map((item, i) => `${i + 1}. ${formatBriefItem(item)}`)
        .join("\n"),
      inline: false,
    });
  }

  // Stats
  const statsText: string[] = [];
  if (stats.totalWatched) {
    statsText.push(`📺 ${stats.totalWatched} items watched`);
  }
  if (stats.totalRecommendations) {
    statsText.push(`🎯 ${stats.totalRecommendations} recommendations provided`);
  }

  if (statsText.length > 0) {
    embed.addFields({
      name: "📈 Your Stats",
      value: statsText.join("\n"),
      inline: false,
    });
  }

  embed.setFooter({ text: "Weekly Summary • Keep discovering great content!" });

  return embed;
}

/**
 * Creates an error embed when brief generation fails
 */
export function createBriefErrorEmbed(error?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xe74c3c) // Red
    .setTitle("❌ Brief Unavailable")
    .setDescription(
      "Sorry, I couldn't generate your daily brief right now.\n\n" +
        (error ||
          "Please try again later or use `/search` and `/recommend` commands."),
    )
    .setTimestamp();
}
