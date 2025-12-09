/**
 * Content detail embed formatter
 * Creates comprehensive embeds for individual content items
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export interface ContentDetails {
  id: string;
  title: string;
  type: "movie" | "tv";
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  rating?: number;
  voteCount?: number;
  releaseDate?: string;
  runtime?: number; // minutes
  numberOfSeasons?: number;
  genres?: string[];
  cast?: string[];
  directors?: string[];
  creators?: string[];
  availableOn?: Array<{
    platform: string;
    link?: string;
    priceInfo?: string;
  }>;
  trailerUrl?: string;
  homepage?: string;
  status?: string;
  tagline?: string;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const CONTENT_COLORS = {
  movie: 0x3498db,
  tv: 0x9b59b6,
} as const;

/**
 * Formats runtime in hours and minutes
 */
function formatRuntime(minutes?: number): string {
  if (!minutes) return "Unknown";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Formats rating with stars and vote count
 */
function formatRating(rating?: number, voteCount?: number): string {
  if (!rating) return "No rating";

  const stars = Math.round(rating / 2);
  const fullStars = "⭐".repeat(stars);
  const emptyStars = "☆".repeat(5 - stars);
  const votes = voteCount ? ` (${voteCount.toLocaleString()} votes)` : "";

  return `${fullStars}${emptyStars} ${rating.toFixed(1)}/10${votes}`;
}

/**
 * Formats availability information with platform icons
 */
function formatAvailability(
  availability?: Array<{ platform: string; link?: string; priceInfo?: string }>,
): string {
  if (!availability || availability.length === 0) {
    return "❌ Not currently available on tracked platforms";
  }

  const platformIcons: Record<string, string> = {
    netflix: "🔴",
    "disney+": "➕",
    "hbo max": "🎬",
    "amazon prime": "📦",
    hulu: "🟢",
    "apple tv+": "🍎",
  };

  return availability
    .map(({ platform, priceInfo }) => {
      const normalized = platform.toLowerCase();
      const icon = platformIcons[normalized] || "📺";
      const price = priceInfo ? ` (${priceInfo})` : "";
      return `${icon} ${platform}${price}`;
    })
    .join("\n");
}

/**
 * Creates a comprehensive content detail embed
 */
export function createContentDetailEmbed(
  content: ContentDetails,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(CONTENT_COLORS[content.type])
    .setTitle(content.title)
    .setTimestamp();

  // Add tagline if available
  if (content.tagline) {
    embed.setDescription(`*"${content.tagline}"*\n\n${content.overview || ""}`);
  } else if (content.overview) {
    embed.setDescription(content.overview);
  }

  // Add backdrop image for visual impact
  if (content.backdropPath) {
    embed.setImage(`${TMDB_IMAGE_BASE}${content.backdropPath}`);
  }

  // Add poster as thumbnail
  if (content.posterPath) {
    embed.setThumbnail(`${POSTER_BASE}${content.posterPath}`);
  }

  // Rating field
  if (content.rating) {
    embed.addFields({
      name: "⭐ Rating",
      value: formatRating(content.rating, content.voteCount),
      inline: true,
    });
  }

  // Release date / status
  if (content.releaseDate) {
    const dateLabel =
      content.type === "movie" ? "📅 Release Date" : "📅 First Aired";
    embed.addFields({
      name: dateLabel,
      value: content.releaseDate,
      inline: true,
    });
  }

  // Runtime or seasons
  if (content.type === "movie" && content.runtime) {
    embed.addFields({
      name: "⏱️ Runtime",
      value: formatRuntime(content.runtime),
      inline: true,
    });
  } else if (content.type === "tv" && content.numberOfSeasons) {
    embed.addFields({
      name: "📺 Seasons",
      value: content.numberOfSeasons.toString(),
      inline: true,
    });
  }

  // Status (for TV shows)
  if (content.type === "tv" && content.status) {
    embed.addFields({
      name: "📊 Status",
      value: content.status,
      inline: true,
    });
  }

  // Genres
  if (content.genres && content.genres.length > 0) {
    embed.addFields({
      name: "🎭 Genres",
      value: content.genres.join(" • "),
      inline: false,
    });
  }

  // Cast
  if (content.cast && content.cast.length > 0) {
    embed.addFields({
      name: "🎬 Cast",
      value: content.cast.slice(0, 5).join(", "),
      inline: false,
    });
  }

  // Directors or creators
  if (
    content.type === "movie" &&
    content.directors &&
    content.directors.length > 0
  ) {
    embed.addFields({
      name: "🎥 Director",
      value: content.directors.join(", "),
      inline: false,
    });
  } else if (
    content.type === "tv" &&
    content.creators &&
    content.creators.length > 0
  ) {
    embed.addFields({
      name: "✍️ Created By",
      value: content.creators.join(", "),
      inline: false,
    });
  }

  // Availability
  embed.addFields({
    name: "📺 Where to Watch",
    value: formatAvailability(content.availableOn),
    inline: false,
  });

  // Footer
  const typeLabel = content.type === "movie" ? "🎬 Movie" : "📺 TV Show";
  embed.setFooter({ text: `${typeLabel} • ID: ${content.id}` });

  return embed;
}

/**
 * Creates action buttons for content detail view
 */
export function createContentDetailButtons(
  content: ContentDetails,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const row1 = new ActionRowBuilder<ButtonBuilder>();

  // Watch now button (if available on platforms)
  const primaryPlatform = content.availableOn?.find((p) => p.link);
  if (primaryPlatform?.link) {
    row1.addComponents(
      new ButtonBuilder()
        .setLabel(`Watch on ${primaryPlatform.platform}`)
        .setStyle(ButtonStyle.Link)
        .setURL(primaryPlatform.link)
        .setEmoji("▶️"),
    );
  }

  // Trailer button
  if (content.trailerUrl) {
    row1.addComponents(
      new ButtonBuilder()
        .setLabel("Watch Trailer")
        .setStyle(ButtonStyle.Link)
        .setURL(content.trailerUrl)
        .setEmoji("🎥"),
    );
  }

  // Homepage button
  if (content.homepage) {
    row1.addComponents(
      new ButtonBuilder()
        .setLabel("Official Site")
        .setStyle(ButtonStyle.Link)
        .setURL(content.homepage)
        .setEmoji("🌐"),
    );
  }

  // TMDB link
  const tmdbUrl =
    content.type === "movie"
      ? `https://www.themoviedb.org/movie/${content.id}`
      : `https://www.themoviedb.org/tv/${content.id}`;

  row1.addComponents(
    new ButtonBuilder()
      .setLabel("TMDB")
      .setStyle(ButtonStyle.Link)
      .setURL(tmdbUrl)
      .setEmoji("ℹ️"),
  );

  if (row1.components.length > 0) {
    rows.push(row1);
  }

  // Second row with interaction buttons
  const row2 = new ActionRowBuilder<ButtonBuilder>();

  row2.addComponents(
    new ButtonBuilder()
      .setCustomId(`similar_${content.type}_${content.id}`)
      .setLabel("Similar Content")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎯"),

    new ButtonBuilder()
      .setCustomId(`watchlist_${content.type}_${content.id}`)
      .setLabel("Add to Watchlist")
      .setStyle(ButtonStyle.Success)
      .setEmoji("📌"),

    new ButtonBuilder()
      .setCustomId(`share_${content.type}_${content.id}`)
      .setLabel("Share")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("📤"),
  );

  rows.push(row2);

  return rows;
}

/**
 * Creates a compact content card for lists
 */
export function createContentCardEmbed(content: ContentDetails): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(CONTENT_COLORS[content.type])
    .setTitle(content.title)
    .setTimestamp();

  if (content.posterPath) {
    embed.setThumbnail(`${POSTER_BASE}${content.posterPath}`);
  }

  // Compact description
  if (content.overview) {
    const truncated =
      content.overview.length > 150
        ? `${content.overview.substring(0, 147)}...`
        : content.overview;
    embed.setDescription(truncated);
  }

  // Key info in a single field
  const infoLines: string[] = [];

  if (content.rating) {
    infoLines.push(`⭐ ${content.rating.toFixed(1)}/10`);
  }

  if (content.releaseDate) {
    infoLines.push(`📅 ${content.releaseDate}`);
  }

  if (content.type === "movie" && content.runtime) {
    infoLines.push(`⏱️ ${formatRuntime(content.runtime)}`);
  } else if (content.type === "tv" && content.numberOfSeasons) {
    infoLines.push(
      `📺 ${content.numberOfSeasons} season${content.numberOfSeasons !== 1 ? "s" : ""}`,
    );
  }

  if (infoLines.length > 0) {
    embed.addFields({
      name: "Info",
      value: infoLines.join(" • "),
      inline: false,
    });
  }

  // Availability
  if (content.availableOn && content.availableOn.length > 0) {
    const platforms = content.availableOn
      .slice(0, 3)
      .map((p) => p.platform)
      .join(", ");
    embed.addFields({
      name: "📺 Available On",
      value: platforms,
      inline: false,
    });
  }

  const typeEmoji = content.type === "movie" ? "🎬" : "📺";
  embed.setFooter({ text: `${typeEmoji} ${content.type.toUpperCase()}` });

  return embed;
}
