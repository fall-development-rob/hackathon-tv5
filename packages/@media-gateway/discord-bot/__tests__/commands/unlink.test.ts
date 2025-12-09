/**
 * Unlink Command Tests
 *
 * Unit tests for the /unlink command
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { data as unlinkData, execute } from "../../src/commands/unlink";
import type { CommandInteraction } from "discord.js";
import { ComponentType } from "discord.js";

// Mock UserLinkService
const mockIsLinked = vi.fn();
const mockUnlinkUser = vi.fn();

vi.mock("../../src/services/user-link", () => ({
  UserLinkService: vi.fn().mockImplementation(() => ({
    isLinked: mockIsLinked,
    unlinkUser: mockUnlinkUser,
  })),
}));

const mockReply = vi.fn().mockResolvedValue({
  awaitMessageComponent: vi.fn(),
});
const mockDeferUpdate = vi.fn().mockResolvedValue(undefined);
const mockEditReply = vi.fn().mockResolvedValue(undefined);

const createMockInteraction = (
  isLinked: boolean = true,
): CommandInteraction => {
  return {
    reply: mockReply,
    editReply: mockEditReply,
    user: {
      id: "discord123",
      username: "testuser",
    },
  } as unknown as CommandInteraction;
};

const createMockConfirmation = (confirmed: boolean) => {
  return {
    customId: confirmed ? "unlink_confirm" : "unlink_cancel",
    deferUpdate: mockDeferUpdate,
    editReply: mockEditReply,
    user: {
      id: "discord123",
    },
  };
};

const mockPool = {} as any;

describe("unlinkCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Slash Command Data", () => {
    it("should have correct command name", () => {
      expect(unlinkData.name).toBe("unlink");
    });

    it("should have correct description", () => {
      expect(unlinkData.description).toBe(
        "Unlink your Discord account from Media Gateway",
      );
    });

    it("should have no required options", () => {
      expect(unlinkData.options).toEqual([]);
    });
  });

  describe("Not Linked Scenario", () => {
    it("should show not linked message", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockReply).toHaveBeenCalled();
      const reply = mockReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain("Not Linked");
      expect(reply.ephemeral).toBe(true);
    });

    it("should suggest linking account", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      const linkField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("link an account"),
      );
      expect(linkField).toBeDefined();
      expect(linkField?.value).toContain("/link");
    });

    it("should have warning color", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      expect(reply.embeds[0].data.color).toBe(0xff9900); // Orange
    });
  });

  describe("Confirmation Dialog", () => {
    it("should show confirmation embed with buttons", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      const interaction = createMockInteraction();

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("timeout")),
      });

      await execute(interaction, mockPool);

      expect(mockReply).toHaveBeenCalled();
      const reply = mockReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain("Confirm Unlink");
      expect(reply.components).toBeDefined();
      expect(reply.components.length).toBeGreaterThan(0);
    });

    it("should list features that will be lost", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      const interaction = createMockInteraction();

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("timeout")),
      });

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      const loseAccessField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("lose access"),
      );
      expect(loseAccessField).toBeDefined();
      expect(loseAccessField?.value).toContain("recommendations");
      expect(loseAccessField?.value).toContain("My List");
      expect(loseAccessField?.value).toContain("briefings");
    });

    it("should mention re-linking is possible", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      const interaction = createMockInteraction();

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("timeout")),
      });

      await execute(interaction, mockPool);

      const reply = mockReply.mock.calls[0][0];
      const noteField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "Note",
      );
      expect(noteField).toBeDefined();
      expect(noteField?.value).toContain("link");
    });

    it("should be ephemeral", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      const interaction = createMockInteraction();

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("timeout")),
      });

      await execute(interaction, mockPool);

      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true }),
      );
    });
  });

  describe("Confirm Unlink", () => {
    it("should unlink user when confirmed", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockUnlinkUser.mockResolvedValueOnce({ success: true });

      const confirmation = createMockConfirmation(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockUnlinkUser).toHaveBeenCalledWith("discord123");
      expect(mockDeferUpdate).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should show success message", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockUnlinkUser.mockResolvedValueOnce({ success: true });

      const confirmation = createMockConfirmation(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.embeds[0].data.title).toContain("Successfully Unlinked");
      expect(editCall.components).toEqual([]);
    });

    it("should have success color", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockUnlinkUser.mockResolvedValueOnce({ success: true });

      const confirmation = createMockConfirmation(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.embeds[0].data.color).toBe(0x00ff00); // Green
    });

    it("should handle unlink failure", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockUnlinkUser.mockResolvedValueOnce({
        success: false,
        message: "Database error",
      });

      const confirmation = createMockConfirmation(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.embeds[0].data.title).toContain("Unlink Failed");
      expect(editCall.embeds[0].data.description).toContain("Database error");
    });

    it("should have error color on failure", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockUnlinkUser.mockResolvedValueOnce({
        success: false,
        message: "Error",
      });

      const confirmation = createMockConfirmation(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.embeds[0].data.color).toBe(0xff0000); // Red
    });

    it("should remove buttons after confirmation", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockUnlinkUser.mockResolvedValueOnce({ success: true });

      const confirmation = createMockConfirmation(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.components).toEqual([]);
    });
  });

  describe("Cancel Unlink", () => {
    it("should cancel when cancel button clicked", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      const confirmation = createMockConfirmation(false);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockUnlinkUser).not.toHaveBeenCalled();
      expect(mockDeferUpdate).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should show cancelled message", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      const confirmation = createMockConfirmation(false);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.embeds[0].data.title).toContain("Cancelled");
      expect(editCall.embeds[0].data.description).toContain("remains linked");
    });

    it("should have info color for cancellation", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      const confirmation = createMockConfirmation(false);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.embeds[0].data.color).toBe(0x0099ff); // Blue
    });

    it("should remove buttons after cancellation", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      const confirmation = createMockConfirmation(false);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.components).toEqual([]);
    });
  });

  describe("Timeout Handling", () => {
    it("should handle timeout after 30 seconds", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("timeout")),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockUnlinkUser).not.toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should show timeout message", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("timeout")),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.embeds[0].data.title).toContain("Timed Out");
      expect(editCall.embeds[0].data.description).toContain("remains linked");
    });

    it("should have gray color for timeout", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("timeout")),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.embeds[0].data.color).toBe(0x999999); // Gray
    });

    it("should remove buttons on timeout", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockRejectedValue(new Error("timeout")),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.components).toEqual([]);
    });
  });

  describe("Button Interaction Filter", () => {
    it("should only accept interactions from command user", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      let filterFunc: any;

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockImplementation((options) => {
          filterFunc = options.filter;
          return Promise.reject(new Error("timeout"));
        }),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(filterFunc).toBeDefined();

      // Test filter with matching user
      const matchingInteraction = { user: { id: "discord123" } };
      expect(filterFunc(matchingInteraction)).toBe(true);

      // Test filter with different user
      const differentInteraction = { user: { id: "different456" } };
      expect(filterFunc(differentInteraction)).toBe(false);
    });
  });

  describe("Component Type", () => {
    it("should wait for button component type", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      let componentType: any;

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockImplementation((options) => {
          componentType = options.componentType;
          return Promise.reject(new Error("timeout"));
        }),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(componentType).toBe(ComponentType.Button);
    });

    it("should have 30 second timeout", async () => {
      mockIsLinked.mockResolvedValueOnce(true);

      let timeout: any;

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockImplementation((options) => {
          timeout = options.time;
          return Promise.reject(new Error("timeout"));
        }),
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(timeout).toBe(30000);
    });
  });

  describe("Error Handling", () => {
    it("should handle isLinked service errors", async () => {
      mockIsLinked.mockRejectedValueOnce(new Error("Database error"));

      const interaction = createMockInteraction();

      await expect(execute(interaction, mockPool)).rejects.toThrow();
    });

    it("should handle unlink service errors", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockUnlinkUser.mockRejectedValueOnce(new Error("Service error"));

      const confirmation = createMockConfirmation(true);

      mockReply.mockResolvedValueOnce({
        awaitMessageComponent: vi.fn().mockResolvedValue(confirmation),
      });

      const interaction = createMockInteraction();

      await expect(execute(interaction, mockPool)).rejects.toThrow();
    });
  });
});
