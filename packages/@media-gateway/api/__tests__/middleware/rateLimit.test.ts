/**
 * Rate Limit Middleware Tests
 * Tests rate limiting behavior using dedicated test app with rate limiting enabled
 */

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";

// Create a dedicated test app with real rate limiting enabled
const createTestApp = (limit: number, windowMs: number = 1000) => {
  const app = express();
  app.use(express.json());

  const limiter = rateLimit({
    windowMs,
    max: limit,
    message: {
      error: "Too many requests",
      code: "RATE_LIMIT_EXCEEDED",
      details: {
        retryAfter: `${windowMs / 1000} seconds`,
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api", limiter);

  app.get("/api/test", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/test", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
};

describe("Rate Limit Middleware", () => {
  describe("General API Rate Limit", () => {
    it("should allow requests within rate limit", async () => {
      const app = createTestApp(10);

      const responses = await Promise.all(
        Array(5)
          .fill(null)
          .map(() => request(app).get("/api/test")),
      );

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it("should include rate limit headers", async () => {
      const app = createTestApp(10);

      const response = await request(app).get("/api/test");

      expect(response.headers).toHaveProperty("ratelimit-limit");
      expect(response.headers).toHaveProperty("ratelimit-remaining");
      expect(response.headers).toHaveProperty("ratelimit-reset");
    });

    it("should return 429 when rate limit exceeded", async () => {
      const app = createTestApp(5);

      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get("/api/test"));

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it("should include retry information in rate limit response", async () => {
      const app = createTestApp(3);

      const requests = Array(5)
        .fill(null)
        .map(() => request(app).get("/api/test"));

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find((r) => r.status === 429);

      expect(rateLimitedResponse).toBeDefined();
      expect(rateLimitedResponse!.body).toMatchObject({
        error: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
        details: expect.objectContaining({
          retryAfter: expect.any(String),
        }),
      });
    });
  });

  describe("Different Rate Limits", () => {
    it("should apply stricter limit when configured", async () => {
      const strictApp = createTestApp(3);
      const relaxedApp = createTestApp(10);

      const strictRequests = Array(5)
        .fill(null)
        .map(() => request(strictApp).get("/api/test"));

      const relaxedRequests = Array(5)
        .fill(null)
        .map(() => request(relaxedApp).get("/api/test"));

      const strictResponses = await Promise.all(strictRequests);
      const relaxedResponses = await Promise.all(relaxedRequests);

      const strictRateLimited = strictResponses.filter((r) => r.status === 429);
      const relaxedRateLimited = relaxedResponses.filter(
        (r) => r.status === 429,
      );

      // Stricter limit should have more rate limited responses
      expect(strictRateLimited.length).toBeGreaterThan(
        relaxedRateLimited.length,
      );
    });

    it("should return rate limit error for POST requests", async () => {
      const app = createTestApp(3);

      const requests = Array(5)
        .fill(null)
        .map((_, i) =>
          request(app)
            .post("/api/test")
            .send({ data: `test-${i}` }),
        );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find((r) => r.status === 429);

      expect(rateLimitedResponse).toBeDefined();
      expect(rateLimitedResponse!.body).toMatchObject({
        error: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
      });
    });
  });

  describe("Rate Limit Headers Format", () => {
    it("should use standard RateLimit headers (not legacy X-RateLimit)", async () => {
      const app = createTestApp(10);

      const response = await request(app).get("/api/test");

      // Should use standard RateLimit headers
      expect(response.headers).toHaveProperty("ratelimit-limit");
      expect(response.headers).toHaveProperty("ratelimit-remaining");

      // Should not use legacy X-RateLimit headers
      expect(response.headers["x-ratelimit-limit"]).toBeUndefined();
      expect(response.headers["x-ratelimit-remaining"]).toBeUndefined();
    });

    it("should decrement remaining count with each request", async () => {
      const app = createTestApp(10);

      const response1 = await request(app).get("/api/test");
      const remaining1 = parseInt(response1.headers["ratelimit-remaining"]);

      const response2 = await request(app).get("/api/test");
      const remaining2 = parseInt(response2.headers["ratelimit-remaining"]);

      expect(remaining1).toBeGreaterThan(remaining2);
    });
  });
});
