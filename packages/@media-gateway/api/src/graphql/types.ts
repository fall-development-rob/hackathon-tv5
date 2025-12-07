/**
 * GraphQL Type Definitions
 * SPARC FR-4.2: GraphQL API Schema Types
 */

import { gql } from 'graphql-tag';

export const typeDefs = gql`
  """
  Enumeration of media content types
  """
  enum MediaType {
    MOVIE
    TV
    DOCUMENTARY
  }

  """
  Time window for trending content queries
  """
  enum TimeWindow {
    DAY
    WEEK
  }

  """
  Types of content availability on platforms
  """
  enum AvailabilityType {
    SUBSCRIPTION
    RENT
    BUY
    FREE
  }

  """
  Platform availability details for content
  """
  type PlatformAvailability {
    """Platform providing the content"""
    platform: Platform!
    """Type of availability (subscription, rent, etc.)"""
    type: AvailabilityType!
    """Price in USD (null for subscription/free)"""
    price: Float
    """Video quality (HD, 4K, etc.)"""
    quality: String
    """Deep link URL to content on platform"""
    deepLink: String!
  }

  """
  Streaming platform information
  """
  type Platform {
    """Unique platform identifier"""
    id: ID!
    """Platform display name"""
    name: String!
    """URL to platform logo"""
    logoPath: String
    """Template for generating deep links"""
    deepLinkTemplate: String!
  }

  """
  Media content (movie, TV show, documentary)
  """
  type Content {
    """Unique content identifier"""
    id: ID!
    """Content title"""
    title: String!
    """Content description/synopsis"""
    overview: String
    """Type of media content"""
    mediaType: MediaType!
    """List of genre names"""
    genres: [String!]!
    """Average user rating (0-10)"""
    rating: Float
    """Release date (ISO 8601 format)"""
    releaseDate: String
    """URL to poster image"""
    posterPath: String
    """URL to backdrop image"""
    backdropPath: String
    """Platform availability information"""
    availability: [PlatformAvailability!]!
  }

  """
  User preferences for content recommendations
  """
  type UserPreferences {
    """Preferred genres"""
    genres: [String!]!
    """Preferred moods/themes"""
    moods: [String!]!
    """Preferred streaming platforms"""
    preferredPlatforms: [ID!]!
  }

  """
  User account and profile
  """
  type User {
    """Unique user identifier"""
    id: ID!
    """User's display name"""
    username: String!
    """User's email address"""
    email: String!
    """User content preferences"""
    preferences: UserPreferences!
    """Recently watched content"""
    watchHistory: [Content!]!
  }

  """
  Content recommendation with metadata
  """
  type Recommendation {
    """Recommended content"""
    content: Content!
    """Recommendation score (0-100)"""
    score: Float!
    """Human-readable reason for recommendation"""
    reason: String!
    """Confidence level (0-1)"""
    confidence: Float!
  }

  """
  Group viewing session for collaborative content selection
  """
  type GroupSession {
    """Unique session identifier"""
    id: ID!
    """Group identifier"""
    groupId: ID!
    """User who initiated the session"""
    initiatorId: ID!
    """Current voting results"""
    votes: [GroupVote!]!
    """Timestamp when session was created"""
    createdAt: String!
    """Session status"""
    status: SessionStatus!
  }

  """
  Individual vote in a group session
  """
  type GroupVote {
    """User who voted"""
    userId: ID!
    """Content being voted on"""
    contentId: ID!
    """Vote score (1-10)"""
    score: Int!
  }

  """
  Group session status
  """
  enum SessionStatus {
    ACTIVE
    COMPLETED
    CANCELLED
  }

  """
  Search filters for content queries
  """
  input SearchFiltersInput {
    """Filter by media type"""
    mediaType: MediaType
    """Filter by genres"""
    genres: [String!]
    """Minimum release year"""
    yearMin: Int
    """Maximum release year"""
    yearMax: Int
    """Minimum rating (0-10)"""
    ratingMin: Float
  }

  """
  User preferences update input
  """
  input PreferencesInput {
    """Preferred genres"""
    genres: [String!]
    """Preferred moods/themes"""
    moods: [String!]
    """Preferred streaming platforms"""
    preferredPlatforms: [ID!]
  }

  """
  Root query type
  """
  type Query {
    """
    Search for content with optional filters
    """
    search(
      """Search query string"""
      query: String!
      """Optional search filters"""
      filters: SearchFiltersInput
      """Maximum number of results (default: 20)"""
      limit: Int
    ): [Content!]!

    """
    Get personalized content recommendations
    """
    recommendations(
      """User ID for personalized recommendations"""
      userId: ID
      """Maximum number of recommendations (default: 10)"""
      limit: Int
    ): [Recommendation!]!

    """
    Get content details by ID
    """
    content(
      """Content ID"""
      id: ID!
    ): Content

    """
    Get user profile and preferences
    """
    user(
      """User ID (defaults to authenticated user)"""
      id: ID
    ): User

    """
    List all available streaming platforms
    """
    platforms: [Platform!]!

    """
    Get trending content
    """
    trending(
      """Filter by media type"""
      mediaType: MediaType
      """Time window for trending calculation"""
      timeWindow: TimeWindow
    ): [Content!]!
  }

  """
  Root mutation type
  """
  type Mutation {
    """
    Add content to user's watchlist
    """
    addToWatchlist(
      """User ID"""
      userId: ID!
      """Content ID to add"""
      contentId: ID!
    ): Boolean!

    """
    Remove content from user's watchlist
    """
    removeFromWatchlist(
      """User ID"""
      userId: ID!
      """Content ID to remove"""
      contentId: ID!
    ): Boolean!

    """
    Rate content
    """
    rateContent(
      """User ID"""
      userId: ID!
      """Content ID to rate"""
      contentId: ID!
      """Rating value (0-10)"""
      rating: Float!
    ): Boolean!

    """
    Update user preferences
    """
    updatePreferences(
      """User ID"""
      userId: ID!
      """New preferences"""
      input: PreferencesInput!
    ): User

    """
    Create a new group viewing session
    """
    createGroupSession(
      """Group ID"""
      groupId: ID!
      """ID of user initiating the session"""
      initiatorId: ID!
    ): GroupSession!

    """
    Submit a vote in a group session
    """
    submitVote(
      """Session ID"""
      sessionId: ID!
      """User ID"""
      userId: ID!
      """Content ID being voted on"""
      contentId: ID!
      """Vote score (1-10)"""
      score: Int!
    ): Boolean!
  }

  """
  GraphQL schema definition
  """
  schema {
    query: Query
    mutation: Mutation
  }
`;
