import { Router } from 'express';
import searchRouter from './search';
import recommendationsRouter from './recommendations';
import contentRouter from './content';
import availabilityRouter from './availability';
import userRouter from './user';

const router = Router();

// API version 1 routes
router.use('/search', searchRouter);
router.use('/recommendations', recommendationsRouter);
router.use('/content', contentRouter);
router.use('/availability', availabilityRouter);
router.use('/', userRouter); // Mount user routes at root level for /watch-history and /ratings

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
