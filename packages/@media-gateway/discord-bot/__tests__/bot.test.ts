/**
 * Discord Bot Unit Tests
 *
 * Tests for the Discord bot including:
 * - Bot initialization
 * - Command registration
 * - Event handling
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startBot, stopBot, getClient } from "../src/bot";
import {
  Client,
  Events,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    DISCORD_TOKEN: "test-discord-token",
    DISCORD_CLIENT_ID: "test-client-id",
  };
});

afterEach(() => {
  process.env = originalEnv;
});

// Mock discord.js
vi.mock("discord.js", async () => {
  const actual =
    await vi.importActual<typeof import("discord.js")>("discord.js");

  const mockClient = {
    once: vi.fn(),
    on: vi.fn(),
    login: vi.fn().mockResolvedValue("test-token"),
    destroy: vi.fn(),
    user: {
      tag: "TestBot#1234",
    },
  };

  const MockClient = vi.fn(() => mockClient);

  const mockRest = {
    setToken: vi.fn().mockReturnThis(),
    put: vi.fn().mockResolvedValue([]),
  };

  const MockREST = vi.fn(() => mockRest);

  return {
    ...actual,
    Client: MockClient,
    REST: MockREST,
    Routes: {
      applicationCommands: vi.fn(
        (clientId) => `/applications/${clientId}/commands`,
      ),
    },
    GatewayIntentBits: {
      Guilds: 1 << 0,
      GuildMessages: 1 << 9,
      MessageContent: 1 << 15,
    },
    Events: actual.Events,
  };
});

// Mock commands
vi.mock("../src/commands", () => {
  const mockCommand1 = {
    data: {
      name: "search",
      toJSON: vi
        .fn()
        .mockReturnValue({ name: "search", description: "Search for content" }),
    },
    execute: vi.fn().mockResolvedValue(undefined),
  };

  const mockCommand2 = {
    data: {
      name: "recommend",
      toJSON: vi
        .fn()
        .mockReturnValue({
          name: "recommend",
          description: "Get recommendations",
        }),
    },
    execute: vi.fn().mockResolvedValue(undefined),
  };

  const mockCollection = new Map();
  mockCollection.set("search", mockCommand1);
  mockCollection.set("recommend", mockCommand2);

  return {
    commands: mockCollection,
  };
});

describe("Discord Bot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await stopBot();
  });

  describe("Bot Initialization", () => {
    it("should create Discord client with correct intents", async () => {
      await startBot();

      expect(Client).toHaveBeenCalledWith({
        intents: [
          expect.any(Number), // Guilds
          expect.any(Number), // GuildMessages
          expect.any(Number), // MessageContent
        ],
      });
    });

    it("should login with Discord token", async () => {
      const client = await startBot();

      expect(client.login).toHaveBeenCalledWith("test-discord-token");
    });

    it("should return client instance", async () => {
      const client = await startBot();

      expect(client).toBeDefined();
      expect(client.login).toBeDefined();
    });

    it("should set client in getClient", async () => {
      expect(getClient()).toBeNull();

      await startBot();
      const client = getClient();

      expect(client).not.toBeNull();
    });
  });

  describe("Event Registration", () => {
    it("should register ClientReady event handler", async () => {
      const client = await startBot();

      expect(client.once).toHaveBeenCalledWith(
        Events.ClientReady,
        expect.any(Function),
      );
    });

    it("should register InteractionCreate event handler", async () => {
      const client = await startBot();

      expect(client.on).toHaveBeenCalledWith(
        Events.InteractionCreate,
        expect.any(Function),
      );
    });

    it("should register error event handler", async () => {
      const client = await startBot();

      expect(client.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should handle ClientReady event", async () => {
      const client = await startBot();

      // Get the registered ready handler
      const readyHandler = vi
        .mocked(client.once)
        .mock.calls.find((call) => call[0] === Events.ClientReady)?.[1];

      expect(readyHandler).toBeDefined();

      // Call the handler
      if (readyHandler) {
        await readyHandler(client);
      }

      // Should attempt to register commands
      const { REST } = await import("discord.js");
      const mockRest = new REST();
      expect(mockRest.put).toHaveBeenCalled();
    });
  });

  describe("Command Registration", () => {
    it("should register all commands with Discord API", async () => {
      const client = await startBot();

      // Trigger ready event
      const readyHandler = vi
        .mocked(client.once)
        .mock.calls.find((call) => call[0] === Events.ClientReady)?.[1];

      if (readyHandler) {
        await readyHandler(client);
      }

      const { REST, Routes } = await import("discord.js");
      const mockRest = new REST();

      expect(mockRest.setToken).toHaveBeenCalledWith("test-discord-token");
      expect(Routes.applicationCommands).toHaveBeenCalledWith("test-client-id");
      expect(mockRest.put).toHaveBeenCalledWith(expect.any(String), {
        body: expect.arrayContaining([
          expect.objectContaining({ name: "search" }),
          expect.objectContaining({ name: "recommend" }),
        ]),
      });
    });

    it("should handle command registration errors", async () => {
      const { REST } = await import("discord.js");
      const mockRest = new REST();
      vi.mocked(mockRest.put).mockRejectedValueOnce(
        new Error("Registration failed"),
      );

      const client = await startBot();

      // Trigger ready event
      const readyHandler = vi
        .mocked(client.once)
        .mock.calls.find((call) => call[0] === Events.ClientReady)?.[1];

      // Should not throw, just log error
      if (readyHandler) {
        await expect(readyHandler(client)).resolves.not.toThrow();
      }
    });
  });

  describe("Interaction Handling", () => {
    it("should handle chat input command interactions", async () => {
      const { commands } = await import("../src/commands");
      const searchCommand = commands.get("search");

      const mockInteraction = {
        isChatInputCommand: vi.fn().mockReturnValue(true),
        commandName: "search",
        replied: false,
        deferred: false,
        reply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
      } as unknown as Interaction;

      const client = await startBot();

      // Get interaction handler
      const interactionHandler = vi
        .mocked(client.on)
        .mock.calls.find((call) => call[0] === Events.InteractionCreate)?.[1];

      expect(interactionHandler).toBeDefined();

      if (interactionHandler) {
        await interactionHandler(mockInteraction);
      }

      expect(searchCommand?.execute).toHaveBeenCalledWith(mockInteraction);
    });

    it("should ignore non-command interactions", async () => {
      const mockInteraction = {
        isChatInputCommand: vi.fn().mockReturnValue(false),
      } as unknown as Interaction;

      const client = await startBot();

      const interactionHandler = vi
        .mocked(client.on)
        .mock.calls.find((call) => call[0] === Events.InteractionCreate)?.[1];

      if (interactionHandler) {
        await interactionHandler(mockInteraction);
      }

      // Should return early, no commands executed
      const { commands } = await import("../src/commands");
      const searchCommand = commands.get("search");
      expect(searchCommand?.execute).not.toHaveBeenCalled();
    });

    it("should handle unknown command gracefully", async () => {
      const mockInteraction = {
        isChatInputCommand: vi.fn().mockReturnValue(true),
        commandName: "unknown-command",
      } as unknown as Interaction;

      const client = await startBot();

      const interactionHandler = vi
        .mocked(client.on)
        .mock.calls.find((call) => call[0] === Events.InteractionCreate)?.[1];

      if (interactionHandler) {
        await expect(
          interactionHandler(mockInteraction),
        ).resolves.not.toThrow();
      }
    });

    it("should handle command execution errors with reply", async () => {
      const { commands } = await import("../src/commands");
      const searchCommand = commands.get("search");
      vi.mocked(searchCommand!.execute).mockRejectedValueOnce(
        new Error("Command failed"),
      );

      const mockInteraction = {
        isChatInputCommand: vi.fn().mockReturnValue(true),
        commandName: "search",
        replied: false,
        deferred: false,
        reply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
      } as unknown as ChatInputCommandInteraction;

      const client = await startBot();

      const interactionHandler = vi
        .mocked(client.on)
        .mock.calls.find((call) => call[0] === Events.InteractionCreate)?.[1];

      if (interactionHandler) {
        await interactionHandler(mockInteraction as Interaction);
      }

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    });

    it("should handle command execution errors with followUp when already replied", async () => {
      const { commands } = await import("../src/commands");
      const searchCommand = commands.get("search");
      vi.mocked(searchCommand!.execute).mockRejectedValueOnce(
        new Error("Command failed"),
      );

      const mockInteraction = {
        isChatInputCommand: vi.fn().mockReturnValue(true),
        commandName: "search",
        replied: true,
        deferred: false,
        reply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
      } as unknown as ChatInputCommandInteraction;

      const client = await startBot();

      const interactionHandler = vi
        .mocked(client.on)
        .mock.calls.find((call) => call[0] === Events.InteractionCreate)?.[1];

      if (interactionHandler) {
        await interactionHandler(mockInteraction as Interaction);
      }

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    });

    it("should handle command execution errors with followUp when deferred", async () => {
      const { commands } = await import("../src/commands");
      const searchCommand = commands.get("search");
      vi.mocked(searchCommand!.execute).mockRejectedValueOnce(
        new Error("Command failed"),
      );

      const mockInteraction = {
        isChatInputCommand: vi.fn().mockReturnValue(true),
        commandName: "search",
        replied: false,
        deferred: true,
        reply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
      } as unknown as ChatInputCommandInteraction;

      const client = await startBot();

      const interactionHandler = vi
        .mocked(client.on)
        .mock.calls.find((call) => call[0] === Events.InteractionCreate)?.[1];

      if (interactionHandler) {
        await interactionHandler(mockInteraction as Interaction);
      }

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    });
  });

  describe("Error Handling", () => {
    it("should register error handler", async () => {
      const client = await startBot();

      const errorHandler = vi
        .mocked(client.on)
        .mock.calls.find((call) => call[0] === "error")?.[1];

      expect(errorHandler).toBeDefined();
    });

    it("should handle Discord client errors", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const client = await startBot();

      const errorHandler = vi
        .mocked(client.on)
        .mock.calls.find((call) => call[0] === "error")?.[1];

      if (errorHandler) {
        errorHandler(new Error("Test error"));
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Discord client error:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Bot Lifecycle", () => {
    it("should stop bot and destroy client", async () => {
      const client = await startBot();
      expect(getClient()).not.toBeNull();

      await stopBot();

      expect(client.destroy).toHaveBeenCalled();
      expect(getClient()).toBeNull();
    });

    it("should handle stopBot when client is null", async () => {
      expect(getClient()).toBeNull();

      await expect(stopBot()).resolves.not.toThrow();
    });

    it("should be able to restart bot after stopping", async () => {
      await startBot();
      await stopBot();

      const newClient = await startBot();

      expect(newClient).toBeDefined();
      expect(getClient()).not.toBeNull();
    });
  });

  describe("Environment Variables", () => {
    it("should use DISCORD_TOKEN from environment", async () => {
      process.env.DISCORD_TOKEN = "custom-token";

      const client = await startBot();

      expect(client.login).toHaveBeenCalledWith("custom-token");
    });

    it("should use DISCORD_CLIENT_ID from environment", async () => {
      process.env.DISCORD_CLIENT_ID = "custom-client-id";

      const client = await startBot();

      // Trigger ready event to register commands
      const readyHandler = vi
        .mocked(client.once)
        .mock.calls.find((call) => call[0] === Events.ClientReady)?.[1];

      if (readyHandler) {
        await readyHandler(client);
      }

      const { Routes } = await import("discord.js");
      expect(Routes.applicationCommands).toHaveBeenCalledWith(
        "custom-client-id",
      );
    });
  });
});
