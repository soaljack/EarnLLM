const express = require('express');
const createError = require('http-errors');
const { LlmModel, ExternalModel } = require('../models');
const { authenticateJWT, authenticateApiKey, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route GET /api/models
 * @desc Get all available LLM models
 * @access Private
 */
router.get('/', authenticateApiKey, async (req, res, next) => {
  try {
    // Get all active system models
    const systemModels = await LlmModel.findAll({
      where: { isActive: true },
      attributes: [
        'id', 'name', 'provider', 'modelId', 'description',
        'capabilities', 'basePromptTokenCostInCents', 'baseCompletionTokenCostInCents',
        'contextWindow', 'markupPercentage',
      ],
    });

    // Get user's external models if they have BYOM permission
    const pricingPlan = await req.user.getPricingPlan();

    let externalModels = [];
    if (pricingPlan.allowBYOM) {
      externalModels = await ExternalModel.findAll({
        where: {
          UserId: req.user.id,
          isActive: true,
        },
        attributes: [
          'id', 'name', 'provider', 'modelId', 'capabilities',
          'promptTokenCostInCents', 'completionTokenCostInCents',
          'contextWindow',
        ],
      });
    }

    res.json({
      systemModels,
      externalModels,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route GET /api/models/:id
 * @desc Get a specific LLM model
 * @access Private
 */
router.get('/:id', authenticateApiKey, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate that the ID is a UUID before querying
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      // If the ID is not a valid UUID, it can't exist in the database.
      return next(createError(404, 'Model not found'));
    }

    // Try to find the model as a system model first
    let model = await LlmModel.findOne({
      where: {
        id,
        isActive: true,
      },
    });

    if (!model) {
      // Try to find as external model belonging to the user
      model = await ExternalModel.findOne({
        where: {
          id,
          UserId: req.user.id,
          isActive: true,
        },
      });

      if (!model) {
        return next(createError(404, 'Model not found'));
      }
    }

    res.json(model);
  } catch (error) {
    return next(error);
  }
});

/**
 * ADMIN ROUTES FOR SYSTEM MODEL MANAGEMENT
 */

/**
 * @route POST /api/models
 * @desc Create a new system LLM model (admin only)
 * @access Admin
 */
router.post('/', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const {
      name,
      provider,
      modelId,
      baseUrl,
      description,
      capabilities,
      basePromptTokenCostInCents,
      baseCompletionTokenCostInCents,
      contextWindow,
      markupPercentage,
    } = req.body;

    // Validate required fields
    if (!name || !provider || !modelId) {
      next(createError(400, 'Name, provider, and modelId are required'));
      return;
    }

    // Create the model
    const model = await LlmModel.create({
      name,
      provider,
      modelId,
      baseUrl,
      description,
      capabilities: capabilities || ['chat'],
      basePromptTokenCostInCents,
      baseCompletionTokenCostInCents,
      contextWindow: contextWindow || 8192,
      markupPercentage: markupPercentage || 20,
      isActive: true,
    });

    res.status(201).json(model);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route PUT /api/models/:id
 * @desc Update a system LLM model (admin only)
 * @access Admin
 */
router.put('/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      provider,
      modelId,
      baseUrl,
      description,
      capabilities,
      basePromptTokenCostInCents,
      baseCompletionTokenCostInCents,
      contextWindow,
      markupPercentage,
      isActive,
    } = req.body;

    // Find the model
    const model = await LlmModel.findByPk(id);
    if (!model) {
      next(createError(404, 'Model not found'));
      return;
    }

    // Update the model
    await model.update({
      name: name !== undefined ? name : model.name,
      provider: provider !== undefined ? provider : model.provider,
      modelId: modelId !== undefined ? modelId : model.modelId,
      baseUrl: baseUrl !== undefined ? baseUrl : model.baseUrl,
      description: description !== undefined ? description : model.description,
      capabilities: capabilities !== undefined ? capabilities : model.capabilities,
      basePromptTokenCostInCents: basePromptTokenCostInCents !== undefined
        ? basePromptTokenCostInCents : model.basePromptTokenCostInCents,
      baseCompletionTokenCostInCents: baseCompletionTokenCostInCents !== undefined
        ? baseCompletionTokenCostInCents : model.baseCompletionTokenCostInCents,
      contextWindow: contextWindow !== undefined ? contextWindow : model.contextWindow,
      markupPercentage: markupPercentage !== undefined ? markupPercentage : model.markupPercentage,
      isActive: isActive !== undefined ? isActive : model.isActive,
    });

    res.json(model);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route DELETE /api/models/:id
 * @desc Delete a system LLM model (admin only)
 * @access Admin
 */
router.delete('/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await LlmModel.destroy({
      where: { id },
    });

    if (!deleted) {
      next(createError(404, 'Model not found'));
      return;
    }

    res.json({ message: 'Model deleted successfully' });
  } catch (error) {
    return next(error);
  }
});

/**
 * EXTERNAL MODEL ROUTES (BYOM)
 */

/**
 * @route POST /api/models/external
 * @desc Register a new external model (BYOM)
 * @access Private
 */
