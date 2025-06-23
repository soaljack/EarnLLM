const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const modelRoutes = require('./model.routes');
const billingRoutes = require('./billing.routes');
const apiKeyRoutes = require('./apiKey.routes');
const llmRoutes = require('./llm.routes');
const analyticsRoutes = require('./analytics.routes');

const router = express.Router();

// Welcome / version endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to EarnLLM API',
    version: '1.0.0',
    docs: '/docs',
  });
});

// Register all route groups
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/models', modelRoutes);
router.use('/billing', billingRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/llm', llmRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
