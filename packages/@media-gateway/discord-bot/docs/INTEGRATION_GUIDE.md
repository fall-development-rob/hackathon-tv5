# Integration Guide: Adding User Linking to Existing Commands

## Overview

This guide shows how to integrate the user linking system into existing Discord bot commands to enable personalized features.

## Quick Integration

### Step 1: Import the Utility

```typescript
import {
  requireLinkedAccount,
  getLinkedUserOrPrompt,
} from "../utils/link-check";
import { UserLinkService } from "../services/user-link";
import { PostgreSQLConnectionPool } from "@media-gateway/database";
```

### Step 2: Initialize Service

```typescript
// In your command execute function
const pool = new PostgreSQLConnectionPool(config);
await pool.initialize();
const userLinkService = new UserLinkService(pool);
```

### Step 3: Check if User is Linked

#### Option A: Require Linking (Block if not linked)

```typescript
export async function execute(
  interaction: CommandInteraction,
  pool: PostgreSQLConnectionPool,
) {
  const userLinkService = new UserLinkService(pool);

  // This will send a prompt if not linked and return false
  if (!(await requireLinkedAccount(interaction, userLinkService, "My List"))) {
    return; // Stop execution if not linked
  }

  // Continue with personalized features
  const userId = await userLinkService.getLinkedUser(interaction.user.id);
  // ... rest of your code
}
```

#### Option B: Get User ID or Prompt

```typescript
export async function execute(
  interaction: CommandInteraction,
  pool: PostgreSQLConnectionPool,
) {
  const userLinkService = new UserLinkService(pool);

  // Returns user_id if linked, null if not (and sends prompt)
  const userId = await getLinkedUserOrPrompt(
    interaction,
    userLinkService,
    "personalized recommendations",
  );

  if (!userId) {
    return; // User not linked, prompt already sent
  }

  // Continue with personalized features
  // ... rest of your code
}
```

#### Option C: Conditional Features (Works with or without linking)

```typescript
export async function execute(
  interaction: CommandInteraction,
  pool: PostgreSQLConnectionPool,
) {
  const userLinkService = new UserLinkService(pool);

  // Check if linked
  const isLinked = await userLinkService.isLinked(interaction.user.id);

  if (isLinked) {
    // Get user profile for personalized features
    const profile = await userLinkService.getUserProfile(interaction.user.id);

    // Use profile data
    embed.addFields({
      name: "Personalized for You",
      value: `Based on your ${profile!.my_list_count} saved items`,
    });

    // Get user preferences
    const preferences = profile!.preferences;
    // Filter by preferred_region, etc.
  } else {
    // Provide generic features
    embed.setFooter({
      text: "Link your account for personalized recommendations - /link",
    });
  }

  await interaction.reply({ embeds: [embed] });
}
```

## Real-World Examples

### Example 1: /mylist Command (Requires Linking)

```typescript
// src/commands/mylist.ts
import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { requireLinkedAccount } from "../utils/link-check";
import { UserLinkService } from "../services/user-link";
import { PostgreSQLConnectionPool } from "@media-gateway/database";

export const data = new SlashCommandBuilder()
  .setName("mylist")
  .setDescription("View and manage your personal watch list")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("Action to perform")
      .setRequired(true)
      .addChoices(
        { name: "View", value: "view" },
        { name: "Add", value: "add" },
        { name: "Remove", value: "remove" },
      ),
  );

export async function execute(
  interaction: CommandInteraction,
  pool: PostgreSQLConnectionPool,
) {
  const userLinkService = new UserLinkService(pool);

  // Require linked account
  if (!(await requireLinkedAccount(interaction, userLinkService, "My List"))) {
    return;
  }

  await interaction.deferReply();

  // Get linked user ID
  const userId = await userLinkService.getLinkedUser(interaction.user.id);

  const action = interaction.options.get("action")?.value as string;

  if (action === "view") {
    // Fetch user's list from database
    const myList = await pool.query(
      "SELECT * FROM my_list WHERE user_id = $1",
      [userId],
    );

    // Build embed with list items
    const embed = new EmbedBuilder()
      .setTitle("📝 Your Watch List")
      .setDescription(`You have ${myList.rows.length} items`)
      .setColor(0x00ff00);

    // Add list items
    for (const item of myList.rows) {
      embed.addFields({
        name: item.title,
        value: item.media_type === "movie" ? "🎬 Movie" : "📺 TV Show",
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
  // ... handle other actions
}
```

