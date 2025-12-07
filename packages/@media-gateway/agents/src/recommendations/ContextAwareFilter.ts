/**
 * Context-Aware Filtering System for Media Gateway
 * Filters and ranks content based on viewing context, time, device, and user mood
 */

/**
 * Viewing context information for personalized filtering
 */
export interface ViewingContext {
  /** Time of day: morning (5-12), afternoon (12-17), evening (17-22), night (22-5) */
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  /** Day of week: 0 = Sunday, 6 = Saturday */
  dayOfWeek: number;
  /** Device type being used */
  device: 'mobile' | 'tablet' | 'desktop' | 'tv' | 'unknown';
  /** Available viewing time in minutes */
  availableTime?: number;
  /** Current mood of the user */
  mood?: string;
  /** Whether this is a group watching session */
  isGroupWatch: boolean;
  /** Current location/setting */
  location?: 'home' | 'commute' | 'travel' | 'work';
  /** User's current energy level */
  energyLevel?: 'low' | 'medium' | 'high';
}

/**
 * Content candidate with metadata for filtering
 */
export interface ContentCandidate {
  /** Unique content identifier */
  contentId: number;
  /** Type of media content */
  mediaType: 'movie' | 'tv';
  /** Current recommendation score */
  score: number;
  /** Runtime in minutes */
  runtime?: number;
  /** Genre IDs associated with content */
  genres: number[];
  /** Year of release */
  releaseYear: number;
  /** Additional metadata */
  metadata?: {
    episodeRuntime?: number;
    numberOfSeasons?: number;
    mature?: boolean;
    fastPaced?: boolean;
    thoughtProvoking?: boolean;
    visuallyStunning?: boolean;
    familyFriendly?: boolean;
    bingeable?: boolean;
  };
}

/**
 * Configuration for context scoring weights
 */
interface ContextWeights {
  timeOfDayMatch: number;
  durationMatch: number;
  deviceOptimization: number;
  moodAlignment: number;
  locationMatch: number;
  energyMatch: number;
  groupWatchSuitability: number;
}

/**
 * Genre mapping for TMDB genre IDs
 */
const GENRE_IDS = {
  ACTION: 28,
  ADVENTURE: 12,
  ANIMATION: 16,
  COMEDY: 35,
  CRIME: 80,
  DOCUMENTARY: 99,
  DRAMA: 18,
  FAMILY: 10751,
  FANTASY: 14,
  HISTORY: 36,
  HORROR: 27,
  MUSIC: 10402,
  MYSTERY: 9648,
  ROMANCE: 10749,
  SCIENCE_FICTION: 878,
  THRILLER: 53,
  WAR: 10752,
  WESTERN: 37,
  NEWS: 10763,
  REALITY: 10764,
  TALK: 10767,
} as const;

/**
 * Context-Aware Filter for personalized content recommendations
 */
export class ContextAwareFilter {
  private readonly defaultWeights: ContextWeights = {
    timeOfDayMatch: 1.3,
    durationMatch: 1.5,
    deviceOptimization: 1.4,
    moodAlignment: 1.6,
    locationMatch: 1.2,
    energyMatch: 1.25,
    groupWatchSuitability: 1.35,
  };

  private readonly moodToGenreMap: Map<string, number[]>;
  private readonly timeOfDayPreferences: Map<string, number[]>;
  private readonly devicePreferences: Map<string, { maxDuration: number; preferredGenres: number[] }>;

  constructor(private weights: ContextWeights = {} as ContextWeights) {
    this.weights = { ...this.defaultWeights, ...weights };
    this.moodToGenreMap = this.initializeMoodMapping();
    this.timeOfDayPreferences = this.initializeTimePreferences();
    this.devicePreferences = this.initializeDevicePreferences();
  }

