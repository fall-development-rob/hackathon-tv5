/**
 * Utility Functions Tests
 */

import { describe, it, expect } from "vitest";
import {
  cn,
  formatDuration,
  formatRating,
  truncateText,
  getYear,
} from "../../src/lib/utils.js";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", true && "active")).toBe("base active");
    expect(cn("base", false && "hidden")).toBe("base");
  });

  it("deduplicates Tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles arrays and objects", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
    expect(cn({ active: true, disabled: false })).toBe("active");
  });

  it("handles empty and undefined values", () => {
    expect(cn("foo", undefined, "bar")).toBe("foo bar");
    expect(cn("foo", null, "bar")).toBe("foo bar");
    expect(cn("foo", "", "bar")).toBe("foo bar");
  });
});

describe("formatDuration", () => {
  it("formats seconds to hours and minutes", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3661)).toBe("1h 1m");
    expect(formatDuration(7200)).toBe("2h");
    expect(formatDuration(5400)).toBe("1h 30m");
  });

  it("formats minutes only when less than an hour", () => {
    expect(formatDuration(300)).toBe("5m");
    expect(formatDuration(1800)).toBe("30m");
    expect(formatDuration(0)).toBe("0m");
  });
});

describe("formatRating", () => {
  it("formats rating to one decimal place", () => {
    expect(formatRating(8.5)).toBe("8.5");
    expect(formatRating(7)).toBe("7.0");
    expect(formatRating(9.123)).toBe("9.1");
  });
});

describe("truncateText", () => {
  it("truncates text longer than maxLength", () => {
    expect(truncateText("Hello World", 8)).toBe("Hello...");
  });

  it("returns original text if shorter than maxLength", () => {
    expect(truncateText("Hi", 10)).toBe("Hi");
    expect(truncateText("Hello", 5)).toBe("Hello");
  });
});

describe("getYear", () => {
  it("extracts year from date string", () => {
    expect(getYear("2024-03-15")).toBe(2024);
    expect(getYear("1999-12-31")).toBe(1999);
  });

  it("extracts year from Date object", () => {
    expect(getYear(new Date("2024-06-15"))).toBe(2024);
  });
});