### Example 2: /recommend Command (Optional Linking)

```typescript
// src/commands/recommend.ts
import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { UserLinkService } from "../services/user-link";
import { PostgreSQLConnectionPool } from "@media-gateway/database";

export const data = new SlashCommandBuilder()
  .setName("recommend")
  .setDescription("Get content recommendations")
  .addStringOption((option) =>
    option.setName("genre").setDescription("Genre preference"),
  );

export async function execute(
  interaction: CommandInteraction,
  pool: PostgreSQLConnectionPool,
) {
  await interaction.deferReply();

  const userLinkService = new UserLinkService(pool);
  const genre = interaction.options.get("genre")?.value as string | undefined;

  // Check if user is linked
  const isLinked = await userLinkService.isLinked(interaction.user.id);

  let recommendations;

  if (isLinked) {
    // Get personalized recommendations
    const userId = await userLinkService.getLinkedUser(interaction.user.id);
    const profile = await userLinkService.getUserProfile(interaction.user.id);

    // Use user preferences
    recommendations = await getPersonalizedRecommendations({
      userId: userId!,
      genre,
      region: profile!.preferences.preferred_region,
      // Use vector search based on user's watch history
    });

    const embed = new EmbedBuilder()
      .setTitle("🎯 Personalized Recommendations")
      .setDescription("Based on your watch history and preferences")
      .setColor(0x00ff00);

    // Add recommendations
    for (const rec of recommendations) {
      embed.addFields({
        name: rec.title,
        value: `${rec.overview.substring(0, 100)}...`,
        inline: false,
      });
    }

    embed.setFooter({ text: `Tailored for ${profile!.username}` });

    await interaction.editReply({ embeds: [embed] });
  } else {
    // Provide generic trending recommendations
    recommendations = await getTrendingContent({ genre });

    const embed = new EmbedBuilder()
      .setTitle("🔥 Trending Recommendations")
      .setDescription("Popular content right now")
      .setColor(0xff9900);

    // Add recommendations
    for (const rec of recommendations) {
      embed.addFields({
        name: rec.title,
        value: `${rec.overview.substring(0, 100)}...`,
        inline: false,
      });
    }

    embed.setFooter({
      text: "Link your account for personalized recommendations - /link",
    });

    await interaction.editReply({ embeds: [embed] });
  }
}
```

### Example 3: /brief Command (Requires Linking)

```typescript
// src/commands/brief.ts
import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { getLinkedUserOrPrompt } from "../utils/link-check";
import { UserLinkService } from "../services/user-link";
import { PostgreSQLConnectionPool } from "@media-gateway/database";

export const data = new SlashCommandBuilder()
  .setName("brief")
  .setDescription("Get your personalized daily content brief");

export async function execute(
  interaction: CommandInteraction,
  pool: PostgreSQLConnectionPool,
) {
  const userLinkService = new UserLinkService(pool);

  // Get user ID or send prompt
  const userId = await getLinkedUserOrPrompt(
    interaction,
    userLinkService,
    "daily briefs",
  );

  if (!userId) {
    return; // Not linked, prompt already sent
  }

  await interaction.deferReply();

  // Get user profile with preferences
  const profile = await userLinkService.getUserProfile(interaction.user.id);

  if (!profile) {
    await interaction.editReply("Failed to load profile");
    return;
  }

  // Check if briefs are enabled
  if (!profile.preferences.brief_enabled) {
    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle("⚙️ Daily Briefs Disabled")
      .setDescription("Enable daily briefs in your settings")
      .addFields({
        name: "Enable Briefs",
        value: "Use `/settings brief enable` to receive daily updates",
      });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Generate personalized brief
  const brief = await generateBrief({
    userId,
    preferences: profile.preferences,
    myListCount: profile.my_list_count,
  });

  const embed = new EmbedBuilder()
    .setTitle("📰 Your Daily Brief")
    .setDescription(`Here's what's new for you today`)
    .setColor(0x0099ff)
    .addFields(
      {
        name: "🎬 New Releases",
        value: brief.newReleases,
        inline: false,
      },
      {
        name: "📺 Trending",
        value: brief.trending,
        inline: false,
      },
      {
        name: "⭐ For You",
        value: brief.recommended,
        inline: false,
      },
    )
    .setFooter({
      text: `Scheduled for ${profile.preferences.brief_time} daily`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
```

