/**
 * Minimal RuVector test to isolate OOM cause
 */

import { describe, it, expect } from "vitest";

// Just import the source file to see if it causes OOM
import { RuVectorWrapper } from "../src/ruvector/index.js";

describe("Minimal RuVector Test", () => {
  it("should import RuVectorWrapper", () => {
    expect(RuVectorWrapper).toBeDefined();
  });
});
