/**
 * Daily Brief Generator Service
 * Generates personalized daily briefs with trending content,
 * new releases, and AI-powered insights
 */

import Anthropic from "@anthropic-ai/sdk";
import { MediaGatewayAgent } from "../mcp-client";
import { DailyBrief, TrendingItem, SearchResult } from "../types";

/**
 * Configuration for brief generation
 */
export interface BriefGeneratorConfig {
  trendingLimit?: number;
  newReleasesLimit?: number;
  recommendationsLimit?: number;
  model?: string;
  maxTokens?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<BriefGeneratorConfig> = {
  trendingLimit: 5,
  newReleasesLimit: 5,
  recommendationsLimit: 5,
  model: "claude-3-5-sonnet-20241022",
  maxTokens: 2048,
};

/**
 * Daily Brief Generator
 */
export class BriefGenerator {
  private agent: MediaGatewayAgent;
  private config: Required<BriefGeneratorConfig>;

  constructor(agent: MediaGatewayAgent, config: BriefGeneratorConfig = {}) {
    this.agent = agent;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a daily brief for a user
   * @param userId - User ID to generate brief for
   * @returns Daily brief with content and insights
   */
  async generateDailyBrief(userId: string): Promise<DailyBrief> {
    // Fetch all data in parallel
    const [trending, newReleases, recommendations] = await Promise.all([
      this.agent.getTrending(this.config.trendingLimit),
      this.fetchNewReleases(),
      this.agent.getRecommendations(userId, {
        limit: this.config.recommendationsLimit,
        excludeWatched: true,
      }),
    ]);

    // Generate AI insights
    const insights = await this.generateInsights(
      userId,
      trending,
      newReleases,
      recommendations,
    );

    return {
      userId,
      generatedAt: new Date().toISOString(),
      trending,
      newReleases,
      recommendations,
      insights,
    };
  }

  /**
   * Fetch new releases from the past 30 days
   * @returns Array of new releases
   */
  private async fetchNewReleases(): Promise<SearchResult[]> {
    const currentYear = new Date().getFullYear();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Search for recent releases
    const results = await this.agent.search("", {
      year: currentYear,
      limit: this.config.newReleasesLimit,
    });

    // Filter to only include items from the last 30 days
    return results.filter((item) => {
      if (!item.year) return false;
      const releaseDate = new Date(item.year, 0, 1);
      return releaseDate >= thirtyDaysAgo;
    });
  }

  /**
   * Generate AI-powered insights using Claude
   * @param userId - User ID
   * @param trending - Trending content
   * @param newReleases - New releases
   * @param recommendations - Personalized recommendations
   * @returns Structured insights
   */
  private async generateInsights(
    userId: string,
    trending: TrendingItem[],
    newReleases: SearchResult[],
    recommendations: SearchResult[],
  ): Promise<DailyBrief["insights"]> {
    const anthropic = this.agent.getAnthropicClient();

    const prompt = this.buildInsightsPrompt(
      trending,
      newReleases,
      recommendations,
    );

    const response = await anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return this.parseInsights(textContent);
  }

  /**
   * Build prompt for insights generation
   * @param trending - Trending content
   * @param newReleases - New releases
   * @param recommendations - Personalized recommendations
   * @returns Formatted prompt
   */
  private buildInsightsPrompt(
    trending: TrendingItem[],
    newReleases: SearchResult[],
    recommendations: SearchResult[],
  ): string {
    return `You are a media content curator generating a daily brief for a user.

**Trending Content:**
${trending.map((item, i) => `${i + 1}. ${item.title} (${item.type}${item.rating ? `, Rating: ${item.rating}` : ""})`).join("\n")}

**New Releases:**
${newReleases.map((item, i) => `${i + 1}. ${item.title} (${item.type}${item.rating ? `, Rating: ${item.rating}` : ""})`).join("\n")}

**Personalized Recommendations:**
${recommendations.map((item, i) => `${i + 1}. ${item.title} (${item.type}${item.rating ? `, Rating: ${item.rating}` : ""})`).join("\n")}

Generate a daily brief with the following structure:

1. **SUMMARY**: A 2-3 sentence overview of today's content landscape
2. **HIGHLIGHTS**: 3-5 bullet points of the most interesting content (mix of trending, new, and recommended)
3. **PERSONALIZED_NOTE**: A brief personalized message for the user based on their recommendations

Format your response EXACTLY like this:
SUMMARY: [Your summary text here]
HIGHLIGHTS:
- [Highlight 1]
- [Highlight 2]
- [Highlight 3]
PERSONALIZED_NOTE: [Your personalized note here]

Keep the language casual, enthusiastic, and focused on what makes each piece of content worth watching.`;
  }

  /**
   * Parse Claude's insights response into structured format
   * @param text - Raw text response from Claude
   * @returns Structured insights object
   */
  private parseInsights(text: string): DailyBrief["insights"] {
    const insights: DailyBrief["insights"] = {
      summary: "",
      highlights: [],
      personalizedNote: undefined,
    };

    // Extract summary
    const summaryMatch = text.match(/SUMMARY:\s*(.+?)(?=\nHIGHLIGHTS:|$)/s);
    if (summaryMatch) {
      insights.summary = summaryMatch[1].trim();
    }

    // Extract highlights
    const highlightsMatch = text.match(/HIGHLIGHTS:\s*\n((?:[-•]\s*.+\n?)+)/);
    if (highlightsMatch) {
      insights.highlights = highlightsMatch[1]
        .split("\n")
        .filter(
          (line) => line.trim().startsWith("-") || line.trim().startsWith("•"),
        )
        .map((line) => line.replace(/^[-•]\s*/, "").trim())
        .filter((line) => line.length > 0);
    }

    // Extract personalized note
    const personalizedMatch = text.match(/PERSONALIZED_NOTE:\s*(.+?)$/s);
    if (personalizedMatch) {
      insights.personalizedNote = personalizedMatch[1].trim();
    }

    // Fallback: if parsing failed, use the entire text as summary
    if (!insights.summary && !insights.highlights.length) {
      insights.summary = text.trim();
      insights.highlights = ["Check out the latest trending content!"];
    }

    return insights;
  }

  /**
   * Format a daily brief for Discord embed
   * @param brief - Daily brief to format
   * @returns Formatted embed data
   */
  static formatForDiscord(brief: DailyBrief): {
    title: string;
    description: string;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    timestamp: string;
  } {
    return {
      title: "🎬 Your Daily Media Brief",
      description: brief.insights.summary,
      fields: [
        {
          name: "📈 Trending Now",
          value:
            brief.trending.length > 0
              ? brief.trending
                  .map(
                    (item, i) =>
                      `${i + 1}. **${item.title}** (${item.type}${item.rating ? ` ⭐ ${item.rating.toFixed(1)}` : ""})`,
                  )
                  .join("\n")
              : "No trending content available",
          inline: false,
        },
        {
          name: "🆕 New Releases",
          value:
            brief.newReleases.length > 0
              ? brief.newReleases
                  .map(
                    (item, i) =>
                      `${i + 1}. **${item.title}** (${item.type}${item.rating ? ` ⭐ ${item.rating.toFixed(1)}` : ""})`,
                  )
                  .join("\n")
              : "No new releases available",
          inline: false,
        },
        {
          name: "💡 Recommended For You",
          value:
            brief.recommendations.length > 0
              ? brief.recommendations
                  .map(
                    (item, i) =>
                      `${i + 1}. **${item.title}** (${item.type}${item.rating ? ` ⭐ ${item.rating.toFixed(1)}` : ""})`,
                  )
                  .join("\n")
              : "No recommendations available",
          inline: false,
        },
        {
          name: "✨ Highlights",
          value: brief.insights.highlights.join("\n"),
          inline: false,
        },
        ...(brief.insights.personalizedNote
          ? [
              {
                name: "💬 Just For You",
                value: brief.insights.personalizedNote,
                inline: false,
              },
            ]
          : []),
      ],
      timestamp: brief.generatedAt,
    };
  }
}
