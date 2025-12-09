/**
 * Type definitions for Discord user linking
 */

export interface UserLinkPreferences {
  brief_enabled: boolean;
  brief_time: string; // Format: "HH:MM"
  preferred_region: string; // e.g., "US", "GB", "CA"
}

export interface DiscordUserLink {
  discord_id: string;
  user_id: string;
  linked_at: Date;
  preferences: UserLinkPreferences;
  created_at: Date;
  updated_at: Date;
}

export interface OneTimeLinkCode {
  code: string;
  user_id: string;
  discord_id?: string;
  expires_at: Date;
  used_at?: Date;
  created_at: Date;
}

export interface LinkResult {
  success: boolean;
  message: string;
  user_id?: string;
  error?: string;
}

export interface UnlinkResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface UserProfile {
  user_id: string;
  discord_id: string;
  username?: string;
  email?: string;
  my_list_count: number;
  subscription_platforms: string[];
  preferences: UserLinkPreferences;
  linked_at: Date;
}
