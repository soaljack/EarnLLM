const express = require('express');
const OpenAI = require('openai');
const axios = require('axios');
const { v4: uuidv4, validate: isUuid } = require('uuid');
const { Op } = require('sequelize');
const createError = require('http-errors');
const {
  sequelize, LlmModel, ExternalModel, ApiUsage,
} = require('../db/sequelize');
const {
  rateLimitByPlan,
  checkDailyQuota,
  checkTokenAllowance,
} = require('../middleware/rateLimit.middleware');
const { authenticateApiKey } = require('../middleware/apiKey.middleware');
const { requireApiPermission } = require('../middleware/permission.middleware');

// Wrapper to lazily call the permission middleware, breaking the circular dependency
const lazyRequireApiPermission = (permission) => (req, res, next) => (
  requireApiPermission(permission)(req, res, next)
);

const router = express.Router();

// Helper function to calculate token usage and costs
const calculateUsageAndCosts = (promptTokens, completionTokens, model, isExternal) => {
  let promptCost; let
    completionCost;

  if (isExternal) {
    // External models use direct costs set by user
    promptCost = (promptTokens / 1000) * model.promptTokenCostInCents;
    completionCost = (completionTokens / 1000) * model.completionTokenCostInCents;
  } else {
    // System models use base cost + markup
    const promptBaseCost = (promptTokens / 1000) * model.basePromptTokenCostInCents;
    const completionBaseCost = (completionTokens / 1000) * model.baseCompletionTokenCostInCents;

    // Apply markup percentage
    promptCost = promptBaseCost * (1 + model.markupPercentage / 100);
    completionCost = completionBaseCost * (1 + model.markupPercentage / 100);
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    promptCostCents: parseFloat(promptCost.toFixed(6)),
    completionCostCents: parseFloat(completionCost.toFixed(6)),
    totalCostCents: parseFloat((promptCost + completionCost).toFixed(6)),
  };
};

/**
 * Apply middleware stack for all LLM routes
 */
router.use(
  authenticateApiKey,
  rateLimitByPlan,
  checkDailyQuota,
  checkTokenAllowance,
);

/**
 * @route POST /api/llm/chat/completions
 * @desc Process a chat completion request
 * @access Private (API key)
 */
