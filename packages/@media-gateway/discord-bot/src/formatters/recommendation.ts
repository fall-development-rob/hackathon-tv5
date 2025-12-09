/**
 * Recommendation result embed formatter
 * Formats AI-powered content recommendations as rich Discord embeds
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export interface RecommendationContent {
  id: string;
  title: string;
  type: "movie" | "tv";
  overview?: string;
  rating?: number;
  posterPath?: string;
  releaseDate?: string;
  genres?: string[];
  availableOn?: string[];
  deepLink?: string;
  matchScore?: number;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const EMBED_COLORS = {
  movie: 0x3498db, // Blue
  tv: 0x9b59b6, // Purple
} as const;

/**
 * Converts numeric rating to star emoji representation
 */
function formatRating(rating?: number): string {
  if (!rating) return "No rating";

  const stars = Math.round(rating / 2); // Convert 10-point to 5-star
  const fullStars = "⭐".repeat(stars);
  const emptyStars = "☆".repeat(5 - stars);

  return `${fullStars}${emptyStars} ${rating.toFixed(1)}/10`;
}

/**
 * Formats platform availability with icons
 */
function formatAvailability(platforms?: string[]): string {
  if (!platforms || platforms.length === 0) {
    return "❌ Not currently available";
  }

  const platformIcons: Record<string, string> = {
    netflix: "🔴 Netflix",
    "disney+": "➕ Disney+",
    "hbo max": "🎬 HBO Max",
    "amazon prime": "📦 Prime Video",
    hulu: "🟢 Hulu",
    "apple tv+": "🍎 Apple TV+",
  };

  const formatted = platforms.map((platform) => {
    const normalized = platform.toLowerCase();
    return platformIcons[normalized] || `📺 ${platform}`;
  });

  return formatted.join(", ");
}

/**
 * Creates a recommendation embed for a single content item
 */
export function createRecommendationEmbed(
  content: RecommendationContent,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS[content.type])
    .setTitle(content.title)
    .setTimestamp();

  // Add poster image if available
  if (content.posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}${content.posterPath}`);
  }

  // Add overview/description
  if (content.overview) {
    const truncated =
      content.overview.length > 200
        ? `${content.overview.substring(0, 197)}...`
        : content.overview;
    embed.setDescription(truncated);
  }

  // Add fields
  if (content.rating) {
    embed.addFields({
      name: "⭐ Rating",
      value: formatRating(content.rating),
      inline: true,
    });
  }

  if (content.releaseDate) {
    embed.addFields({
      name: "📅 Released",
      value: content.releaseDate,
      inline: true,
    });
  }

  if (content.matchScore) {
    embed.addFields({
      name: "🎯 Match Score",
      value: `${Math.round(content.matchScore * 100)}%`,
      inline: true,
    });
  }

  if (content.genres && content.genres.length > 0) {
    embed.addFields({
      name: "🎭 Genres",
      value: content.genres.join(", "),
      inline: false,
    });
  }

  embed.addFields({
    name: "📺 Availability",
    value: formatAvailability(content.availableOn),
    inline: false,
  });

  embed.setFooter({
    text: `${content.type === "movie" ? "🎬 Movie" : "📺 TV Show"} • Powered by AI recommendations`,
  });

  return embed;
}

/**
 * Creates action buttons for recommendation interactions
 */
export function createRecommendationButtons(
  content: RecommendationContent,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  // Deep link button (if available)
  if (content.deepLink) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel("Watch Now")
        .setStyle(ButtonStyle.Link)
        .setURL(content.deepLink)
        .setEmoji("▶️"),
    );
  }

  // TMDB details button
  const tmdbUrl =
    content.type === "movie"
      ? `https://www.themoviedb.org/movie/${content.id}`
      : `https://www.themoviedb.org/tv/${content.id}`;

  row.addComponents(
    new ButtonBuilder()
      .setLabel("View Details")
      .setStyle(ButtonStyle.Link)
      .setURL(tmdbUrl)
      .setEmoji("ℹ️"),
  );

  // Save for later button (custom action)
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`save_${content.type}_${content.id}`)
      .setLabel("Save")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("💾"),
  );

  return row;
}

/**
 * Creates a summary embed for multiple recommendations
 */
export function createRecommendationsSummaryEmbed(
  recommendations: RecommendationContent[],
  queryContext?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71) // Green for success
    .setTitle("🎯 Your Personalized Recommendations")
    .setTimestamp();

  if (queryContext) {
    embed.setDescription(`Based on your interest in: *${queryContext}*`);
  }

  // Add top recommendations as fields
  recommendations.slice(0, 5).forEach((rec, index) => {
    const icon = rec.type === "movie" ? "🎬" : "📺";
    const rating = rec.rating ? `⭐ ${rec.rating.toFixed(1)}` : "";
    const platforms =
      rec.availableOn && rec.availableOn.length > 0
        ? ` • 📺 ${rec.availableOn.slice(0, 2).join(", ")}`
        : " • ❌ Not available";

    embed.addFields({
      name: `${index + 1}. ${icon} ${rec.title}`,
      value: `${rating}${platforms}`,
      inline: false,
    });
  });

  if (recommendations.length > 5) {
    embed.addFields({
      name: "\u200B",
      value: `*And ${recommendations.length - 5} more recommendations...*`,
      inline: false,
    });
  }

  embed.setFooter({
    text: `${recommendations.length} recommendations • React with 🔢 to see details`,
  });

  return embed;
}
