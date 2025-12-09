import { Router } from "express";
import type { Router as IRouter } from "express";
import searchRouter from "./search";
import recommendationsRouter from "./recommendations";
import contentRouter from "./content";
import availabilityRouter from "./availability";
import userRouter from "./user";
import mylistRouter from "./mylist";
import authRouter from "./auth";

const router: IRouter = Router();

// API version 1 routes
router.use("/auth", authRouter);
router.use("/search", searchRouter);
router.use("/recommendations", recommendationsRouter);
router.use("/content", contentRouter);
router.use("/availability", availabilityRouter);
router.use("/my-list", mylistRouter);
router.use("/", userRouter); // Mount user routes at root level for /watch-history and /ratings

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

export default router;
