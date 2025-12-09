# Discord Bot Scheduler Implementation

## Overview

This document describes the implementation of a cron-based scheduler for daily media briefs in the Discord bot. The scheduler uses `node-cron` for time-based job execution and integrates with the Media Gateway API for content generation.

## Architecture

### Components

```
scheduler.ts                      # Main scheduler class with cron job management
├── services/
│   ├── user-preferences.ts      # Discord <-> API user mapping & preferences
│   ├── brief-generator.ts       # Brief content generation from API
│   └── brief-formatter.ts       # Discord embed formatting
└── commands/
    └── subscribe.ts             # Slash commands for subscription management
```

## Implementation Details

### 1. User Preferences Service (`src/services/user-preferences.ts`)

**Purpose**: Manage Discord user preferences and link to Media Gateway API users

**Key Features**:

- PostgreSQL persistence using existing database
- Discord user ID -> API user UUID mapping
- Brief preferences storage (time, channel, enabled status)
- API token verification via `/v1/auth/me` endpoint

**Database Schema**:

```sql
CREATE TABLE discord_user_preferences (
  discord_user_id VARCHAR(255) PRIMARY KEY,
  api_user_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  channel_id VARCHAR(255),
  cron_time VARCHAR(50) DEFAULT '0 8 * * *',
  timezone VARCHAR(100) DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**API Methods**:

- `linkUser(discordUserId, apiToken, channelId?, cronTime?, timezone?)` - Link Discord user to API
- `getPreferences(discordUserId)` - Get user preferences
- `updatePreferences(discordUserId, updates)` - Update preferences
- `getEnabledSubscriptions()` - Get all active subscriptions
- `deletePreferences(discordUserId)` - Remove user preferences

### 2. Brief Generator Service (`src/services/brief-generator.ts`)

**Purpose**: Generate personalized media briefs using Media Gateway API

**Key Features**:

- Fetches user recommendations from `/v1/recommendations`
- Retrieves watchlist updates from `/v1/mylist`
- Gets trending content from `/v1/content/trending`
- Aggregates data into structured brief format

**Brief Structure**:

```typescript
interface BriefContent {
  userId: string;
  generatedAt: Date;
  recommendations: Array<{
    title: string;
    type: string;
    provider: string;
    reason: string;
  }>;
  watchlistUpdates: Array<{
    title: string;
    status: string;
  }>;
  trendingContent: Array<{
    title: string;
    type: string;
    popularity: number;
  }>;
}
```

### 3. Brief Formatter Service (`src/services/brief-formatter.ts`)

**Purpose**: Format brief content for Discord display

**Key Features**:

- Creates rich Discord embeds with sections:
  - Recommendations (top 3)
  - Watchlist updates (top 3)
  - Trending content (top 3)
- Color-coded embeds
- Timestamp and branding
- Plain text fallback

### 4. Brief Scheduler (`src/scheduler.ts`)

**Purpose**: Manage cron-based scheduling for all user briefs

**Key Features**:

- Per-user cron job scheduling
- Timezone support via node-cron
- Automatic job initialization on startup
- Dynamic job management (add/remove/update)
- Channel or DM delivery
- Error handling and logging

**Core Methods**:

#### `start()`

- Load all enabled subscriptions from database
- Schedule cron jobs for each subscription
- Mark scheduler as running

#### `stop()`

- Stop all active cron jobs
- Clear job registry
- Mark scheduler as stopped

#### `scheduleUserBrief(userId, channelId, cronTime, timezone)`

- Validate cron expression
- Create scheduled task with timezone support
- Store job reference
- Auto-unschedule existing job if present

#### `unscheduleUserBrief(userId)`

- Stop user's cron job
- Remove from job registry

#### `executeBrief(userId, channelId)` (private)

- Get user preferences and API user ID
- Generate brief content
- Format for Discord
- Send to channel or DM
- Error handling and logging

**Job Storage**:

```typescript
interface ScheduledJob {
  discordUserId: string;
  channelId: string | null;
  task: cron.ScheduledTask;
  cronTime: string;
  timezone: string;
}
```

### 5. Subscribe Command (`src/commands/subscribe.ts`)

**Purpose**: Slash command interface for subscription management

**Subcommands**:

#### `/subscribe daily [token]`

- Subscribe to daily briefs in current channel
- Validates Discord channel is a text channel
- Links Discord user to API using provided token
- Schedules daily brief at default time (8am)
- Returns confirmation embed with subscription details

#### `/subscribe time [time] [timezone?]`

- Update preferred brief time
- Validates HH:MM format (24-hour)
- Converts to cron expression
- Reschedules job with new time
- Returns confirmation with updated schedule

#### `/subscribe status`

- Check current subscription status
- Shows:
  - Active/inactive status
  - Scheduled time and timezone
  - Delivery channel or DM
  - Job scheduling status
  - Last updated timestamp

#### `/subscribe unsubscribe`

- Disable daily briefs
- Marks subscription as inactive
- Unschedules cron job
- Preserves preferences for resubscription

**Utility Functions**:

- `timeToCron(timeStr)` - Convert "HH:MM" to cron expression
- `cronToTime(cron)` - Convert cron expression to "HH:MM"

## Integration Flow

### Initial Setup (Bot Startup)

```
1. Bot starts and connects to Discord
2. Scheduler.start() is called
3. Load all enabled subscriptions from database
4. Schedule cron job for each subscription
5. Jobs run automatically at scheduled times
```

### User Subscription Flow

```
1. User runs /subscribe daily with API token
2. Verify token via /v1/auth/me
3. Create/update preferences in database
4. Schedule cron job for user
5. Return confirmation to user
```

### Brief Execution Flow

```
1. Cron job triggers at scheduled time
2. Load user preferences from database
3. Generate brief using API (recommendations, watchlist, trending)
4. Format brief as Discord embed
5. Send to configured channel or DM user
6. Log success/failure
```

### Time Update Flow

```
1. User runs /subscribe time with new time
2. Convert time to cron expression
3. Update preferences in database
4. Reschedule cron job with new time
5. Return confirmation with updated schedule
```

## Cron Expression Format

Standard cron syntax with timezone support:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 7, Sunday = 0 or 7)
│ │ │ │ │
* * * * *
```