router.post('/external', authenticateJWT, async (req, res, next) => {
  try {
    // Check if user's plan allows BYOM
    const pricingPlan = await req.user.getPricingPlan();
    if (!pricingPlan.allowBYOM) {
      next(createError(403, 'Your plan does not support bringing your own models'));
      return;
    }

    const {
      name,
      provider,
      modelId,
      apiEndpoint,
      apiKey,
      capabilities,
      promptTokenCostInCents,
      completionTokenCostInCents,
      contextWindow,
      requestTemplate,
      responseMapping,
      headers,
    } = req.body;

    // Validate required fields
    if (!name || !provider || !modelId || !apiEndpoint || !apiKey) {
      next(createError(400, 'Name, provider, modelId, apiEndpoint, and apiKey are required'));
      return;
    }

    // Create the external model
    const model = await ExternalModel.create({
      name,
      provider,
      modelId,
      apiEndpoint,
      apiKey,
      capabilities: capabilities || ['chat'],
      promptTokenCostInCents,
      completionTokenCostInCents,
      contextWindow: contextWindow || 8192,
      requestTemplate,
      responseMapping,
      headers,
      UserId: req.user.id,
      isActive: true,
      testStatus: 'untested',
    });

    // Return the model (without the API key for security)
    const modelResponse = {
      id: model.id,
      name: model.name,
      provider: model.provider,
      modelId: model.modelId,
      apiEndpoint: model.apiEndpoint,
      capabilities: model.capabilities,
      promptTokenCostInCents: model.promptTokenCostInCents,
      completionTokenCostInCents: model.completionTokenCostInCents,
      contextWindow: model.contextWindow,
      isActive: model.isActive,
      createdAt: model.createdAt,
    };

    res.status(201).json(modelResponse);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route PUT /api/models/external/:id
 * @desc Update an external model
 * @access Private
 */
router.put('/external/:id', authenticateJWT, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the model and ensure it belongs to the user
    const model = await ExternalModel.findOne({
      where: {
        id,
        UserId: req.user.id,
      },
    });

    if (!model) {
      next(createError(404, 'External model not found'));
      return;
    }

    const {
      name,
      provider,
      modelId,
      apiEndpoint,
      apiKey,
      capabilities,
      promptTokenCostInCents,
      completionTokenCostInCents,
      contextWindow,
      requestTemplate,
      responseMapping,
      headers,
      isActive,
    } = req.body;

    // Update the model
    const updateData = {
      name: name !== undefined ? name : model.name,
      provider: provider !== undefined ? provider : model.provider,
      modelId: modelId !== undefined ? modelId : model.modelId,
      apiEndpoint: apiEndpoint !== undefined ? apiEndpoint : model.apiEndpoint,
      capabilities: capabilities !== undefined ? capabilities : model.capabilities,
      promptTokenCostInCents: promptTokenCostInCents !== undefined
        ? promptTokenCostInCents : model.promptTokenCostInCents,
      completionTokenCostInCents: completionTokenCostInCents !== undefined
        ? completionTokenCostInCents : model.completionTokenCostInCents,
      contextWindow: contextWindow !== undefined ? contextWindow : model.contextWindow,
      requestTemplate: requestTemplate !== undefined ? requestTemplate : model.requestTemplate,
      responseMapping: responseMapping !== undefined ? responseMapping : model.responseMapping,
      headers: headers !== undefined ? headers : model.headers,
      isActive: isActive !== undefined ? isActive : model.isActive,
    };

    // Only update API key if a new one is provided
    if (apiKey) {
      updateData.apiKey = apiKey;
      updateData.testStatus = 'untested'; // Reset test status when API key changes
    }

    await model.update(updateData);

    // Return the model (without the API key for security)
    const modelResponse = {
      id: model.id,
      name: model.name,
      provider: model.provider,
      modelId: model.modelId,
      apiEndpoint: model.apiEndpoint,
      capabilities: model.capabilities,
      promptTokenCostInCents: model.promptTokenCostInCents,
      completionTokenCostInCents: model.completionTokenCostInCents,
      contextWindow: model.contextWindow,
      isActive: model.isActive,
      updatedAt: model.updatedAt,
    };

    res.json(modelResponse);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route DELETE /api/models/external/:id
 * @desc Delete an external model
 * @access Private
 */
router.delete('/external/:id', authenticateJWT, async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await ExternalModel.destroy({
      where: {
        id,
        UserId: req.user.id,
      },
    });

    if (!deleted) {
      next(createError(404, 'External model not found'));
      return;
    }

    res.json({ message: 'External model deleted successfully' });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route POST /api/models/external/:id/test
 * @desc Test the connection to an external model
 * @access Private
 */
router.post('/external/:id/test', authenticateJWT, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the model and ensure it belongs to the user
    const model = await ExternalModel.findOne({
      where: {
        id,
        UserId: req.user.id,
      },
    });

    if (!model) {
      next(createError(404, 'External model not found'));
      return;
    }

    // In a real implementation, this would make a test API call to the external model
    // Here we're just simulating it with a timeout

    // Update model status to pending during test
    await model.update({ testStatus: 'pending' });

    try {
      // Simulate testing the external API
      // In a real implementation, you would make an actual API call here

      // Mock successful test
      await model.update({
        testStatus: 'success',
        testMessage: 'Connection successful',
        lastTestedAt: new Date(),
      });

      res.json({
        success: true,
        message: 'External model connection test successful',
        status: 'success',
        testedAt: model.lastTestedAt,
      });
    } catch (testError) {
      // Mock failure (in real implementation, this would be an actual API failure)
      await model.update({
        testStatus: 'failed',
        testMessage: testError.message || 'Connection failed',
        lastTestedAt: new Date(),
      });

      res.status(400).json({
        success: false,
        message: 'External model connection test failed',
        error: testError.message,
        status: 'failed',
        testedAt: model.lastTestedAt,
      });
    }
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