  /**
   * Apply all context filters and adjust scores accordingly
   */
  public applyContextFilters(
    candidates: ContentCandidate[],
    context: ViewingContext
  ): ContentCandidate[] {
    let filtered = [...candidates];

    // Apply hard filters first
    if (context.availableTime) {
      filtered = this.filterByDuration(filtered, context.availableTime);
    }

    filtered = this.filterByDevice(filtered, context.device);
    filtered = this.filterByLocation(filtered, context.location);
    filtered = this.filterByGroupWatch(filtered, context.isGroupWatch);

    // Apply soft filters with score boosting
    filtered = this.boostByTimeOfDay(filtered, context.timeOfDay);

    if (context.mood) {
      filtered = this.boostByMood(filtered, context.mood);
    }

    if (context.energyLevel) {
      filtered = this.boostByEnergyLevel(filtered, context.energyLevel);
    }

    filtered = this.boostByDayOfWeek(filtered, context.dayOfWeek);

    // Apply comprehensive context scoring
    filtered = this.applyContextScoring(filtered, context);

    // Sort by adjusted score
    return filtered.sort((a, b) => b.score - a.score);
  }

  /**
   * Filter content by maximum duration
   */
  public filterByDuration(
    candidates: ContentCandidate[],
    maxMinutes: number
  ): ContentCandidate[] {
    return candidates.filter((candidate) => {
      const runtime = this.getEffectiveRuntime(candidate);
      if (!runtime) return true; // Keep if runtime unknown

      // Add 10% buffer for flexibility
      const adjustedMax = maxMinutes * 1.1;
      return runtime <= adjustedMax;
    });
  }

  /**
   * Filter content by device capabilities
   */
  public filterByDevice(
    candidates: ContentCandidate[],
    device: string
  ): ContentCandidate[] {
    const prefs = this.devicePreferences.get(device);
    if (!prefs || device === 'unknown') return candidates;

    return candidates.map((candidate) => {
      const runtime = this.getEffectiveRuntime(candidate);
      const hasPreferredGenre = candidate.genres.some((g) =>
        prefs.preferredGenres.includes(g)
      );

      let scoreMultiplier = 1.0;

      // Boost if matches device preferences
      if (hasPreferredGenre) {
        scoreMultiplier *= this.weights.deviceOptimization;
      }

      // Penalize if too long for device
      if (runtime && runtime > prefs.maxDuration) {
        const excess = runtime - prefs.maxDuration;
        scoreMultiplier *= Math.max(0.5, 1 - excess / prefs.maxDuration);
      }

      return {
        ...candidate,
        score: candidate.score * scoreMultiplier,
      };
    });
  }

  /**
   * Boost content based on time of day preferences
   */
  public boostByTimeOfDay(
    candidates: ContentCandidate[],
    timeOfDay: string
  ): ContentCandidate[] {
    const preferredGenres = this.timeOfDayPreferences.get(timeOfDay) || [];

    return candidates.map((candidate) => {
      const hasPreferredGenre = candidate.genres.some((g) =>
        preferredGenres.includes(g)
      );

      let scoreMultiplier = 1.0;

      if (hasPreferredGenre) {
        scoreMultiplier *= this.weights.timeOfDayMatch;
      }

      // Additional time-specific adjustments
      if (timeOfDay === 'morning') {
        // Prefer shorter, lighter content in morning
        const runtime = this.getEffectiveRuntime(candidate);
        if (runtime && runtime < 30) scoreMultiplier *= 1.2;
        if (candidate.metadata?.thoughtProvoking) scoreMultiplier *= 0.8;
      } else if (timeOfDay === 'night') {
        // Prefer bingeable content at night
        if (candidate.metadata?.bingeable) scoreMultiplier *= 1.3;
        if (candidate.mediaType === 'tv') scoreMultiplier *= 1.2;
      } else if (timeOfDay === 'evening') {
        // Prime time for movies and quality content
        if (candidate.mediaType === 'movie') scoreMultiplier *= 1.15;
        if (candidate.metadata?.visuallyStunning) scoreMultiplier *= 1.25;
      }

      return {
        ...candidate,
        score: candidate.score * scoreMultiplier,
      };
    });
  }