**Examples**:

- `0 8 * * *` - Every day at 8:00 AM
- `30 9 * * *` - Every day at 9:30 AM
- `0 18 * * 1-5` - Weekdays at 6:00 PM

## Timezone Support

Uses IANA timezone database names:

- `America/New_York` (EST/EDT)
- `America/Los_Angeles` (PST/PDT)
- `Europe/London` (GMT/BST)
- `Asia/Tokyo` (JST)
- `Australia/Sydney` (AEST/AEDT)

Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

## Error Handling

### User Preferences Service

- Invalid API token → Error message to user
- Database connection failure → Logged, initialization fails
- Duplicate user → Upsert with ON CONFLICT

### Scheduler

- Invalid cron expression → Validation error before scheduling
- Brief generation failure → Logged, user notified in next scheduled run
- Channel not found → Logged, attempt to send DM instead
- User not found → Logged, skip delivery

### Subscribe Command

- Not in text channel → Error message
- Invalid token → Error message with hint
- Invalid time format → Error message with format example
- Not subscribed (for time/status) → Error message with subscription hint

## Configuration

### Environment Variables

Required in `.env`:

```env
# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/media_gateway

# Media Gateway API
MEDIA_GATEWAY_API_URL=http://localhost:3000
MEDIA_GATEWAY_API_TOKEN=optional_shared_token
```

### Default Settings

Can be overridden per user:

- Default brief time: `8:00 AM`
- Default timezone: `America/New_York`
- Default cron: `0 8 * * *` (daily at 8am)

## Dependencies

Added to `package.json`:

```json
{
  "dependencies": {
    "node-cron": "^3.0.3",
    "pg": "^8.11.3",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "@types/node-cron": "^3.0.11",
    "@types/pg": "^8.10.9"
  }
}
```

## Testing

### Manual Testing

1. **Subscribe to daily briefs**:

```
/subscribe daily token:your_api_token
```

2. **Update brief time**:

```
/subscribe time time:09:00 timezone:America/Los_Angeles
```

3. **Check status**:

```
/subscribe status
```

4. **Unsubscribe**:

```
/subscribe unsubscribe
```

5. **Trigger manual brief** (via code):

```typescript
await scheduler.triggerBrief(userId, channelId);
```

### Integration Testing

Test the following scenarios:

- [ ] User subscription with valid token
- [ ] User subscription with invalid token
- [ ] Time update for subscribed user
- [ ] Time update for unsubscribed user
- [ ] Status check for subscribed user
- [ ] Status check for unsubscribed user
- [ ] Unsubscribe for subscribed user
- [ ] Brief generation and delivery to channel
- [ ] Brief generation and delivery to DM
- [ ] Scheduler restart (jobs persist)
- [ ] Multiple users with different times
- [ ] Timezone handling

## Future Enhancements

- [ ] Brief content customization (content types, providers)
- [ ] Multiple channel subscriptions per user
- [ ] Brief preview command
- [ ] Delivery frequency options (daily, weekly, etc.)
- [ ] Brief history/archive
- [ ] Analytics and usage tracking
- [ ] Admin commands for monitoring
- [ ] Webhook support for external triggers
- [ ] User token storage (encrypted) for personalized content
- [ ] Brief digest mode (weekly summary)

## Files Created

### Core Implementation

- ✅ `src/scheduler.ts` (320 lines)
- ✅ `src/services/user-preferences.ts` (448 lines)
- ✅ `src/services/brief-generator.ts` (92 lines)
- ✅ `src/services/brief-formatter.ts` (102 lines)
- ✅ `src/commands/subscribe.ts` (369 lines)

### Configuration

- ✅ Updated `package.json` with dependencies
- ✅ `.env.example` with configuration template

### Documentation

- ✅ `docs/SCHEDULER_IMPLEMENTATION.md` (this file)

**Total**: ~1,331 lines of production code + documentation

## Summary

This implementation provides a complete, production-ready scheduler for daily media briefs with:

✅ Cron-based scheduling with timezone support
✅ PostgreSQL persistence for user preferences
✅ Discord <-> API user mapping
✅ Flexible subscription management via slash commands
✅ Rich embed formatting for Discord
✅ Comprehensive error handling
✅ Singleton pattern for services
✅ Type-safe TypeScript implementation
✅ Extensible architecture for future enhancements

The scheduler integrates seamlessly with the existing Discord bot and Media Gateway API infrastructure.
