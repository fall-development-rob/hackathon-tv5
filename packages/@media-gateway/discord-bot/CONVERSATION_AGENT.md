# Conversation Agent Implementation

## Overview

Successfully created a conversational AI agent for the Media Gateway Discord bot that enables deep-dive entertainment discovery through natural chat interactions. The agent uses Anthropic's Claude 3.5 Sonnet to provide intelligent, context-aware recommendations.

## Files Created

### Core Service

- **`src/services/conversation.ts`** (424 lines)
  - `ConversationAgent` class with full Claude integration
  - Tool definitions for Media Gateway API interactions
  - Session management with 30-minute TTL
  - Automatic cleanup of expired sessions

### Event Handler

- **`src/events/message.ts`** (268 lines)
  - `registerMessageHandler()` - Routes Discord messages to agent
  - `registerConversationCommands()` - Handles `/clear` and `/history` commands
  - `formatContentEmbed()` - Rich Discord embeds for content
  - `formatMultipleContentEmbeds()` - Handles multiple results

### Type Definitions

- **`src/types/index.ts`** (Updated with conversation types)
  - Tool input/output types for all API interactions
  - Conversation session and message types
  - API client interface for dependency injection

### Testing

- **`__tests__/conversation.test.ts`** (400+ lines)
  - Session management tests
  - Tool execution tests
  - Error handling tests
  - Mock setup for Anthropic SDK

### Configuration

- **`package.json`** (Updated)
  - Added `@anthropic-ai/sdk` v0.30.1
  - Added `@media-gateway/core` workspace dependency
  - Added vitest for testing
  - Added dotenv for configuration

- **`vitest.config.ts`**
  - Test configuration with coverage reporting
  - Module aliasing for workspace packages

- **`.env.example`**
  - Environment variable template
  - All required configuration documented

- **`README.md`** (6,277 bytes)
  - Comprehensive documentation
  - Setup instructions
  - Usage examples
  - Architecture overview
  - Troubleshooting guide

## Features Implemented

### 1. Conversational Agent (`ConversationAgent`)

**Capabilities:**

- Natural language conversation powered by Claude 3.5 Sonnet
- Maintains conversation context per channel/user
- 30-minute session TTL with automatic cleanup
- Tool calling for API interactions
- Graceful error handling and recovery

**System Prompt:**
The agent is configured as an "entertainment concierge" that:

- Asks clarifying questions about preferences
- Explains WHY recommendations match user requests
- Always includes availability and pricing information
- Keeps responses concise (2-3 sentences per recommendation)
- Acts conversational and friendly

**Tool Definitions:**

1. **`search_content`**: Search movies/TV shows by query, genre, or filters
2. **`get_recommendations`**: Get personalized recommendations by mood/time/occasion
3. **`check_availability`**: Check where content is available to watch
4. **`get_details`**: Get full details about content
5. **`add_to_list`**: Add content to user's My List

### 2. Message Handler

**Features:**

- Responds to bot mentions in channels
- Responds to direct messages
- Shows typing indicator during processing
- Formats responses with Discord embeds for rich content
- Handles errors gracefully with user-friendly messages

**Slash Commands:**

- `/clear` - Clear conversation history and start fresh
- `/history` - View recent conversation history

### 3. Session Management

**Implementation:**

- Sessions stored in-memory Map with TTL
- Keyed by `${channelId}:${userId}` for isolation
- Automatic cleanup every 60 seconds
- Configurable TTL (default: 30 minutes)
- Extends TTL on each message

### 4. Tool Execution

**Flow:**

1. User sends message
2. Claude analyzes and decides if tools needed
3. Agent executes tools against Media Gateway API
4. Results passed back to Claude
5. Claude generates final response
6. Response formatted and sent to user

**Error Handling:**

- API errors caught and reported gracefully
- Claude continues conversation even if tools fail
- User-friendly error messages in Discord

## Example Conversations

### Example 1: Mood-Based Discovery

```
User: I'm feeling stressed and need something light and funny

Agent: [Calls get_recommendations with mood: "relaxed"]
      Based on your mood, I'd recommend Ted Lasso - it's the perfect antidote
      to stress! The show is incredibly warm and optimistic, focusing on
      kindness and positivity. It's on Apple TV+ (subscription). Want me to
      add it to your list?
```

### Example 2: Similar Content Search

```
User: I loved Succession, what else would I like?

Agent: [Calls search_content with "prestige drama family dynamics"]
      Based on your love for Succession, I'd recommend The White Lotus - it
      has that same sharp social commentary and complex family dynamics, but
      set at a luxury resort. Available on Max (subscription). Season 1 is
      perfect if you want that same addictive feeling!
```

### Example 3: Time-Constrained

```
User: I have 90 minutes before bed

Agent: [Calls get_recommendations with availableTime: 90]
      Perfect! I'd suggest Everything Everywhere All at Once - it's exactly
      90 minutes and absolutely mind-blowing. Available to rent on Amazon
      Prime for $5.99. It's action-packed but also deeply emotional.
```

## Architecture

### Dependency Injection

The `ConversationAgent` accepts a `MediaGatewayAPIClient` interface:

```typescript
interface MediaGatewayAPIClient {
  searchContent(query: SearchContentInput): Promise<SearchResult>;
  getRecommendations(
    userId: string,
    input: GetRecommendationsInput,
  ): Promise<RecommendationResult>;
  checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityResult>;
  getDetails(input: GetDetailsInput): Promise<DetailsResult>;
  addToList(userId: string, input: AddToListInput): Promise<AddToListResult>;
}
```

This enables:

- Easy testing with mocks
- Swappable API implementations
- Clear separation of concerns