  /**
   * Boost content based on user mood
   */
  public boostByMood(
    candidates: ContentCandidate[],
    mood: string
  ): ContentCandidate[] {
    const moodGenres = this.moodToGenreMap.get(mood.toLowerCase()) || [];

    return candidates.map((candidate) => {
      const genreMatch = candidate.genres.filter((g) =>
        moodGenres.includes(g)
      ).length;

      let scoreMultiplier = 1.0;

      if (genreMatch > 0) {
        // Stronger boost for multiple matching genres
        scoreMultiplier *= Math.pow(this.weights.moodAlignment, genreMatch / 2);
      }

      return {
        ...candidate,
        score: candidate.score * scoreMultiplier,
      };
    });
  }

  /**
   * Filter and boost based on location
   */
  private filterByLocation(
    candidates: ContentCandidate[],
    location?: string
  ): ContentCandidate[] {
    if (!location) return candidates;

    return candidates.map((candidate) => {
      let scoreMultiplier = 1.0;

      switch (location) {
        case 'commute':
          // Prefer short, engaging content
          const runtime = this.getEffectiveRuntime(candidate);
          if (runtime && runtime < 45) scoreMultiplier *= 1.3;
          if (candidate.metadata?.fastPaced) scoreMultiplier *= 1.2;
          break;

        case 'work':
          // Prefer quiet, appropriate content
          if (candidate.metadata?.familyFriendly) scoreMultiplier *= 1.4;
          if (candidate.metadata?.mature) scoreMultiplier *= 0.3;
          if (candidate.genres.includes(GENRE_IDS.DOCUMENTARY)) scoreMultiplier *= 1.3;
          break;

        case 'travel':
          // Prefer downloaded, bingeable content
          if (candidate.metadata?.bingeable) scoreMultiplier *= 1.4;
          if (candidate.mediaType === 'tv') scoreMultiplier *= 1.2;
          break;

        case 'home':
          // No specific restrictions
          if (candidate.metadata?.visuallyStunning) scoreMultiplier *= 1.15;
          break;
      }

      return {
        ...candidate,
        score: candidate.score * scoreMultiplier * this.weights.locationMatch,
      };
    });
  }

  /**
   * Filter and boost based on group watching
   */
  private filterByGroupWatch(
    candidates: ContentCandidate[],
    isGroupWatch: boolean
  ): ContentCandidate[] {
    if (!isGroupWatch) return candidates;

    return candidates.map((candidate) => {
      let scoreMultiplier = 1.0;

      // Boost family-friendly and broadly appealing content
      if (candidate.metadata?.familyFriendly) {
        scoreMultiplier *= 1.5;
      }

      // Boost comedy and action (crowd-pleasers)
      const crowdPleaserGenres: number[] = [GENRE_IDS.COMEDY, GENRE_IDS.ACTION, GENRE_IDS.ADVENTURE, GENRE_IDS.ANIMATION];
      const hasCrowdPleaserGenre = candidate.genres.some((g) =>
        crowdPleaserGenres.includes(g)
      );

      if (hasCrowdPleaserGenre) {
        scoreMultiplier *= 1.3;
      }

      // Penalize very niche or thought-provoking content
      if (candidate.metadata?.thoughtProvoking) {
        scoreMultiplier *= 0.7;
      }

      // Penalize mature content
      if (candidate.metadata?.mature) {
        scoreMultiplier *= 0.5;
      }

      return {
        ...candidate,
        score: candidate.score * scoreMultiplier * this.weights.groupWatchSuitability,
      };
    });
  }

