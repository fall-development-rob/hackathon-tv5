# Discord User Linking Documentation

## Overview

The Discord user linking feature connects Discord accounts to Media Gateway user accounts, enabling personalized features like My List access, recommendations, and daily briefings.

## Architecture

### Components

1. **UserLinkService** (`src/services/user-link.ts`)
   - Core service managing link operations
   - Handles authentication and validation
   - Manages preferences

2. **Database Tables**
   - `discord_user_links` - One-to-one mapping between Discord and MG accounts
   - `one_time_link_codes` - Secure temporary codes for web-based linking

3. **Commands**
   - `/link` - Link Discord account
   - `/profile` - View account info
   - `/unlink` - Remove link

### Linking Methods

#### Method 1: One-Time Code (Recommended)

1. User generates code on Media Gateway website
2. User runs `/link code ABC12345` in Discord
3. Code is validated (15-minute expiry)
4. Link is created

**Benefits:**

- More secure (no password transmission)
- Better user experience
- Auditable

#### Method 2: Direct Credentials

1. User runs `/link credentials email@example.com password123`
2. Credentials are validated
3. Link is created immediately

**Drawbacks:**

- Less secure
- Password transmitted through Discord
- Should be avoided for production

## Database Schema

### discord_user_links

```sql
CREATE TABLE discord_user_links (
  discord_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{
    "brief_enabled": false,
    "brief_time": "09:00",
    "preferred_region": "US"
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes:**

- Primary key on `discord_id`
- Unique constraint on `user_id`
- Index on `linked_at`

### one_time_link_codes

```sql
CREATE TABLE one_time_link_codes (
  code VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  discord_id VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Features:**

- Codes expire after 15 minutes
- Marked as used when consumed
- Linked to Discord ID when used

## API Reference

### UserLinkService

```typescript
class UserLinkService {
  // Link with code
  async linkUserWithCode(discordId: string, code: string): Promise<LinkResult>;

  // Link with credentials
  async linkUserWithCredentials(
    discordId: string,
    email: string,
    password: string,
  ): Promise<LinkResult>;

  // Unlink account
  async unlinkUser(discordId: string): Promise<UnlinkResult>;

  // Get linked user ID
  async getLinkedUser(discordId: string): Promise<string | null>;

  // Check if linked
  async isLinked(discordId: string): Promise<boolean>;

  // Get full profile
  async getUserProfile(discordId: string): Promise<UserProfile | null>;

  // Update preferences
  async updatePreferences(
    discordId: string,
    preferences: Partial<UserLinkPreferences>,
  ): Promise<boolean>;

  // Generate link code
  async generateLinkCode(userId: string): Promise<string>;
}
```

### Types

```typescript
interface UserLinkPreferences {
  brief_enabled: boolean;
  brief_time: string; // "HH:MM"
  preferred_region: string; // "US", "GB", etc.
}

interface UserProfile {
  user_id: string;
  discord_id: string;
  username?: string;
  email?: string;
  my_list_count: number;
  subscription_platforms: string[];
  preferences: UserLinkPreferences;
  linked_at: Date;
}

interface LinkResult {
  success: boolean;
  message: string;
  user_id?: string;
  error?: string;
}
```

## Usage Examples

### Basic Linking Flow

```typescript
import { UserLinkService } from "./services/user-link";
import { PostgreSQLConnectionPool } from "@media-gateway/database";

// Initialize
const pool = new PostgreSQLConnectionPool(config);
await pool.initialize();
const service = new UserLinkService(pool);

// Link with code
const result = await service.linkUserWithCode(
  "123456789", // Discord ID
  "ABC12345", // Link code
);

if (result.success) {
  console.log("Linked!", result.user_id);
}
```

### Check if User is Linked

```typescript
const discordId = "123456789";

if (await service.isLinked(discordId)) {
  const userId = await service.getLinkedUser(discordId);
  // Provide personalized features
} else {
  // Prompt to link
}
```

### Get User Profile

```typescript
const profile = await service.getUserProfile(discordId);

if (profile) {
  console.log("My List:", profile.my_list_count);
  console.log("Email:", profile.email);
  console.log("Preferences:", profile.preferences);
}
```

### Update Preferences

```typescript
await service.updatePreferences(discordId, {
  brief_enabled: true,
  brief_time: "10:00",
  preferred_region: "GB",
});
```

## Security Considerations

1. **One-Time Codes**
   - Expire after 15 minutes
   - Can only be used once
   - Randomly generated (8 characters)

2. **Credential Handling**
   - Passwords never stored by Discord bot
   - Only used for immediate verification
   - Should use bcrypt/argon2 in production

3. **One-to-One Relationship**
   - One Discord account per MG account
   - One MG account per Discord account
   - Enforced by unique constraints

4. **Ephemeral Responses**
   - All link/unlink operations are private
   - Only visible to the user
   - Prevents credential leakage

## Testing

### Unit Tests

```bash
npm test
```

Tests cover:

- Link/unlink flows
- Code generation and validation
- Credential authentication
- Profile retrieval
- Preferences management

### Integration Tests

```bash
npm run test:integration
```

Tests with real PostgreSQL:

- Full link workflow
- Database transactions
- Constraint enforcement
- Code expiry

## Migration

Run the migration to create tables:

```bash
npm run migrate
```

Or manually:

```bash
psql -d mediagateway -f src/migrations/001_create_discord_user_links.sql
```

## Error Handling

Common errors and resolutions:

### USER_NOT_FOUND

- User doesn't exist in Media Gateway
- Credentials are incorrect

### ALREADY_LINKED_TO_OTHER_DISCORD

- MG account already linked to different Discord user
- Must unlink first

### INVALID_OR_EXPIRED

- Link code is invalid or expired
- Generate new code

### DISCORD_ALREADY_LINKED

- Discord account already linked to MG account
- Use `/unlink` first

## Future Enhancements

1. **OAuth Flow**
   - More secure than credentials
   - Better UX with web redirect

2. **Multi-Platform Support**
   - Link multiple platforms to same MG account
   - Telegram, Slack, etc.

3. **Enhanced Preferences**
   - Notification settings
   - Content filters
   - Display preferences

4. **Subscription Platform Management**
   - Let users configure their subscriptions
   - Filter recommendations by availability

## Support

For issues or questions:

- Check logs in `.swarm/memory.db`
- Review migration status
- Verify database constraints