### Message Flow

```
Discord Message
    ↓
MessageHandler
    ↓
ConversationAgent.processMessage()
    ↓
Anthropic API (Claude)
    ↓
Tool Use? → Execute Tool → API Client → Media Gateway API
    ↓
Claude Generates Response
    ↓
Format Response (Plain Text or Embed)
    ↓
Discord Reply
```

### Session Lifecycle

```
First Message → Create Session
    ↓
Store in sessions Map
    ↓
Process Messages → Update lastActivityAt
    ↓
30 min inactive → Mark expired
    ↓
Cleanup Interval → Delete expired sessions
```

## Configuration

### Environment Variables

Required:

- `DISCORD_TOKEN`: Discord bot token
- `ANTHROPIC_API_KEY`: Anthropic API key

Optional:

- `MEDIA_GATEWAY_API_URL`: API endpoint (default: http://localhost:3000)
- `SESSION_TTL_MINUTES`: Session timeout (default: 30)
- `CONVERSATION_MAX_TOKENS`: Max response tokens (default: 2048)
- `CONVERSATION_TEMPERATURE`: Claude temperature (default: 0.7)

### Agent Configuration

```typescript
new ConversationAgent({
  apiKey: string;              // Anthropic API key
  model?: string;              // Claude model (default: claude-3-5-sonnet-20241022)
  temperature?: number;        // Creativity (default: 0.7)
  maxTokens?: number;          // Max response length (default: 2048)
  sessionTTLMinutes?: number;  // Session timeout (default: 30)
}, apiClient)
```

## Testing

### Test Coverage

- **Session Management**: Creating, maintaining, clearing sessions
- **Tool Execution**: All 5 tools with success and error cases
- **Error Handling**: API failures, empty messages, invalid inputs
- **Cleanup**: Resource cleanup and graceful shutdown
- **Isolation**: Session isolation by channel/user

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Performance

### Metrics

- **Session TTL**: 30 minutes (configurable)
- **Cleanup Interval**: 60 seconds
- **Max Tokens**: 2048 per response
- **Temperature**: 0.7 (balanced creativity)
- **Tool Execution**: Parallel where possible

### Optimization

- In-memory session storage (fast access)
- Automatic cleanup prevents memory leaks
- Tool results cached in conversation history
- Graceful degradation on API failures

## Integration Points

### Required Integrations

1. **Media Gateway API**: Must implement `MediaGatewayAPIClient` interface
2. **Discord Bot**: Must have MESSAGE_CONTENT intent enabled
3. **Anthropic API**: Must have valid API key with tool use support

### Optional Integrations

1. **Persistent Storage**: Can replace in-memory sessions with database
2. **Analytics**: Can log tool usage and conversation metrics
3. **Rate Limiting**: Can add rate limiting per user/channel
4. **Caching**: Can cache API responses for common queries

## Next Steps

### Immediate

1. **Implement Real API Client**: Replace mock with actual Media Gateway API calls
2. **Deploy Bot**: Set up hosting and environment variables
3. **Register Slash Commands**: Deploy commands to Discord

### Enhancements

1. **Persistent Sessions**: Store sessions in database for multi-instance deployments
2. **Analytics**: Track tool usage, conversation length, user satisfaction
3. **A/B Testing**: Test different system prompts and temperatures
4. **Multi-Language**: Add language detection and localization
5. **Voice Integration**: Add voice channel support for voice-based discovery

### Advanced Features

1. **Group Watch Coordination**: Multi-user consensus building
2. **Watch Party Scheduling**: Integration with calendar services
3. **Mood Detection**: Analyze user messages for implicit mood signals
4. **Learning**: Track user preferences and improve recommendations
5. **Cross-Platform**: Support other chat platforms (Slack, Telegram, etc.)

## Troubleshooting

### Bot doesn't respond

- Check `DISCORD_TOKEN` is valid
- Ensure MESSAGE_CONTENT intent is enabled
- Verify bot has proper channel permissions

### Tool execution fails

- Check `MEDIA_GATEWAY_API_URL` is correct
- Ensure API is running and accessible
- Review API client implementation

### Conversation gets confused

- Use `/clear` to reset conversation
- Check Claude API key is valid and has credits
- Review system prompt for clarity

### Sessions expire too quickly

- Increase `SESSION_TTL_MINUTES`
- Consider persistent storage for long-running conversations
- Review cleanup interval timing

## Best Practices

### For Users

1. Be specific about preferences
2. Mention constraints (time, mood, occasion)
3. Use `/clear` to start fresh if confused
4. Provide feedback on recommendations

### For Developers

1. Keep system prompt concise and clear
2. Monitor tool execution errors
3. Log conversation metrics for improvement
4. Test with real user scenarios
5. Update tool definitions as API evolves

## Security Considerations

1. **API Keys**: Store in environment variables, never commit
2. **User Data**: Session data is temporary, cleared after TTL
3. **Rate Limiting**: Consider implementing to prevent abuse
4. **Input Validation**: Claude handles this, but validate on API side too
5. **Error Messages**: Don't expose internal details to users

## Conclusion

The conversational agent successfully implements deep-dive entertainment discovery through natural chat. It leverages Claude's advanced language understanding and tool use capabilities to provide personalized, context-aware recommendations while maintaining a friendly, conversational tone.

Key achievements:

- ✅ Full Claude integration with tool calling
- ✅ Session management with automatic cleanup
- ✅ Rich Discord embeds for content display
- ✅ Comprehensive error handling
- ✅ Well-tested with 400+ lines of tests
- ✅ Complete documentation

The system is production-ready pending integration with the actual Media Gateway API.