  /**
   * Boost based on energy level
   */
  private boostByEnergyLevel(
    candidates: ContentCandidate[],
    energyLevel: string
  ): ContentCandidate[] {
    return candidates.map((candidate) => {
      let scoreMultiplier = 1.0;

      switch (energyLevel) {
        case 'high':
          // Prefer action, fast-paced content
          if (candidate.metadata?.fastPaced) scoreMultiplier *= 1.4;
          if (candidate.genres.includes(GENRE_IDS.ACTION)) scoreMultiplier *= 1.3;
          if (candidate.genres.includes(GENRE_IDS.THRILLER)) scoreMultiplier *= 1.3;
          break;

        case 'low':
          // Prefer relaxing, easy content
          if (candidate.genres.includes(GENRE_IDS.DOCUMENTARY)) scoreMultiplier *= 1.3;
          if (candidate.genres.includes(GENRE_IDS.COMEDY)) scoreMultiplier *= 1.2;
          if (candidate.metadata?.thoughtProvoking) scoreMultiplier *= 0.7;
          if (candidate.metadata?.fastPaced) scoreMultiplier *= 0.6;
          break;

        case 'medium':
          // Balanced preferences
          if (candidate.genres.includes(GENRE_IDS.DRAMA)) scoreMultiplier *= 1.2;
          break;
      }

      return {
        ...candidate,
        score: candidate.score * scoreMultiplier * this.weights.energyMatch,
      };
    });
  }

  /**
   * Boost based on day of week
   */
  private boostByDayOfWeek(
    candidates: ContentCandidate[],
    dayOfWeek: number
  ): ContentCandidate[] {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return candidates.map((candidate) => {
      let scoreMultiplier = 1.0;

      if (isWeekend) {
        // Weekends: prefer longer content, movies
        if (candidate.mediaType === 'movie') scoreMultiplier *= 1.15;
        const runtime = this.getEffectiveRuntime(candidate);
        if (runtime && runtime > 90) scoreMultiplier *= 1.1;
        if (candidate.metadata?.bingeable) scoreMultiplier *= 1.2;
      } else {
        // Weekdays: prefer shorter, episodic content
        if (candidate.mediaType === 'tv') scoreMultiplier *= 1.1;
        const runtime = this.getEffectiveRuntime(candidate);
        if (runtime && runtime < 60) scoreMultiplier *= 1.15;
      }

      return {
        ...candidate,
        score: candidate.score * scoreMultiplier,
      };
    });
  }

  /**
   * Apply comprehensive context scoring with all factors
   */
  private applyContextScoring(
    candidates: ContentCandidate[],
    context: ViewingContext
  ): ContentCandidate[] {
    return candidates.map((candidate) => {
      let contextScore = 1.0;

      // Calculate context match score
      const timeMatch = this.calculateTimeMatch(candidate, context.timeOfDay);
      const durationMatch = this.calculateDurationMatch(candidate, context.availableTime);
      const deviceMatch = this.calculateDeviceMatch(candidate, context.device);
      const moodMatch = context.mood ? this.calculateMoodMatch(candidate, context.mood) : 1.0;

      // Combine all factors with weights
      contextScore *= Math.pow(timeMatch, 0.3);
      contextScore *= Math.pow(durationMatch, 0.35);
      contextScore *= Math.pow(deviceMatch, 0.25);
      contextScore *= Math.pow(moodMatch, 0.4);

      return {
        ...candidate,
        score: candidate.score * contextScore,
      };
    });
  }

  /**
   * Calculate time of day match score
   */
  private calculateTimeMatch(candidate: ContentCandidate, timeOfDay: string): number {
    const preferredGenres = this.timeOfDayPreferences.get(timeOfDay) || [];
    const matchCount = candidate.genres.filter((g) => preferredGenres.includes(g)).length;
    return 1.0 + (matchCount * 0.15);
  }

  /**
   * Calculate duration match score
   */
  private calculateDurationMatch(candidate: ContentCandidate, availableTime?: number): number {
    if (!availableTime) return 1.0;

    const runtime = this.getEffectiveRuntime(candidate);
    if (!runtime) return 1.0;

    const ratio = runtime / availableTime;

    // Ideal: 70-95% of available time
    if (ratio >= 0.7 && ratio <= 0.95) return 1.4;
    if (ratio >= 0.5 && ratio <= 1.0) return 1.2;
    if (ratio > 1.0) return Math.max(0.5, 1.0 - (ratio - 1.0));

    return 1.0;
  }