## Best Practices

### 1. Always Provide Context

When prompting to link, mention what feature requires it:

```typescript
requireLinkedAccount(interaction, service, "personalized recommendations");
```

### 2. Handle Errors Gracefully

```typescript
try {
  const profile = await userLinkService.getUserProfile(discordId);
  if (!profile) {
    await interaction.reply("Failed to load profile");
    return;
  }
} catch (error) {
  console.error("Error loading profile:", error);
  await interaction.reply("An error occurred");
}
```

### 3. Use Ephemeral for Sensitive Data

```typescript
await interaction.reply({
  embeds: [embed],
  ephemeral: true, // Only visible to user
});
```

### 4. Provide Fallbacks

Always offer generic features when user isn't linked:

```typescript
if (isLinked) {
  // Personalized content
} else {
  // Generic content + link prompt
}
```

### 5. Check Preferences

Respect user preferences from the profile:

```typescript
const profile = await userLinkService.getUserProfile(discordId);
if (profile.preferences.brief_enabled) {
  // Send brief
}
```

## Database Queries

### Get User's My List

```typescript
const result = await pool.query(
  `SELECT ml.*, cv.title, cv.poster_path
   FROM my_list ml
   JOIN content_vectors cv ON cv.content_id = ml.content_id
   WHERE ml.user_id = $1
   ORDER BY ml.added_at DESC`,
  [userId],
);
```

### Get User Preferences

```typescript
const result = await pool.query(
  `SELECT preferences FROM discord_user_links WHERE discord_id = $1`,
  [discordId],
);
const prefs = result.rows[0].preferences;
```

### Update Preferences

```typescript
await pool.query(
  `UPDATE discord_user_links
   SET preferences = $1, updated_at = NOW()
   WHERE discord_id = $2`,
  [JSON.stringify(newPrefs), discordId],
);
```

## Testing Integration

```typescript
import { describe, it, expect, vi } from "vitest";
import { execute as mylistExecute } from "../commands/mylist";

describe("MyList Command Integration", () => {
  it("should require linked account", async () => {
    const mockInteraction = createMockInteraction();
    const mockPool = createMockPool();

    // Mock unlinked user
    vi.mocked(mockPool.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    await mylistExecute(mockInteraction as any, mockPool);

    // Verify prompt was sent
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "🔗 Account Not Linked",
            }),
          }),
        ]),
      }),
    );
  });
});
```

## Troubleshooting

### Issue: Pool not initialized

```typescript
// Always initialize before use
await pool.initialize();
const service = new UserLinkService(pool);
```

### Issue: Profile returns null

Check if user is linked first:

```typescript
if (!(await service.isLinked(discordId))) {
  // Handle not linked
  return;
}
```

### Issue: Preferences not updating

Ensure you're using JSON.stringify:

```typescript
await pool.query(
  "UPDATE discord_user_links SET preferences = $1 WHERE discord_id = $2",
  [JSON.stringify(preferences), discordId],
);
```

## Next Steps

1. Update all commands that need personalization
2. Add preference management commands (`/settings`)
3. Implement automatic daily briefs
4. Add subscription platform filtering
5. Integrate with vector search for better recommendations

## Support

For questions or issues:

- Review `docs/USER_LINKING.md`
- Check test files for examples
- Run `npm test` to verify functionality