router.post('/chat/completions', lazyRequireApiPermission('chat:completion'), async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  let usage = null;

  try {
    const {
      model: modelId, messages, temperature, max_tokens: maxTokens, stream,
    } = req.body;

    if (!modelId) {
      return next(createError(400, 'Model ID is required'));
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return next(createError(400, 'Messages array is required'));
    }

    // Check for streaming (not implemented in this version)
    if (stream) {
      return next(createError(400, 'Streaming is not supported in this version'));
    }

    // Try to find the model as a system model first
    let model = await LlmModel.findOne({
      where: {
        modelId,
        isActive: true,
      },
    });

    let isExternalModel = false;

    // If not found, try to find as user's external model
    if (!model) {
      const orClauses = [{ modelId }];
      if (isUuid(modelId)) {
        orClauses.push({ id: modelId });
      }
      model = await ExternalModel.findOne({
        where: {
          [Op.or]: orClauses,
          UserId: req.user.id,
          isActive: true,
        },
      });

      if (model) {
        isExternalModel = true;
      }
    }

    if (!model) {
      return next(createError(404, `Model "${modelId}" not found or not accessible`));
    }

    // Check if model supports chat capabilities
    if (!model.capabilities.includes('chat')) {
      return next(createError(400, `Model "${modelId}" does not support chat completions`));
    }

    let response;

    if (isExternalModel) {
      // Process request using external model API
      try {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${model.getDecryptedApiKey()}`,
          ...(model.headers || {}),
        };

        // Prepare the request body based on model's template or default format
        let requestBody;
        if (model.requestTemplate) {
          // Apply custom template if provided
          requestBody = JSON.parse(JSON.stringify(model.requestTemplate));
          // Insert actual values into template
          requestBody.model = model.modelId;
          requestBody.messages = messages;
          if (temperature !== undefined) requestBody.temperature = temperature;
          if (maxTokens !== undefined) requestBody.maxTokens = maxTokens;
        } else {
          // Default OpenAI-compatible format
          requestBody = {
            model: model.modelId,
            messages,
            temperature: temperature !== undefined ? temperature : 0.7,
            maxTokens: maxTokens !== undefined ? maxTokens : 1000,
          };
        }

        const externalResponse = await axios.post(model.apiEndpoint, requestBody, { headers });

        // Transform response if needed
        if (model.responseMapping) {
          // Helper to safely access nested properties from the external API response
          const getProperty = (obj, path) => {
            if (!path || typeof path !== 'string') return undefined;
            return path.split('.').reduce((acc, key) => acc && acc[key], obj);
          };

          const externalData = externalResponse.data;

          // Apply custom response mapping if provided
          response = {
            id: getProperty(externalData, model.responseMapping.id) || requestId,
            object: getProperty(externalData, model.responseMapping.object) || 'chat.completion',
            created: getProperty(externalData, model.responseMapping.created)
              || Math.floor(Date.now() / 1000),
            model: modelId,
            choices: getProperty(externalData, model.responseMapping.choices),
            usage: getProperty(externalData, model.responseMapping.usage),
          };
        } else {
          // Assume OpenAI-compatible response
          response = externalResponse.data;
          response.model = modelId; // Use our model ID for consistency
        }

        // Extract usage statistics from the response
        usage = {
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
        };
      } catch (error) {
        console.error('External API error:', error.message);

        // Log the failed external request
        await ApiUsage.create({
          UserId: req.user.id,
          requestId,
          endpoint: '/chat/completions',
          succeeded: false,
          errorMessage: error.message,
          processingTimeMs: Date.now() - startTime,
          externalModelId: model.id,
          clientIp: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
            modelId,
            error: error.message,
          },
        });

        return next(createError(502, `External model API error: ${error.message}`));
      }
    } else {
      // Process request using OpenAI for system/hosted models
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const oaiResponse = await openai.chat.completions.create({
          model: model.modelId,
          messages,
          temperature,
          max_tokens: maxTokens,
          user: req.user.id,
        });

        // Extract usage statistics
        usage = {
          promptTokens: oaiResponse.usage.prompt_tokens,
          completionTokens: oaiResponse.usage.completion_tokens,
        };

        response = oaiResponse;
      } catch (error) {
        console.error('OpenAI API error:', error.message);

        // Log the failed request
        await ApiUsage.create({
          UserId: req.user.id,
          requestId,
          endpoint: '/chat/completions',
          succeeded: false,
          errorMessage: error.message,
          processingTimeMs: Date.now() - startTime,
          LlmModelId: model.id,
          clientIp: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
            modelId,
            error: error.message,
          },
        });

        return next(createError(502, `Provider API error: ${error.message}`));
      }
    }

    // Calculate costs and token usage
    const costs = calculateUsageAndCosts(
      usage.promptTokens,
      usage.completionTokens,
      model,
      isExternalModel,
    );

    // Log the API usage
    await ApiUsage.create({
      UserId: req.user.id,
      requestId,
      endpoint: '/chat/completions',
      promptTokens: costs.promptTokens,
      completionTokens: costs.completionTokens,
      totalTokens: costs.totalTokens,
      promptCostCents: costs.promptCostCents,
      completionCostCents: costs.completionCostCents,
      totalCostCents: costs.totalCostCents,
      processingTimeMs: Date.now() - startTime,
      succeeded: true,
      LlmModelId: isExternalModel ? null : model.id,
      externalModelId: isExternalModel ? model.id : null,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        modelId,
        temperature,
      },
    });

    // Update user's monthly token usage
    const billingAccount = await req.user.getBillingAccount();
    await billingAccount.update({
      tokenUsageThisMonth: billingAccount.tokenUsageThisMonth + costs.totalTokens,
    });

    // Return the response to the client
    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route POST /api/llm/embeddings
 * @desc Generate embeddings for the given input
 * @access Private (API key)
 */
router.post('/embeddings', lazyRequireApiPermission('embed'), async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const { model: modelId, input } = req.body;

    if (!modelId) {
      return next(createError(400, 'Model ID is required'));
    }

    if (!input) {
      return next(createError(400, 'Input is required'));
    }

    // Find a model that supports embeddings
    let model = await LlmModel.findOne({
      where: {
        [Op.or]: [
          { id: modelId },
          { modelId },
        ],
        capabilities: {
          [Op.contains]: ['embed'],
        },
        isActive: true,
      },
    });

    let isExternalModel = false;

    if (!model) {
      model = await ExternalModel.findOne({
        where: {
          [Op.or]: [
            { id: modelId },
            { modelId },
          ],
          capabilities: {
            [Op.contains]: ['embed'],
          },
          UserId: req.user.id,
          isActive: true,
        },
      });

      if (model) {
        isExternalModel = true;
      }
    }

    if (!model) {
      return next(createError(404, `Model "${modelId}" not found or does not support embeddings`));
    }

    let response;
    let tokenCount = 0;

    // Process embeddings using OpenAI for system models
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const embeddingResponse = await openai.embeddings.create({
        model: model.modelId,
        input,
      });

      response = embeddingResponse;
      tokenCount = embeddingResponse.usage.total_tokens;
    } catch (error) {
      console.error('Embeddings API error:', error.message);

      // Log the failed request
      await ApiUsage.create({
        UserId: req.user.id,
        requestId,
        endpoint: '/embeddings',
        succeeded: false,
        errorMessage: error.message,
        processingTimeMs: Date.now() - startTime,
        LlmModelId: model.id,
        clientIp: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          modelId,
          error: error.message,
        },
      });

      return next(createError(502, `Provider API error: ${error.message}`));
    }

    // Calculate costs (for embeddings, all tokens are prompt tokens)
    const costs = calculateUsageAndCosts(
      tokenCount,
      0,
      model,
      isExternalModel,
    );

    // Log the API usage
    await ApiUsage.create({
      UserId: req.user.id,
      requestId,
      endpoint: '/embeddings',
      promptTokens: costs.promptTokens,
      totalTokens: costs.totalTokens,
      promptCostCents: costs.promptCostCents,
      totalCostCents: costs.totalCostCents,
      processingTimeMs: Date.now() - startTime,
      succeeded: true,
      LlmModelId: isExternalModel ? null : model.id,
      externalModelId: isExternalModel ? model.id : null,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Update user's monthly token usage
    const billingAccount = await req.user.getBillingAccount();
    await billingAccount.update({
      tokenUsageThisMonth: billingAccount.tokenUsageThisMonth + costs.totalTokens,
    });

    // Return the response to the client
    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route GET /api/llm/usage
 * @desc Get usage statistics for the current user
 * @access Private (API key)
 */
router.get('/usage', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Parse date filters
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const start = startDate ? new Date(startDate) : firstDayOfMonth;
    const end = endDate ? new Date(endDate) : today;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return next(createError(400, 'Invalid date format'));
    }

    // Query for usage data
    const usageData = await ApiUsage.findAll({
      where: {
        UserId: req.user.id,
        createdAt: {
          [Op.between]: [start, end],
        },
        succeeded: true,
      },
      attributes: [
        'endpoint',
        [sequelize.fn('SUM', sequelize.col('totalTokens')), 'totalTokens'],
        [sequelize.fn('SUM', sequelize.col('totalCostCents')), 'totalCostCents'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'requestCount'],
      ],
      group: ['endpoint'],
    });

    // Calculate totals across all endpoints
    const totals = await ApiUsage.findOne({
      where: {
        UserId: req.user.id,
        createdAt: {
          [Op.between]: [start, end],
        },
        succeeded: true,
      },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('totalTokens')), 'totalTokens'],
        [sequelize.fn('SUM', sequelize.col('totalCostCents')), 'totalCostCents'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'requestCount'],
      ],
      raw: true,
    });

    return res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      breakdown: usageData,
      totals: {
        totalTokens: parseInt(totals.totalTokens || 0, 10),
        totalCostCents: parseFloat(totals.totalCostCents || 0),
        requestCount: parseInt(totals.requestCount || 0, 10),
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