  /**
   * Calculate device match score
   */
  private calculateDeviceMatch(candidate: ContentCandidate, device: string): number {
    const prefs = this.devicePreferences.get(device);
    if (!prefs) return 1.0;

    const hasPreferredGenre = candidate.genres.some((g) => prefs.preferredGenres.includes(g));
    return hasPreferredGenre ? 1.3 : 1.0;
  }

  /**
   * Calculate mood match score
   */
  private calculateMoodMatch(candidate: ContentCandidate, mood: string): number {
    const moodGenres = this.moodToGenreMap.get(mood.toLowerCase()) || [];
    const matchCount = candidate.genres.filter((g) => moodGenres.includes(g)).length;
    return 1.0 + (matchCount * 0.2);
  }

  /**
   * Get effective runtime for a content piece
   */
  private getEffectiveRuntime(candidate: ContentCandidate): number | undefined {
    if (candidate.mediaType === 'movie') {
      return candidate.runtime;
    } else {
      // For TV shows, use episode runtime
      return candidate.metadata?.episodeRuntime || candidate.runtime;
    }
  }

  /**
   * Initialize mood to genre mapping
   */
  private initializeMoodMapping(): Map<string, number[]> {
    return new Map([
      ['happy', [GENRE_IDS.COMEDY, GENRE_IDS.ROMANCE, GENRE_IDS.ANIMATION, GENRE_IDS.FAMILY]],
      ['sad', [GENRE_IDS.DRAMA, GENRE_IDS.ROMANCE]],
      ['excited', [GENRE_IDS.ACTION, GENRE_IDS.THRILLER, GENRE_IDS.ADVENTURE, GENRE_IDS.SCIENCE_FICTION]],
      ['relaxed', [GENRE_IDS.DOCUMENTARY, GENRE_IDS.DRAMA, GENRE_IDS.FAMILY]],
      ['stressed', [GENRE_IDS.COMEDY, GENRE_IDS.ANIMATION, GENRE_IDS.FAMILY]],
      ['bored', [GENRE_IDS.ACTION, GENRE_IDS.ADVENTURE, GENRE_IDS.THRILLER, GENRE_IDS.SCIENCE_FICTION]],
      ['romantic', [GENRE_IDS.ROMANCE, GENRE_IDS.DRAMA, GENRE_IDS.COMEDY]],
      ['curious', [GENRE_IDS.DOCUMENTARY, GENRE_IDS.SCIENCE_FICTION, GENRE_IDS.MYSTERY, GENRE_IDS.HISTORY]],
      ['scared', [GENRE_IDS.HORROR, GENRE_IDS.THRILLER]],
      ['nostalgic', [GENRE_IDS.DRAMA, GENRE_IDS.FAMILY, GENRE_IDS.ANIMATION]],
      ['adventurous', [GENRE_IDS.ADVENTURE, GENRE_IDS.ACTION, GENRE_IDS.SCIENCE_FICTION, GENRE_IDS.FANTASY]],
      ['thoughtful', [GENRE_IDS.DOCUMENTARY, GENRE_IDS.DRAMA, GENRE_IDS.HISTORY]],
      ['energetic', [GENRE_IDS.ACTION, GENRE_IDS.MUSIC, GENRE_IDS.ADVENTURE]],
      ['lonely', [GENRE_IDS.ROMANCE, GENRE_IDS.COMEDY, GENRE_IDS.DRAMA]],
      ['angry', [GENRE_IDS.ACTION, GENRE_IDS.THRILLER, GENRE_IDS.CRIME]],
    ]);
  }

