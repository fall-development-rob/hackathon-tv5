/**
 * Type definitions for Discord Bot MCP client
 */

export interface SearchOptions {
  type?: "movie" | "tv" | "all";
  genre?: string;
  year?: number;
  minRating?: number;
  limit?: number;
  offset?: number;
}

export interface RecommendationOptions {
  limit?: number;
  genre?: string;
  excludeWatched?: boolean;
}

export interface AvailabilityInfo {
  contentId: string;
  region: string;
  available: boolean;
  providers: Array<{
    name: string;
    type: "subscription" | "rent" | "buy";
    price?: number;
    url?: string;
  }>;
}

export interface MediaDetails {
  id: string;
  title: string;
  type: "movie" | "tv";
  overview?: string;
  releaseDate?: string;
  rating?: number;
  genres?: string[];
  cast?: string[];
  director?: string;
  runtime?: number;
  seasons?: number;
  episodes?: number;
  posterUrl?: string;
  backdropUrl?: string;
}

export interface TrendingItem {
  id: string;
  title: string;
  type: "movie" | "tv";
  rating?: number;
  popularity?: number;
  posterUrl?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  type: "movie" | "tv";
  year?: number;
  rating?: number;
  overview?: string;
  posterUrl?: string;
}

export interface DailyBrief {
  userId: string;
  generatedAt: string;
  trending: TrendingItem[];
  newReleases: SearchResult[];
  recommendations: SearchResult[];
  insights: {
    summary: string;
    highlights: string[];
    personalizedNote?: string;
  };
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationContext {
  userId: string;
  conversationHistory: AgentMessage[];
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

export interface AgentResponse {
  message: string;
  toolCalls?: ToolCall[];
  data?: any;
}
