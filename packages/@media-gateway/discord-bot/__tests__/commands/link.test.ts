/**
 * Link Command Tests
 *
 * Unit tests for the /link command
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { data as linkData, execute } from "../../src/commands/link";
import type { CommandInteraction } from "discord.js";

// Mock UserLinkService
const mockIsLinked = vi.fn();
const mockLinkUserWithCode = vi.fn();
const mockLinkUserWithCredentials = vi.fn();

vi.mock("../../src/services/user-link", () => ({
  UserLinkService: vi.fn().mockImplementation(() => ({
    isLinked: mockIsLinked,
    linkUserWithCode: mockLinkUserWithCode,
    linkUserWithCredentials: mockLinkUserWithCredentials,
  })),
}));

const mockReply = vi.fn().mockResolvedValue(undefined);
const mockDeferReply = vi.fn().mockResolvedValue(undefined);
const mockEditReply = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();

const createMockInteraction = (
  subcommand: string,
  optionsMap: Record<string, any> = {},
): CommandInteraction => {
  mockGet.mockImplementation((name: string) => {
    return optionsMap[name] ? { value: optionsMap[name] } : undefined;
  });

  return {
    reply: mockReply,
    deferReply: mockDeferReply,
    editReply: mockEditReply,
    options: {
      data: [{ name: subcommand }],
      get: mockGet,
    },
    user: {
      id: "discord123",
      username: "testuser",
    },
  } as unknown as CommandInteraction;
};

const mockPool = {} as any;

describe("linkCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLinked.mockResolvedValue(false);
  });

  describe("Slash Command Data", () => {
    it("should have correct command name", () => {
      expect(linkData.name).toBe("link");
    });

    it("should have correct description", () => {
      expect(linkData.description).toBe(
        "Link your Discord account to Media Gateway",
      );
    });

    it("should have code subcommand", () => {
      const options = linkData.options;
      const codeOption = options.find((opt: any) => opt.name === "code");
      expect(codeOption).toBeDefined();
    });

    it("should have credentials subcommand", () => {
      const options = linkData.options;
      const credOption = options.find((opt: any) => opt.name === "credentials");
      expect(credOption).toBeDefined();
    });

    it("should have instructions subcommand", () => {
      const options = linkData.options;
      const instrOption = options.find(
        (opt: any) => opt.name === "instructions",
      );
      expect(instrOption).toBeDefined();
    });

    it("should require code for code subcommand", () => {
      const options = linkData.options;
      const codeOption: any = options.find((opt: any) => opt.name === "code");
      const codeParam = codeOption?.options?.find(
        (opt: any) => opt.name === "code",
      );
      expect(codeParam?.required).toBe(true);
    });

    it("should require email and password for credentials subcommand", () => {
      const options = linkData.options;
      const credOption: any = options.find(
        (opt: any) => opt.name === "credentials",
      );
      const emailParam = credOption?.options?.find(
        (opt: any) => opt.name === "email",
      );
      const passwordParam = credOption?.options?.find(
        (opt: any) => opt.name === "password",
      );
      expect(emailParam?.required).toBe(true);
      expect(passwordParam?.required).toBe(true);
    });
  });

  describe("Instructions Subcommand", () => {
    it("should show instructions when not linked", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction("instructions");

      await execute(interaction, mockPool);

      expect(mockReply).toHaveBeenCalled();
      const reply = mockReply.mock.calls[0][0];
      expect(reply.embeds).toBeDefined();
      expect(reply.embeds[0].data.title).toContain("Link");
      expect(reply.ephemeral).toBe(true);
    });

    it("should show already linked message when linked", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      const interaction = createMockInteraction("instructions");

      await execute(interaction, mockPool);

      expect(mockReply).toHaveBeenCalled();
      const reply = mockReply.mock.calls[0][0];
      expect(reply.embeds[0].data.description).toContain("already linked");
    });

    it("should include benefits section", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction("instructions");

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      const benefitsField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Benefits"),
      );
      expect(benefitsField).toBeDefined();
    });

    it("should include secure linking instructions", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction("instructions");

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      const secureField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Secure"),
      );
      expect(secureField).toBeDefined();
    });

    it("should include quick linking instructions", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction("instructions");

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      const quickField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Quick"),
      );
      expect(quickField).toBeDefined();
    });

    it("should show next steps when already linked", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      const interaction = createMockInteraction("instructions");

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      const nextStepsField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Next Steps"),
      );
      expect(nextStepsField).toBeDefined();
    });
  });

  describe("Code Subcommand", () => {
    it("should defer reply", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCode.mockResolvedValueOnce({ success: true });

      const interaction = createMockInteraction("code", {
        code: "ABC12345",
      });

      await execute(interaction, mockPool);

      expect(mockDeferReply).toHaveBeenCalledWith({ ephemeral: true });
    });

    it("should link user with valid code", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCode.mockResolvedValueOnce({ success: true });

      const interaction = createMockInteraction("code", {
        code: "ABC12345",
      });

      await execute(interaction, mockPool);

      expect(mockLinkUserWithCode).toHaveBeenCalledWith(
        "discord123",
        "ABC12345",
      );
      expect(mockEditReply).toHaveBeenCalled();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain("Successfully Linked");
    });

    it("should show error for invalid code", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCode.mockResolvedValueOnce({
        success: false,
        message: "Invalid code",
      });

      const interaction = createMockInteraction("code", {
        code: "INVALID",
      });

      await execute(interaction, mockPool);

      expect(mockEditReply).toHaveBeenCalled();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain("Linking Failed");
      expect(reply.embeds[0].data.description).toContain("Invalid code");
    });

    it("should prevent linking if already linked", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      const interaction = createMockInteraction("code", {
        code: "ABC12345",
      });

      await execute(interaction, mockPool);

      expect(mockReply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining("Already Linked"),
            }),
          }),
        ]),
        ephemeral: true,
      });
      expect(mockLinkUserWithCode).not.toHaveBeenCalled();
    });

    it("should include troubleshooting on failure", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCode.mockResolvedValueOnce({
        success: false,
        message: "Code expired",
      });

      const interaction = createMockInteraction("code", {
        code: "EXPIRED",
      });

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const troubleshootField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Troubleshooting"),
      );
      expect(troubleshootField).toBeDefined();
    });

    it("should show what's next on success", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCode.mockResolvedValueOnce({ success: true });

      const interaction = createMockInteraction("code", {
        code: "ABC12345",
      });

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const nextField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("What's Next"),
      );
      expect(nextField).toBeDefined();
    });
  });

  describe("Credentials Subcommand", () => {
    it("should defer reply", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCredentials.mockResolvedValueOnce({ success: true });

      const interaction = createMockInteraction("credentials", {
        email: "test@example.com",
        password: "password123",
      });

      await execute(interaction, mockPool);

      expect(mockDeferReply).toHaveBeenCalledWith({ ephemeral: true });
    });

    it("should link user with valid credentials", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCredentials.mockResolvedValueOnce({ success: true });

      const interaction = createMockInteraction("credentials", {
        email: "test@example.com",
        password: "password123",
      });

      await execute(interaction, mockPool);

      expect(mockLinkUserWithCredentials).toHaveBeenCalledWith(
        "discord123",
        "test@example.com",
        "password123",
      );
      expect(mockEditReply).toHaveBeenCalled();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain("Successfully Linked");
    });

    it("should show error for invalid credentials", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCredentials.mockResolvedValueOnce({
        success: false,
        message: "Invalid credentials",
      });

      const interaction = createMockInteraction("credentials", {
        email: "test@example.com",
        password: "wrong",
      });

      await execute(interaction, mockPool);

      expect(mockEditReply).toHaveBeenCalled();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain("Linking Failed");
    });

    it("should prevent linking if already linked", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      const interaction = createMockInteraction("credentials", {
        email: "test@example.com",
        password: "password123",
      });

      await execute(interaction, mockPool);

      expect(mockReply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining("Already Linked"),
            }),
          }),
        ]),
        ephemeral: true,
      });
      expect(mockLinkUserWithCredentials).not.toHaveBeenCalled();
    });

    it("should include security note on success", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCredentials.mockResolvedValueOnce({ success: true });

      const interaction = createMockInteraction("credentials", {
        email: "test@example.com",
        password: "password123",
      });

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const securityField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Security"),
      );
      expect(securityField).toBeDefined();
      expect(securityField?.value).toContain("not stored");
    });

    it("should include troubleshooting on failure", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCredentials.mockResolvedValueOnce({
        success: false,
        message: "Account not found",
      });

      const interaction = createMockInteraction("credentials", {
        email: "test@example.com",
        password: "password123",
      });

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const troubleshootField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Troubleshooting"),
      );
      expect(troubleshootField).toBeDefined();
    });
  });

  describe("Already Linked Handling", () => {
    it("should suggest unlinking for code subcommand", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      const interaction = createMockInteraction("code", {
        code: "ABC12345",
      });

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      const suggestionField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("different account"),
      );
      expect(suggestionField).toBeDefined();
      expect(suggestionField?.value).toContain("/unlink");
    });

    it("should suggest unlinking for credentials subcommand", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      const interaction = createMockInteraction("credentials", {
        email: "test@example.com",
        password: "password123",
      });

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      expect(reply.embeds[0].data.description).toContain("already linked");
    });
  });

  describe("Error Handling", () => {
    it("should handle isLinked errors", async () => {
      mockIsLinked.mockRejectedValueOnce(new Error("Database error"));

      const interaction = createMockInteraction("instructions");

      await expect(execute(interaction, mockPool)).rejects.toThrow();
    });

    it("should handle linking service errors", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCode.mockRejectedValueOnce(new Error("Service error"));

      const interaction = createMockInteraction("code", {
        code: "ABC12345",
      });

      await expect(execute(interaction, mockPool)).rejects.toThrow();
    });
  });

  describe("Embed Structure", () => {
    it("should have ephemeral replies", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction("instructions");

      await execute(interaction, mockPool);

      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true }),
      );
    });

    it("should have timestamps in embeds", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction("instructions");

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      expect(reply.embeds[0].data.timestamp).toBeDefined();
    });

    it("should have appropriate colors", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      mockLinkUserWithCode.mockResolvedValueOnce({ success: true });

      const interaction = createMockInteraction("code", {
        code: "ABC12345",
      });

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.color).toBe(0x00ff00); // Green for success
    });
  });
});
