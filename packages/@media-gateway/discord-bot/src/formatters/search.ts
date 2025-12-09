/**
 * Search result embed formatter
 * Formats content search results as paginated Discord embeds
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export interface SearchResult {
  id: string;
  title: string;
  type: "movie" | "tv";
  year?: number;
  overview?: string;
  rating?: number;
  posterPath?: string;
  popularity?: number;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const RESULTS_PER_PAGE = 5;

/**
 * Creates a search results embed for a page of results
 */
export function createSearchResultsEmbed(
  results: SearchResult[],
  query: string,
  page: number = 0,
  totalResults: number = results.length,
): EmbedBuilder {
  const startIndex = page * RESULTS_PER_PAGE;
  const endIndex = Math.min(startIndex + RESULTS_PER_PAGE, results.length);
  const pageResults = results.slice(startIndex, endIndex);
  const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c) // Red for search
    .setTitle(`🔍 Search Results: "${query}"`)
    .setDescription(
      `Found ${totalResults} result${totalResults !== 1 ? "s" : ""}`,
    )
    .setTimestamp();

  // Add each result as a field
  pageResults.forEach((result, index) => {
    const actualIndex = startIndex + index + 1;
    const icon = result.type === "movie" ? "🎬" : "📺";
    const year = result.year ? ` (${result.year})` : "";
    const rating = result.rating ? ` • ⭐ ${result.rating.toFixed(1)}` : "";

    let overview = result.overview || "No description available";
    if (overview.length > 150) {
      overview = `${overview.substring(0, 147)}...`;
    }

    embed.addFields({
      name: `${actualIndex}. ${icon} ${result.title}${year}${rating}`,
      value: overview,
      inline: false,
    });
  });

  // Add footer with pagination info
  const footerText =
    totalPages > 1
      ? `Page ${page + 1} of ${totalPages} • Type a number to see details`
      : "Type a number to see details";

  embed.setFooter({ text: footerText });

  return embed;
}

/**
 * Creates pagination buttons for search results
 */
export function createSearchPaginationButtons(
  currentPage: number,
  totalPages: number,
  searchId: string,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  // Previous button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`search_prev_${searchId}_${currentPage}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("⬅️")
      .setDisabled(currentPage === 0),
  );

  // Page indicator
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`search_page_${searchId}_${currentPage}`)
      .setLabel(`${currentPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  // Next button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`search_next_${searchId}_${currentPage}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("➡️")
      .setDisabled(currentPage >= totalPages - 1),
  );

  return row;
}

/**
 * Creates a detailed embed for a single search result
 */
export function createSearchDetailEmbed(result: SearchResult): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(result.type === "movie" ? 0x3498db : 0x9b59b6)
    .setTitle(result.title)
    .setTimestamp();

  // Add large poster image
  if (result.posterPath) {
    embed.setImage(`${TMDB_IMAGE_BASE}${result.posterPath}`);
  }

  // Add description
  if (result.overview) {
    embed.setDescription(result.overview);
  }

  // Add metadata fields
  if (result.year) {
    embed.addFields({
      name: "📅 Year",
      value: result.year.toString(),
      inline: true,
    });
  }

  if (result.rating) {
    const stars = "⭐".repeat(Math.round(result.rating / 2));
    embed.addFields({
      name: "⭐ Rating",
      value: `${stars} ${result.rating.toFixed(1)}/10`,
      inline: true,
    });
  }

  if (result.popularity) {
    embed.addFields({
      name: "🔥 Popularity",
      value: Math.round(result.popularity).toString(),
      inline: true,
    });
  }

  // Add type badge
  const typeEmoji = result.type === "movie" ? "🎬" : "📺";
  const typeLabel = result.type === "movie" ? "Movie" : "TV Show";

  embed.setFooter({ text: `${typeEmoji} ${typeLabel}` });

  return embed;
}

/**
 * Creates action buttons for a search result detail view
 */
export function createSearchDetailButtons(
  result: SearchResult,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  // TMDB link
  const tmdbUrl =
    result.type === "movie"
      ? `https://www.themoviedb.org/movie/${result.id}`
      : `https://www.themoviedb.org/tv/${result.id}`;

  row.addComponents(
    new ButtonBuilder()
      .setLabel("View on TMDB")
      .setStyle(ButtonStyle.Link)
      .setURL(tmdbUrl)
      .setEmoji("🔗"),
  );

  // Get recommendations based on this content
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`recommend_${result.type}_${result.id}`)
      .setLabel("Similar Content")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🎯"),
  );

  // Add to watchlist
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`watchlist_${result.type}_${result.id}`)
      .setLabel("Add to Watchlist")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("📌"),
  );

  return row;
}

/**
 * Creates an empty search results embed
 */
export function createEmptySearchEmbed(query: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x95a5a6) // Gray
    .setTitle("🔍 No Results Found")
    .setDescription(`Sorry, I couldn't find any content matching "${query}"`)
    .addFields({
      name: "💡 Tips",
      value:
        "• Check your spelling\n" +
        "• Try more general terms\n" +
        "• Search for actors or directors\n" +
        "• Use the original title for foreign content",
      inline: false,
    })
    .setTimestamp();
}