  /**
   * Initialize time of day preferences
   */
  private initializeTimePreferences(): Map<string, number[]> {
    return new Map([
      ['morning', [GENRE_IDS.NEWS, GENRE_IDS.DOCUMENTARY, GENRE_IDS.FAMILY, GENRE_IDS.ANIMATION]],
      ['afternoon', [GENRE_IDS.DRAMA, GENRE_IDS.COMEDY, GENRE_IDS.DOCUMENTARY, GENRE_IDS.REALITY]],
      ['evening', [GENRE_IDS.DRAMA, GENRE_IDS.ACTION, GENRE_IDS.FAMILY, GENRE_IDS.COMEDY, GENRE_IDS.ADVENTURE]],
      ['night', [GENRE_IDS.THRILLER, GENRE_IDS.HORROR, GENRE_IDS.DRAMA, GENRE_IDS.SCIENCE_FICTION, GENRE_IDS.MYSTERY]],
    ]);
  }

  /**
   * Initialize device-specific preferences
   */
  private initializeDevicePreferences(): Map<string, { maxDuration: number; preferredGenres: number[] }> {
    return new Map([
      [
        'mobile',
        {
          maxDuration: 45,
          preferredGenres: [GENRE_IDS.COMEDY, GENRE_IDS.NEWS, GENRE_IDS.DOCUMENTARY, GENRE_IDS.ANIMATION],
        },
      ],
      [
        'tablet',
        {
          maxDuration: 90,
          preferredGenres: [GENRE_IDS.DRAMA, GENRE_IDS.COMEDY, GENRE_IDS.DOCUMENTARY, GENRE_IDS.FAMILY],
        },
      ],
      [
        'desktop',
        {
          maxDuration: 120,
          preferredGenres: [GENRE_IDS.DRAMA, GENRE_IDS.DOCUMENTARY, GENRE_IDS.THRILLER, GENRE_IDS.SCIENCE_FICTION],
        },
      ],
      [
        'tv',
        {
          maxDuration: 180,
          preferredGenres: [GENRE_IDS.ACTION, GENRE_IDS.ADVENTURE, GENRE_IDS.DRAMA, GENRE_IDS.SCIENCE_FICTION, GENRE_IDS.THRILLER],
        },
      ],
      [
        'unknown',
        {
          maxDuration: 120,
          preferredGenres: [],
        },
      ],
    ]);
  }

  /**
   * Update context weights dynamically
   */
  public updateWeights(newWeights: Partial<ContextWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Get current context weights
   */
  public getWeights(): ContextWeights {
    return { ...this.weights };
  }

  /**
   * Add custom mood mapping
   */
  public addMoodMapping(mood: string, genres: number[]): void {
    this.moodToGenreMap.set(mood.toLowerCase(), genres);
  }

  /**
   * Get statistics about filtering results
   */
  public getFilteringStats(
    originalCandidates: ContentCandidate[],
    filteredCandidates: ContentCandidate[]
  ): {
    totalOriginal: number;
    totalFiltered: number;
    filterRate: number;
    averageScoreChange: number;
    topGenres: number[];
  } {
    const totalOriginal = originalCandidates.length;
    const totalFiltered = filteredCandidates.length;
    const filterRate = totalFiltered / totalOriginal;

    // Calculate average score change
    const originalAvg = originalCandidates.reduce((sum, c) => sum + c.score, 0) / totalOriginal;
    const filteredAvg = filteredCandidates.reduce((sum, c) => sum + c.score, 0) / totalFiltered;
    const averageScoreChange = filteredAvg - originalAvg;

    // Get top genres from filtered results
    const genreCounts = new Map<number, number>();
    filteredCandidates.forEach((candidate) => {
      candidate.genres.forEach((genre) => {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      });
    });

    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre);

    return {
      totalOriginal,
      totalFiltered,
      filterRate,
      averageScoreChange,
      topGenres,
    };
  }
}

/**
 * Factory function to create context from current environment
 */
export function createViewingContext(options: Partial<ViewingContext> = {}): ViewingContext {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  // Determine time of day
  let timeOfDay: ViewingContext['timeOfDay'];
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
  else timeOfDay = 'night';

  return {
    timeOfDay,
    dayOfWeek,
    device: 'unknown',
    isGroupWatch: false,
    ...options,
  };
}

/**
 * Export genre constants for external use
 */
export { GENRE_IDS };
