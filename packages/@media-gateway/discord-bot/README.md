# @media-gateway/discord-bot

Discord bot with MCP (Model Context Protocol) client integration for the Media Gateway platform.

## Features

- **MCP Client**: High-level interface to interact with Media Gateway REST API
- **Conversational Agent**: Uses Claude to interpret user messages and orchestrate tool calls
- **Daily Brief Generator**: Creates personalized content briefs with AI-powered insights
- **Tool Use Pattern**: Claude decides which API endpoints to call based on user intent

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure the following environment variables:

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude
- `MEDIA_GATEWAY_API_URL`: Base URL for Media Gateway API (default: http://localhost:3001/v1)
- `DISCORD_BOT_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application client ID

## Usage

### MediaGatewayAgent

The `MediaGatewayAgent` class provides methods to interact with the Media Gateway API:

```typescript
import { createMediaGatewayAgent } from "@media-gateway/discord-bot";

const agent = createMediaGatewayAgent(process.env.ANTHROPIC_API_KEY!, {
  apiBaseUrl: process.env.MEDIA_GATEWAY_API_URL,
});

// Search for content
const results = await agent.search("action movies", {
  type: "movie",
  minRating: 7.0,
  limit: 10,
});

// Get recommendations
const recommendations = await agent.getRecommendations("user123", {
  limit: 5,
  excludeWatched: true,
});

// Get trending content
const trending = await agent.getTrending(10);

// Check availability
const availability = await agent.getAvailability("content123", "US");

// Get details
const details = await agent.getDetails("movie", "movie123");
```

### ConversationalAgent

The `ConversationalAgent` uses Claude to interpret natural language and execute appropriate tool calls:

```typescript
import {
  createMediaGatewayAgent,
  ConversationalAgent,
} from "@media-gateway/discord-bot";

const mediaAgent = createMediaGatewayAgent(process.env.ANTHROPIC_API_KEY!);
const conversationalAgent = new ConversationalAgent(mediaAgent);

// Create conversation context
const context = ConversationalAgent.createContext("user123");

// Process user message
const response = await conversationalAgent.processMessage(
  "What action movies are trending right now?",
  context,
);

console.log(response.message); // Natural language response
console.log(response.toolCalls); // Tools that were called

// Add to history for context
ConversationalAgent.addToHistory(
  context,
  "user",
  "What action movies are trending right now?",
);
ConversationalAgent.addToHistory(context, "assistant", response.message);
```

### BriefGenerator

Generate personalized daily briefs with trending content and AI insights:

```typescript
import {
  createMediaGatewayAgent,
  BriefGenerator,
} from "@media-gateway/discord-bot";

const mediaAgent = createMediaGatewayAgent(process.env.ANTHROPIC_API_KEY!);
const briefGenerator = new BriefGenerator(mediaAgent);

// Generate daily brief
const brief = await briefGenerator.generateDailyBrief("user123");

console.log(brief.insights.summary);
console.log(brief.insights.highlights);
console.log(brief.trending);
console.log(brief.recommendations);

// Format for Discord
const discordEmbed = BriefGenerator.formatForDiscord(brief);
```

## API Methods

### MediaGatewayAgent

- `search(query: string, options?: SearchOptions)`: Search for content
- `getRecommendations(userId: string, options?: RecommendationOptions)`: Get personalized recommendations
- `getTrending(limit?: number)`: Get trending content
- `getAvailability(contentId: string, region?: string)`: Check content availability
- `getDetails(mediaType: 'movie' | 'tv', id: string)`: Get detailed information

### ConversationalAgent

- `processMessage(message: string, context: ConversationContext)`: Process user message with Claude
- `static createContext(userId: string)`: Create conversation context
- `static addToHistory(context, role, content)`: Add message to conversation history

### BriefGenerator

- `generateDailyBrief(userId: string)`: Generate personalized daily brief
- `static formatForDiscord(brief: DailyBrief)`: Format brief for Discord embed

## Development

```bash
# Build
npm run build

# Development mode with auto-reload
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test

# Run tests with coverage
npm test:coverage
```

## Architecture

### MCP Client (`src/mcp-client.ts`)

- Connects to Media Gateway REST API
- Provides typed methods for all API endpoints
- Handles authentication and error handling
- Manages request timeouts and retries

### Agent Service (`src/services/agent.ts`)

- Uses Claude's tool use capabilities
- Defines tools that map to API methods
- Interprets user intent and orchestrates API calls
- Formats responses in natural language

### Brief Generator (`src/services/brief-generator.ts`)

- Fetches trending, new releases, and recommendations in parallel
- Uses Claude to generate insights and highlights
- Structures data for Discord embeds
- Supports customizable limits and filters

## Integration with Discord

The modules in this package are designed to be used with Discord.js:

```typescript
import { Client, GatewayIntentBits } from "discord.js";
import {
  createMediaGatewayAgent,
  ConversationalAgent,
  BriefGenerator,
} from "@media-gateway/discord-bot";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const mediaAgent = createMediaGatewayAgent(process.env.ANTHROPIC_API_KEY!);
const conversationalAgent = new ConversationalAgent(mediaAgent);
const briefGenerator = new BriefGenerator(mediaAgent);

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const context = ConversationalAgent.createContext(message.author.id);
  const response = await conversationalAgent.processMessage(
    message.content,
    context,
  );

  await message.reply(response.message);
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

## Testing

The package includes comprehensive tests for all modules. Run tests with:

```bash
npm test
```

## License

MIT
